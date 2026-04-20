# Intraday Stock Tracker 📈

A lightweight, single-page web app that shows **real-time intraday quotes** for five top US stocks:

| Symbol | Company |
|--------|---------|
| AAPL   | Apple Inc. |
| GOOGL  | Alphabet Inc. |
| MSFT   | Microsoft Corp. |
| TSLA   | Tesla Inc. |
| AMZN   | Amazon.com Inc. |

## Features

- **Live Mode** – streams real-time trade data via the [Finnhub](https://finnhub.io) WebSocket API
- **Demo Mode** – simulated intraday prices (no API key needed, updates every 15 s)
- Per-stock **sparkline chart** (intraday price trail)
- Price, change, % change, open / high / low / volume stats
- Dark theme, fully responsive

## Getting Started

### Option A – Demo Mode (no setup)

Open `index.html` in any modern browser. The page starts in Demo Mode automatically.

### Option B – Live Mode (real data)

1. Register for a **free** Finnhub account at <https://finnhub.io/register>
2. Copy your API key from the dashboard
3. Open `index.html`, paste the key in the input field, and click **Connect Live**

> **Note:** The free Finnhub plan provides real-time US stock data via WebSocket with up to 50 symbol subscriptions.

## File Structure

```
index.html   – page markup
style.css    – dark-themed styles
app.js       – data fetching, chart rendering, UI logic
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no build step)
- [Chart.js 4](https://www.chartjs.org/) for sparklines (loaded from CDN)
- [Finnhub WebSocket API](https://finnhub.io/docs/api/websocket-trades) for live data

## Disclaimer

This project is for educational purposes only and is **not financial advice**.