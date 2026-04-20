# IntraDay Live – Real-Time Intraday Stock Dashboard

A lightweight, single-page intraday stocks website that tracks **5 top US equities** in real time with live charts, price tickers, and key market stats.

## Stocks Tracked

| Symbol | Company           | Sector       |
|--------|-------------------|--------------|
| AAPL   | Apple Inc.        | Technology   |
| TSLA   | Tesla, Inc.       | Automotive   |
| MSFT   | Microsoft Corp.   | Technology   |
| GOOGL  | Alphabet Inc.     | Technology   |
| AMZN   | Amazon.com Inc.   | E-Commerce   |

## Features

- **Live intraday data** fetched from Yahoo Finance (5-minute candles, 1-day range)
- **Realistic simulation fallback** – if the API is unavailable (CORS / rate limits), a Brownian-motion model generates realistic price movement with correct intraday volatility patterns (high at open/close, quiet midday)
- **Per-stock mini line chart** (Chart.js) coloured green/red by day direction
- **Price flash animation** on every tick
- **Key stats per card** – Open, Day High, Day Low, Volume
- **Market status badge** – Pre-Market / Open / After Hours / Closed (US Eastern time)
- **Auto-refresh every 30 seconds**
- **Responsive dark trading-terminal UI**

## Usage

Just open `index.html` in any modern browser – no build step or server required.

```
open index.html
```

For live API data (no CORS restrictions), serve the files over HTTP:

```bash
npx serve .
# or
python3 -m http.server 8080
```

## Project Structure

```
├── index.html        # Main HTML page
├── css/
│   └── style.css     # Dark terminal theme
└── js/
    └── app.js        # Data fetching, simulation, charts
```