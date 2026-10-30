# VCCL OptionChain Analyzer

Interactive NIFTY strike stability and ATM CE/PE comparisons, with current-day AOC recording.

## Run

Requires Node.js 22.13+ (uses built-in SQLite). Run `npm ci`, put your AOC bearer token in the ignored `aoctoken.txt` file with restrictive permissions, and run `npm start`. Open `http://127.0.0.1:5005/optionchain/` locally. Never commit the token. `AOC_TOKEN_FILE` can point at another private token file; token changes are read on each request without a restart. The Node SQLite module is experimental on Node 22.

## Collection and storage

- NIFTY nearest available expiry; Monday-Friday, 09:15 through 14:00 IST inclusive: 286 requested minute slots.
- Live `/live-data` is prioritized for the current minute. Missing earlier minutes use AOC `/historical-data` with the requested timestamp. Restarts resume from SQLite without duplicating valid minutes.
- Requests use the verified AOC v27 contract from FNO-Analyzer: bearer authentication, compact keys/values, symbol/date/expiry validation, two-second pacing, timeout and rate-limit cooldown. Authentication failures pause requests until the token file changes.
- SQLite WAL transactions with a unique minute primary key and day index. Full normalized snapshots and chains are gzip compressed in database blobs; chart API returns only needed fields and caches by database revision.
- Provider timestamps are preserved. Source offsets greater than 60 seconds are stale gaps and retried after five minutes. Missing slots are explicit gaps. A failed request never fabricates data. Market holidays may yield unavailable snapshots; weekend collection is skipped.
- **Only the current IST day is stored/served in production.** On startup and daily rollover, prior-day rows are deleted, secure-delete is enabled, and WAL checkpoint plus VACUUM remove obsolete database pages. No archive exports/backups are created by the app. Data capture stops after the 14:00 minute, while missing minutes can continue to backfill. Rollover runs even when no browser is open.
- The database is `data/current-day.sqlite3` (`OPTIONCHAIN_DB` override). One recorder process only. The UI polls every 15 seconds and follows the latest snapshot unless an earlier reference is selected.

## Charts

Stability: final/reference top-four strikes, descending-strike legends, each historical snapshot normalized against its maximum across all strikes. Fixed 50-100% axis with 75% dotted reference. First rank solid bold red CE / green PE; second bold dashed yellow; third dashed purple; fourth dotted blue. Negative OI change is zero.

ATM comparison: nearest available strike to reference spot (ties lower), plus three higher/lower strikes in a seven-card grid. Raw OI, OI Change, Volume or Cross OI. Cross OI pairs CE OI at strike K with PE OI at the next higher available strike. Both tabs support zoom, hidden lines, hover timestamps, PNG exports and independent persisted width/height sliders.

## Workspace deployment

Use `ecosystem.config.cjs` with PM2: loopback 5005, workspace authentication enabled, independently verifying the existing session cookie at loopback portal `/verify`. The workspace launcher and fixed-loopback `/optionchain/` proxy provide shared sign-in. No new Nginx route is required where the root routes through the portal. Never publicly expose local preview mode.

`OPTIONCHAIN_RECORD=0` disables the recorder for testing. `OPTIONCHAIN_REPLAY=1` is an explicit development-only mode reading ignored JSON archives (not enabled by production config). Existing local research archives are independent of the production database and are never shipped.

## Verify

`npm run check` and `npm test`. Tests use synthetic fixtures, not private downloaded data. Tests cover ranking, normalization, markers, ATM/Cross OI, source validation, the inclusive schedule, retention, deduplication, live priority, backfill, assets and authentication.
