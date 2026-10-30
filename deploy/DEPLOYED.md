# VCCL deployment

Deployed 30 October 2026 (IST).

- Public source: https://github.com/manashpb/VCCL-OptionChain-Analyzer
- Workspace feature: `/optionchain/`, using existing shared authentication.
- Independent PM2 service `optionchain-analyzer`, one instance, loopback port 5005.
- Workspace launcher/proxy revision `2de8d30`; no Nginx modifications required.
- App private token file is outside Git; replace it when AOC authentication expires. The recorder detects file changes automatically. Existing FNO token sync does not rotate this independent token file.
- Startup and rollover retain only current IST day in SQLite. No old research archive was deployed.

Verification: all ten tests pass locally and on Node 22 on VCCL. Public workspace checks passed for anonymous protection, login, launcher, frontend assets, data/status APIs, blocked public verifier, independent backend authentication and logout. Collection was verified with both live and historical source rows for 30 October. The portal was restarted for its new launcher entry; other existing app processes were retained.

Run verification on the server with the workspace environment loaded into Node:

`node --env-file=../workspace/.env deploy/verify.mjs`

The verifier does not print credentials or cookies.

For updates, fast-forward the app checkout, run `npm ci`, `npm run check`, `npm test`, restart only `optionchain-analyzer` with its ecosystem file and save PM2. Preserve the private token file and database. The previous source revision can be restored and this service restarted for code rollback. Do not restart unrelated applications.
