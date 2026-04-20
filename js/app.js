/**
 * IntraDay Live – app.js
 *
 * Fetches 5-minute intraday chart data from Yahoo Finance for 5 top stocks.
 * Falls back to a realistic random-walk simulation when the API is unavailable
 * (e.g. CORS restrictions in certain environments).
 *
 * Stocks tracked: AAPL · TSLA · MSFT · GOOGL · AMZN
 */

'use strict';

/* ===================== CONFIGURATION ===================== */

const STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.',        sector: 'Technology',  basePrice: 213.49, prevClose: 212.30 },
  { symbol: 'TSLA',  name: 'Tesla, Inc.',        sector: 'Automotive',  basePrice: 147.95, prevClose: 149.20 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',    sector: 'Technology',  basePrice: 395.50, prevClose: 393.80 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',      sector: 'Technology',  basePrice: 161.60, prevClose: 160.90 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',    sector: 'E-Commerce',  basePrice: 193.50, prevClose: 192.40 },
];

const REFRESH_INTERVAL_MS  = 30_000;  // 30 seconds
const INTRADAY_INTERVAL    = '5m';    // Yahoo Finance interval
const INTRADAY_RANGE       = '1d';    // Yahoo Finance range
const YAHOO_BASE           = 'https://query1.finance.yahoo.com/v8/finance/chart/';

/* ===================== STATE ===================== */

// Per-stock runtime data
const state = {};

STOCKS.forEach(s => {
  state[s.symbol] = {
    ...s,
    currentPrice:  s.basePrice,
    openPrice:     null,
    dayHigh:       s.basePrice,
    dayLow:        s.basePrice,
    volume:        0,
    labels:        [],   // time labels for chart
    prices:        [],   // close prices for chart
    chart:         null,
    usingSimulation: false,
  };
});

/* ===================== DOM BOOTSTRAP ===================== */

document.addEventListener('DOMContentLoaded', () => {
  buildCards();
  updateClock();
  setInterval(updateClock, 1000);
  refreshAll();
  setInterval(refreshAll, REFRESH_INTERVAL_MS);
});

/* ===================== CARD BUILDER ===================== */

function buildCards() {
  const grid = document.getElementById('stocks-grid');
  grid.innerHTML = '';

  STOCKS.forEach(({ symbol, name, sector }) => {
    const card = document.createElement('div');
    card.className = 'stock-card';
    card.id = `card-${symbol}`;

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-symbol">${symbol}</div>
          <div class="card-name">${name}</div>
        </div>
        <span class="card-sector">${sector}</span>
      </div>

      <div class="card-price-row">
        <div class="card-price" id="price-${symbol}">–</div>
        <div class="card-change">
          <span class="card-change-abs flat" id="change-abs-${symbol}">–</span>
          <span class="card-change-pct flat" id="change-pct-${symbol}">–%</span>
        </div>
      </div>

      <div class="card-chart">
        <canvas id="chart-${symbol}"></canvas>
      </div>

      <div class="card-stats">
        <div class="stat-item">
          <span class="stat-label">Open</span>
          <span class="stat-value" id="open-${symbol}">–</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">High</span>
          <span class="stat-value up" id="high-${symbol}">–</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Low</span>
          <span class="stat-value down" id="low-${symbol}">–</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Volume</span>
          <span class="stat-value" id="vol-${symbol}">–</span>
        </div>
      </div>
    `;

    grid.appendChild(card);
    initChart(symbol);
  });
}

/* ===================== CHART INIT ===================== */

function initChart(symbol) {
  const ctx = document.getElementById(`chart-${symbol}`).getContext('2d');

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'transparent';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(59,130,246,.25)');
          gradient.addColorStop(1, 'rgba(59,130,246,0)');
          return gradient;
        },
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2536',
          titleColor: '#94a3b8',
          bodyColor: '#e2e8f0',
          borderColor: '#2a3654',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` $${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          display: false,
          ticks: { maxTicksLimit: 6 },
        },
        y: {
          display: false,
          grace: '2%',
        },
      },
    },
  });

  state[symbol].chart = chart;
}

/* ===================== DATA REFRESH ===================== */

async function refreshAll() {
  let anySimulation = false;

  await Promise.all(
    STOCKS.map(async ({ symbol }) => {
      const ok = await fetchYahooData(symbol);
      if (!ok) {
        simulateTick(symbol);
        state[symbol].usingSimulation = true;
        anySimulation = true;
      } else {
        state[symbol].usingSimulation = false;
      }
      updateCard(symbol);
    })
  );

  // Show/hide simulation notice
  const notice = document.getElementById('data-notice');
  if (anySimulation) {
    notice.classList.remove('hidden');
  } else {
    notice.classList.add('hidden');
  }

  document.getElementById('last-updated').textContent =
    `Last updated: ${new Date().toLocaleTimeString()}`;
}

