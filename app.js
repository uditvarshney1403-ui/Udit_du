/* app.js – Intraday Stock Tracker
   Live data  : Finnhub WebSocket (wss://ws.finnhub.io?token=<KEY>)
   Demo data  : locally simulated intraday prices
   Charts     : Chart.js sparklines (intraday candle trail)
*/

'use strict';

// ── 5 tracked stocks ──────────────────────────────────────────────────────────
const STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.',         basePrice: 189.50, color: '#58a6ff' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',       basePrice: 173.30, color: '#3fb950' },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',     basePrice: 415.80, color: '#a371f7' },
  { symbol: 'TSLA',  name: 'Tesla Inc.',          basePrice: 177.90, color: '#f0883e' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',     basePrice: 192.40, color: '#ffa657' },
];

// Allowlist used to guard against prototype-pollution via WebSocket symbol values
const KNOWN_SYMBOLS = new Set(STOCKS.map(s => s.symbol));

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  mode: null,           // 'live' | 'demo'
  ws: null,
  demoTimer: null,
  charts: {},           // symbol → Chart instance
  data: {},             // symbol → { price, open, high, low, prevClose, volume, trail[] }
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const apiNotice    = $('api-notice');
const statusBar    = $('status-bar');
const statusText   = $('status-text');
const connectBtn   = $('connect-btn');
const demoBtn      = $('demo-btn');
const disconnectBtn= $('disconnect-btn');
const apiKeyInput  = $('api-key-input');
const marketBadge  = $('market-status');
const clock        = $('clock');
const grid         = $('cards-grid');

// ── Clock & market status ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) + ' ET';

  // NYSE regular hours: Mon-Fri 09:30-16:00 ET
  const day = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  const t = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' });
  const isWeekday = !['Sat', 'Sun'].includes(day);
  const isOpen = isWeekday && t >= '09:30' && t < '16:00';

  marketBadge.textContent = isOpen ? '● Market Open' : '● Market Closed';
  marketBadge.className = 'badge ' + (isOpen ? 'badge-open' : 'badge-closed');
  return isOpen;
}
setInterval(updateClock, 1000);
updateClock();

// ── Initialise stock state ────────────────────────────────────────────────────
function initStockData() {
  const now = Date.now();
  STOCKS.forEach(s => {
    const base = s.basePrice;
    // seed today's open with a small random offset
    const open = +(base * (1 + (Math.random() - 0.5) * 0.012)).toFixed(2);
    state.data[s.symbol] = {
      price: open,
      open,
      prevClose: +(base * (1 + (Math.random() - 0.5) * 0.008)).toFixed(2),
      high: open,
      low: open,
      volume: Math.floor(Math.random() * 2_000_000) + 500_000,
      trail: [{ t: now, p: open }],
    };
  });
}

