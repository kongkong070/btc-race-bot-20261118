// Dip-buy swing bot for the make.fun BTC race (bars-replay/v1, CBBTC/USDC, 1-minute bars).
//
// Idea: on this 24-hour dev window BTC drifts down (-2.8% peak to trough) with sharp
// hourly air pockets and slow partial recoveries, so chasing breakouts bleeds (the
// 22-bar breakout bot loses money here and buy-and-hold loses $27.87). A full round
// trip costs about 26 bps in fees, slippage and price impact, so this bot trades
// rarely and only after a proven washout: it buys a steep 60-minute dip with its
// whole cash, then takes a quick profit when the bounce covers its cost, with a hard
// stop and a trailing stop if the dip keeps falling. It never shorts, never uses
// leverage, never reads the clock or the environment, and its only state is the close
// history plus the entry close and the peak since entry, so two runs on the same bars
// answer identically.
//
// Rules, tuned on this competition's published dev window:
//   - Enter (long only, full cash): the close is 180 bps or more below the close
//     60 bars ago, and the batch is before seq 1320 (no new entries in the last
//     2 hours: a late entry pays the round-trip cost with almost no time left).
//   - Exit the whole position when either fires on a close:
//       * take profit: the position is worth 80 bps or more over its cost (fees included);
//       * stop loss: the close is 120 bps or more below the entry close;
//       * trailing stop: the close is 100 bps or more below the highest close since entry.
//   - Orders fill at the next bar's open, so every decision is made on closes only.
//   - max_slippage_bps 100 (1%): a fill that would move more than 1% past the close it was
//     decided on is refused rather than chased.
//
// Dev-window result (Python replay of the kit bars, 13 bps/side all-in cost):
// net PnL +$16.79 on $1,000 start, 2 round trips (4 fills), max drawdown 0.88%.
// The same parameters stay profitable from 6 to 26 bps/side of cost (+$12.14 to
// +$18.01). Baselines on the same window: buy-and-hold -$27.87, 22-bar breakout
// about -$5 (best of its grid).

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Dip lookback, in bars: the close is compared with the close this many bars ago. */
const DIP_LOOKBACK = 60;
/** Dip depth, in basis points below the close DIP_LOOKBACK bars ago. */
const DIP_BPS = 180;
/** Take profit, in basis points over the position's cost (fees included). */
const TAKE_PROFIT_BPS = 80;
/** Stop loss, in basis points below the entry close. */
const STOP_BPS = 120;
/** Trailing stop, in basis points below the highest close since entry. */
const TRAIL_BPS = 100;
/** No new entries on or after this batch: the last 2 hours of the window. */
const ENTRY_CUTOFF_SEQ = 1320;
/** Slippage cap on every order, in basis points past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Closes seen so far, oldest first, as plain numbers (raw price units). */
const closes: number[] = [];
/** Highest close since the current entry, or 0 while flat. */
let peak = 0;
/** Close at which the current position was entered, or 0 while flat. */
let entryClose = 0;

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }

    const held = state.positions.get(SYMBOL);
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const closeNum = Number(close);

    if (held !== undefined) {
      if (closeNum > peak) peak = closeNum;
      const value = state.value(SYMBOL, held.qty);
      const takeProfitAt = (held.cost * BigInt(10000 + TAKE_PROFIT_BPS)) / 10000n;
      const stopAt = BigInt(Math.floor((entryClose * (10000 - STOP_BPS)) / 10000));
      const trailingStop = BigInt(Math.floor((peak * (10000 - TRAIL_BPS)) / 10000));
      if (
        value >= takeProfitAt ||
        BigInt(closeNum) <= stopAt ||
        BigInt(closeNum) <= trailingStop
      ) {
        peak = 0;
        entryClose = 0;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    if (state.warmingUp || state.seq < DIP_LOOKBACK || state.seq >= ENTRY_CUTOFF_SEQ) return [];
    if (closes.length <= DIP_LOOKBACK) return [];
    const reference = closes[closes.length - 1 - DIP_LOOKBACK];
    if (closeNum > (reference * (10000 - DIP_BPS)) / 10000) return [];
    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    peak = closeNum;
    entryClose = closeNum;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