/* ===================== YAHOO FINANCE FETCH ===================== */

async function fetchYahooData(symbol) {
  const url = `${YAHOO_BASE}${symbol}?interval=${INTRADAY_INTERVAL}&range=${INTRADAY_RANGE}&includePrePost=false`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return false;

    const meta       = result.meta;
    const timestamps = result.timestamp ?? [];
    const quote      = result.indicators?.quote?.[0] ?? {};
    const closes     = quote.close   ?? [];
    const highs      = quote.high    ?? [];
    const lows       = quote.low     ?? [];
    const volumes    = quote.volume  ?? [];

    if (timestamps.length === 0) return false;

    const s = state[symbol];

    // Build chart arrays (filter null values)
    s.labels = [];
    s.prices = [];

    timestamps.forEach((ts, i) => {
      const c = closes[i];
      if (c == null) return;
      const d = new Date(ts * 1000);
      s.labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      s.prices.push(c);
    });

    if (s.prices.length === 0) return false;

    // Current / prev price
    const prevPrice = s.currentPrice;
    s.currentPrice  = meta.regularMarketPrice ?? s.prices.at(-1);
    s.openPrice     = meta.regularMarketOpen ?? s.prices[0];
    s.prevClose     = meta.chartPreviousClose ?? s.prevClose;

    // Day high/low from all valid values
    const validHighs = highs.filter(v => v != null);
    const validLows  = lows.filter(v  => v != null);
    s.dayHigh = validHighs.length ? Math.max(...validHighs) : s.currentPrice;
    s.dayLow  = validLows.length  ? Math.min(...validLows)  : s.currentPrice;

    // Volume (cumulative)
    s.volume = volumes.reduce((sum, v) => sum + (v ?? 0), 0);

    // Detect direction for flash animation
    s._priceDirection = s.currentPrice > prevPrice ? 'up' : s.currentPrice < prevPrice ? 'down' : 'flat';

    return true;
  } catch (_) {
    return false;
  }
}

/* ===================== SIMULATION FALLBACK ===================== */

/**
 * Generates a realistic intraday random walk tick.
 * Called when the live API is unavailable.
 */