// ── Build card HTML ───────────────────────────────────────────────────────────
function buildCard(s) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'card-' + s.symbol;
  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-ticker">${s.symbol}</div>
        <div class="card-name">${s.name}</div>
      </div>
      <div class="price-block">
        <div class="price" id="price-${s.symbol}">—</div>
        <div class="change-row">
          <span class="change-abs flat" id="chg-${s.symbol}">—</span>
          <span class="change-pct flat" id="pct-${s.symbol}"></span>
        </div>
      </div>
    </div>
    <div class="stats-row">
      <span class="stat">Open:<span id="open-${s.symbol}">—</span></span>
      <span class="stat">High:<span id="high-${s.symbol}">—</span></span>
      <span class="stat">Low:<span id="low-${s.symbol}">—</span></span>
      <span class="stat">Vol:<span id="vol-${s.symbol}">—</span></span>
    </div>
    <div class="chart-wrap">
      <canvas id="chart-${s.symbol}"></canvas>
    </div>
    <div class="card-footer">
      <span>Prev Close: <strong id="prev-${s.symbol}">—</strong></span>
      <span id="upd-${s.symbol}">—</span>
    </div>
  `;
  return card;
}

function buildGrid() {
  grid.innerHTML = '';
  STOCKS.forEach(s => {
    const card = buildCard(s);
    grid.appendChild(card);
    initChart(s);
  });
}

// ── Chart.js sparkline ────────────────────────────────────────────────────────
function initChart(s) {
  const ctx = document.getElementById('chart-' + s.symbol).getContext('2d');
  const d = state.data[s.symbol];

  const gradient = ctx.createLinearGradient(0, 0, 0, 120);
  gradient.addColorStop(0, hexToRgba(s.color, 0.35));
  gradient.addColorStop(1, hexToRgba(s.color, 0));

  state.charts[s.symbol] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [fmtTime(d.trail[0].t)],
      datasets: [{
        data: [d.trail[0].p],
        borderColor: s.color,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: gradient,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => '$' + ctx.raw.toFixed(2),
        },
        backgroundColor: '#161b22',
        borderColor: '#30363d',
        borderWidth: 1,
        titleColor: '#7d8590',
        bodyColor: '#e6edf3',
      }},
      scales: {
        x: { display: false },
        y: {
          display: true,
          position: 'right',
          grid: { color: 'rgba(48,54,61,.5)' },
          ticks: { color: '#7d8590', font: { size: 10 }, maxTicksLimit: 4,
            callback: v => '$' + v.toFixed(0) },
        },
      },
    },
  });
}

function updateChart(symbol, price, timestamp) {
  const chart = state.charts[symbol];
  if (!chart) return;
  const d = state.data[symbol];
  d.trail.push({ t: timestamp, p: price });
  // keep at most 300 data points (intraday trail)
  if (d.trail.length > 300) d.trail.shift();

  chart.data.labels = d.trail.map(pt => fmtTime(pt.t));
  chart.data.datasets[0].data = d.trail.map(pt => pt.p);
  chart.update('none');
}

// ── DOM update helpers ────────────────────────────────────────────────────────
function updateCard(symbol) {
  const d = state.data[symbol];
  if (!d) return;

  const price     = d.price;
  const change    = +(price - d.prevClose).toFixed(2);
  const changePct = +((change / d.prevClose) * 100).toFixed(2);
  const dir       = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const sign      = change > 0 ? '+' : '';

  const priceEl  = $('price-' + symbol);
  const prevClass = [...priceEl.classList].find(c => c.startsWith('flash-'));
  if (prevClass) priceEl.classList.remove(prevClass);

  priceEl.textContent = '$' + price.toFixed(2);
  if (change > 0) priceEl.classList.add('flash-up');
  else if (change < 0) priceEl.classList.add('flash-down');
  setTimeout(() => { priceEl.classList.remove('flash-up', 'flash-down'); }, 1200);

  const chgEl = $('chg-' + symbol);
  const pctEl = $('pct-' + symbol);
  chgEl.textContent  = sign + change.toFixed(2);
  pctEl.textContent  = '(' + sign + changePct.toFixed(2) + '%)';
  chgEl.className = 'change-abs ' + dir;
  pctEl.className = 'change-pct ' + dir;

  $('open-' + symbol).textContent = ' $' + d.open.toFixed(2);
  $('high-' + symbol).textContent = ' $' + d.high.toFixed(2);
  $('low-'  + symbol).textContent = ' $' + d.low.toFixed(2);
  $('vol-'  + symbol).textContent = ' ' + fmtVol(d.volume);
  $('prev-' + symbol).textContent = '$' + d.prevClose.toFixed(2);
  $('upd-'  + symbol).textContent = 'Updated ' + new Date().toLocaleTimeString();
}

// ── Demo mode: simulated intraday ticks ───────────────────────────────────────
function startDemo() {
  state.mode = 'demo';
  initStockData();
  buildGrid();
  STOCKS.forEach(s => updateCard(s.symbol));

  marketBadge.className   = 'badge badge-demo';
  marketBadge.textContent = '● Demo Mode';
  statusBar.classList.remove('hidden');
  statusText.textContent  = '🟡 Demo mode — simulated real-time prices (refreshes every 15 s)';
  apiNotice.style.display = 'none';

  tickDemo();                          // immediate first tick
  state.demoTimer = setInterval(tickDemo, 15_000);
}

function tickDemo() {
  const now = Date.now();
  STOCKS.forEach(s => {
    const d = state.data[s.symbol];
    // random walk: ±0.3 % per tick; bias 0.497 (< 0.5) for slight upward drift
    const delta = d.price * (Math.random() - 0.497) * 0.006;
    d.price  = +Math.max(d.price + delta, 0.01).toFixed(2);
    d.high   = Math.max(d.high, d.price);
    d.low    = Math.min(d.low,  d.price);
    d.volume += Math.floor(Math.random() * 25_000) + 5_000;

    updateChart(s.symbol, d.price, now);
    updateCard(s.symbol);
  });
}

// ── Live mode: Finnhub WebSocket ──────────────────────────────────────────────
function startLive(apiKey) {
  state.mode = 'live';
  initStockData();
  buildGrid();
  STOCKS.forEach(s => updateCard(s.symbol));

  apiNotice.style.display = 'none';
  statusBar.classList.remove('hidden');
  statusText.textContent  = '🔵 Connecting to Finnhub…';

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
  state.ws = ws;

  ws.addEventListener('open', () => {
    statusText.textContent = '🟢 Connected — live quotes streaming';
    STOCKS.forEach(s => ws.send(JSON.stringify({ type: 'subscribe', symbol: s.symbol })));

    // Also fetch a REST snapshot for initial prev-close / open values
    STOCKS.forEach(s => fetchQuoteREST(s.symbol, apiKey));
  });

  ws.addEventListener('message', e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'trade' || !msg.data) return;
      msg.data.forEach(trade => {
        const sym = trade.s;
        // Guard: only process symbols we explicitly track to prevent prototype pollution
        if (!KNOWN_SYMBOLS.has(sym)) return;
        const d = state.data[sym];
        if (!d) return;
        const price = +trade.p.toFixed(2);
        const ts    = trade.t;          // epoch ms
        d.price  = price;
        d.high   = Math.max(d.high, price);
        d.low    = Math.min(d.low,  price);
        d.volume += trade.v || 0;
        updateChart(sym, price, ts);
        updateCard(sym);
      });
    } catch (_) { /* ignore parse errors */ }
  });

  ws.addEventListener('close', () => {
    statusText.textContent = '🔴 Disconnected';
    statusText.style.color = '#f85149';
  });

  ws.addEventListener('error', () => {
    statusText.textContent = '🔴 WebSocket error — check your API key and try again';
    statusText.style.color = '#f85149';
  });
}

async function fetchQuoteREST(symbol, apiKey) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const q = await res.json();
    const d = state.data[symbol];
    if (!d || !q || !q.c) return;
    d.prevClose = q.pc || d.prevClose;
    d.open      = q.o  || d.open;
    d.high      = q.h  || d.high;
    d.low       = q.l  || d.low;
    d.price     = q.c;
    updateCard(symbol);
  } catch (_) { /* silently ignore */ }
}

// ── Disconnect / reset ────────────────────────────────────────────────────────
function disconnect() {
  if (state.ws) { state.ws.close(); state.ws = null; }
  clearInterval(state.demoTimer);
  state.demoTimer = null;
  state.mode = null;
  statusBar.classList.add('hidden');
  apiNotice.style.display = '';
  marketBadge.className   = 'badge badge-closed';
  marketBadge.textContent = '● Market Closed';
  updateClock();
  grid.innerHTML = '';
}

// ── Button handlers ───────────────────────────────────────────────────────────
connectBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) { apiKeyInput.focus(); apiKeyInput.style.borderColor = '#f85149'; return; }
  apiKeyInput.style.borderColor = '';
  startLive(key);
});

demoBtn.addEventListener('click', () => { startDemo(); });
disconnectBtn.addEventListener('click', () => { disconnect(); });

apiKeyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') connectBtn.click();
  apiKeyInput.style.borderColor = '';
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtTime(epochMs) {
  return new Date(epochMs).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtVol(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
  return v.toString();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Auto-start demo on load for preview convenience ───────────────────────────
// Remove this line if you want users to always enter an API key first.
window.addEventListener('DOMContentLoaded', () => startDemo());
