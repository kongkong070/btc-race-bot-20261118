# btc-race-bot-20261118

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A dip-buy swing bot that trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, in make.fun's "Race a BTC trading bot live for 24 hours" bounty. Long only, no leverage, no network at run time.

## Strategy

This dev window drifts down (−2.8%) with sharp hourly air pockets and slow partial recoveries, so chasing breakouts bleeds and buy-and-hold loses $27.87. A full round trip costs about 26 bps in fees, slippage and price impact — so this bot trades rarely, only after a proven washout:

- **Enter:** the close is 180 bps or more below the close 60 bars ago → buy with the whole cash. No new entries in the last 2 hours of the window.
- **Exit:** take profit 80 bps over cost, stop loss 120 bps below the entry close, or trailing stop 100 bps below the highest close since entry.
- Orders fill at the next bar's open; max slippage 100 bps.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout (see `vendor/makefun-bars.ts`, a byte-identical copy of the kit's SDK shim). Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

## Local results (dev window, 1,440 one-minute bars)

- Net PnL **+$16.79** on $1,000 start (return +1.68%), 2 round trips (4 fills), max drawdown 0.88% (Python replay of the kit bars at 13 bps/side all-in cost; the same parameters stay profitable from 6 to 26 bps/side)
- Baselines on the same window: buy-and-hold −$27.87, 22-bar breakout about −$5 at best

---

<sub>Entered on [make.fun](https://make.fun/?ref=1cpdpcxn&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