function simulateTick(symbol) {
  const s = state[symbol];
  const now = new Date();

  // On first call (no prices yet), seed the intraday history
  if (s.prices.length === 0) {
    seedSimulation(symbol, now);
    return;
  }

  // Brownian motion step: volatility depends on time of day
  const hour      = now.getHours() + now.getMinutes() / 60;  // local time (used for intraday volatility shape only)
  const vol       = intradayVolatility(hour, s.currentPrice);
  const direction = Math.random() < 0.52 ? 1 : -1;           // slight upward bias
  const delta     = direction * Math.random() * vol;

  const prevPrice     = s.currentPrice;
  s.currentPrice      = Math.max(s.currentPrice + delta, 1);
  s.dayHigh           = Math.max(s.dayHigh, s.currentPrice);
  s.dayLow            = Math.min(s.dayLow,  s.currentPrice);
  s.volume           += Math.floor(Math.random() * 80_000 + 20_000);
  s._priceDirection   = s.currentPrice > prevPrice ? 'up' : 'down';

  // Append new data point
  s.labels.push(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  s.prices.push(s.currentPrice);

  // Keep only last 78 points (6.5 h × 12 per hour)
  if (s.prices.length > 78) {
    s.labels.shift();
    s.prices.shift();
  }
}

/**
 * Seeds the simulation with realistic intraday history up to now.
 */
function seedSimulation(symbol, now) {
  const s          = state[symbol];
  const marketOpen = new Date(now);
  marketOpen.setHours(9, 30, 0, 0);   // 9:30 AM local (approx EST)

  // Gap up/down from previous close (±0.8 %)
  const gapPct  = (Math.random() - 0.48) * 0.016;
  let price     = s.prevClose * (1 + gapPct);
  s.openPrice   = price;
  s.dayHigh     = price;
  s.dayLow      = price;
  s.volume      = 0;

  // Walk 5-minute candles from open to now
  const msNow    = now.getTime();
  const msOpen   = marketOpen.getTime();
  const elapsed  = Math.max(msNow - msOpen, 0);
  const candles  = Math.min(Math.floor(elapsed / (5 * 60 * 1000)), 78);

  for (let i = 0; i <= candles; i++) {
    const ts  = new Date(msOpen + i * 5 * 60 * 1000);
    const hr  = ts.getHours() + ts.getMinutes() / 60;
    const vol = intradayVolatility(hr, price);
    const dir = Math.random() < 0.52 ? 1 : -1;

    price       = Math.max(price + dir * Math.random() * vol, 1);
    s.dayHigh   = Math.max(s.dayHigh, price);
    s.dayLow    = Math.min(s.dayLow,  price);
    s.volume   += Math.floor(Math.random() * 80_000 + 20_000);

    s.labels.push(ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    s.prices.push(price);
  }

  s.currentPrice      = price;
  s._priceDirection   = 'flat';
}

/**
 * Returns a realistic price volatility (std-dev per 5-min candle)
 * that varies throughout the trading day.
 */
function intradayVolatility(hour, price) {
  // High volatility near open (9:30–10:30) and close (15:00–16:00), quiet midday
  const base = price * 0.0015;
  if (hour < 9.5 || hour > 16) return base * 0.4;    // pre/after hours
  if (hour < 10.5)              return base * 2.2;    // opening rush
  if (hour < 11.5)              return base * 1.4;
  if (hour < 14.0)              return base * 0.8;    // midday quiet
  if (hour < 15.0)              return base * 1.1;
  return base * 1.8;                                  // closing rush
}

/* ===================== CARD UPDATE ===================== */

function updateCard(symbol) {
  const s         = state[symbol];
  const change    = s.currentPrice - s.prevClose;
  const changePct = (change / s.prevClose) * 100;
  const dir       = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  // Price
  const priceEl = document.getElementById(`price-${symbol}`);
  if (priceEl) {
    priceEl.textContent = `$${s.currentPrice.toFixed(2)}`;
    // Flash animation on tick
    if (s._priceDirection) {
      priceEl.classList.remove('flash-up', 'flash-down');
      void priceEl.offsetWidth; // reflow
      if (s._priceDirection === 'up')   priceEl.classList.add('flash-up');
      if (s._priceDirection === 'down') priceEl.classList.add('flash-down');
    }
  }

  // Change
  const absEl = document.getElementById(`change-abs-${symbol}`);
  const pctEl = document.getElementById(`change-pct-${symbol}`);
  if (absEl) {
    absEl.className = `card-change-abs ${dir}`;
    absEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}`;
  }
  if (pctEl) {
    pctEl.className = `card-change-pct ${dir}`;
    pctEl.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
  }

  // Stats
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setText(`open-${symbol}`, s.openPrice ? `$${s.openPrice.toFixed(2)}` : '–');
  setText(`high-${symbol}`, s.dayHigh   ? `$${s.dayHigh.toFixed(2)}`   : '–');
  setText(`low-${symbol}`,  s.dayLow    ? `$${s.dayLow.toFixed(2)}`    : '–');
  setText(`vol-${symbol}`,  s.volume    ? formatVolume(s.volume)        : '–');

  // Chart border colour: green if positive day, red if negative
  const chart = s.chart;
  if (chart && s.prices.length > 0) {
    const color = dir === 'up' ? '#22c55e' : dir === 'down' ? '#ef4444' : '#3b82f6';
    chart.data.labels                    = [...s.labels];
    chart.data.datasets[0].data         = [...s.prices];
    chart.data.datasets[0].borderColor  = color;
    chart.update('none');
  }
}

/* ===================== CLOCK ===================== */

function updateClock() {
  const now  = new Date();
  const el   = document.getElementById('clock');
  const badge = document.getElementById('market-badge');

  if (el) {
    el.textContent = now.toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // Determine US Eastern market status (UTC offset: EST = -5, EDT = -4)
  if (badge) {
    const { status, label } = marketStatus(now);
    badge.className = `badge badge--${status}`;
    badge.textContent = label;
  }
}

function marketStatus(now) {
  // Convert UTC → approximate US Eastern time (no DST precision needed for display)
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat

  // Estimate EDT (UTC-4) as Eastern; close enough for badge display
  const estH = ((utcH - 4 + 24) % 24) + utcM / 60;

  if (utcDay === 0 || utcDay === 6) return { status: 'closed',     label: 'Weekend – Closed' };
  if (estH >= 9.5  && estH < 16)   return { status: 'open',       label: '🟢 Market Open'   };
  if (estH >= 4    && estH < 9.5)  return { status: 'premarket',  label: '🟡 Pre-Market'     };
  if (estH >= 16   && estH < 20)   return { status: 'afterhours', label: '🟡 After Hours'    };
  return                                  { status: 'closed',     label: 'Market Closed'     };
}

/* ===================== UTILITIES ===================== */

function formatVolume(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}
