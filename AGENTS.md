# OptionChain Analyzer

Independent local Node.js application using built-in HTTP and a locally served Plotly dependency. Start with npm start on loopback port 5005. Production uses a current-day SQLite recorder; explicit OPTIONCHAIN_REPLAY=1 reads local archive manifests; never serve arbitrary filesystem paths, raw archive directories, or aoctoken.txt. AOC live/historical collection uses src/aoc.mjs, src/recorder.mjs and src/store.mjs. Preserve pacing, current-day retention and token isolation.

Analytics live in public/analytics.mjs. Fix top four strikes at reference time, sort legends descending by strike, normalize against all strikes at each historical snapshot, clamp negative OI change to zero, preserve gaps for missing/stale sources. Mark reference leader entries at 100%, including ties. Keep the source timestamp available on hover.

Run npm run check and npm test after changes. Use OPTIONCHAIN_WORKSPACE_AUTH=1 for portal mode; it verifies shared cookies independently. Local source changes do not authorize deployment. Token, data and node_modules remain untracked.

Line styles follow reference-snapshot metric rank independently of descending-strike legend order: first solid bold (CE red / PE green), second dashed bold yellow, third dashed purple, fourth dotted blue.

ATM comparison tab selects nearest strike to reference spot (ties lower), shows three available strikes above and below in a centered seven-card grid, and plots raw CE/PE OI, OI Change or Volume. Cross OI compares call OI at K with put OI at the next higher available strike, even outside the seven-card window. Missing legs are gaps, stale reference disables ATM, negative OI change remains zero.

Both tabs have independent horizontal (40-160%) and vertical (25-160%) plot sizing, saved in browser localStorage. Width adjusts the complete plot group with horizontal overflow; height resizes every chart via Plotly without changing data/axis ranges. Reset size restores only the active tab.

Stability charts use a fixed 50-100% Y-axis (including Reset zoom) with a dotted horizontal reference at 75% across each subplot.

Production uses FNO_AOC_BRIDGE=1 through the existing FNO Analyzer loopback API, sharing its AOC token, request pacing and Token Sync. Never read/copy protected FNO secrets or fall back to an independent token when the bridge fails. src/fno-aoc.mjs preserves full normalized chains.

Analyzer responses must set their own CSP so the portal restrictive login CSP does not block scripts/styles. Status exposes latestSnapshotAt and persistent lastSavedAt from SQLite; UI displays both in IST independently of replay reference time.

Both NIFTY and NIFTY-AI are recorded independently. SQLite key is (symbol, minute); legacy NIFTY rows migrate atomically. AOC NIFTY-AI currently reports underlying s=nifty (16-strike chain); accept that explicit alias only for requested NIFTY-AI and retain requested symbol as dataset identity. UI symbol selector preserves selection across polling; freshness/status are per symbol.

Stability hover is minimal and transparent: one HH:MM header and strike/percentage rows only. Time range (5/15/30/60 minutes or Day) is independent per tab and affects X viewport only, ending at the reference snapshot. Preserve scroll around refresh/replots without overriding user input; reuse ATM chart/card nodes with Plotly.react to avoid transient layout collapse.

The standalone AOC client retries the alternate official v27 mirror on network failures or HTTP 5xx, retains the working mirror, and skips failed mirrors for five minutes. Authentication, 404 and rate-limit errors never trigger mirror retries. Production inherits this behavior through the shared FNO bridge.

Dhan is now the default provider via the fixed-loopback FNO bridge (/api/optionchain/live). Only NIFTY is recorded; NIFTY-AI is AOC-specific. Separate current-day-dhan.sqlite3 preserves AOC data. Live-only acquisition snapshots every 30–40 seconds, no catch-up, no after-hours/weekend fetches, exponential backoff (up to 15 minutes), and authentication pause until recorder restart. Market window 09:15–15:30 IST. Snapshot times are acquisition times, not exchange-observed times. OPTIONCHAIN_PROVIDER=aoc explicitly restores legacy behavior only after user approval to resume AOC.

Dhan samples use exact acquisition milliseconds as their storage key, preserving multiple samples per minute. Reads project actual acquisition times; normal jitter does not invent missing minute rows, while outages over 80 seconds remain explicit gaps. The page refreshes saved data every 10 seconds and on visibility/focus, with concurrent refreshes suppressed. FNO bridge cache is 25 seconds.
