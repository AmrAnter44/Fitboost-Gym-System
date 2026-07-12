---
name: verify
description: Build, launch, and drive FitBoost-System to verify changes at the running app's surface (Next.js 14 on port 4001, Electron-packaged, Arabic RTL).
---

# Verifying FitBoost-System changes

## Launch

```bash
npm run dev          # runs predev checks then `node server.js` on port 4001
curl -s http://localhost:4001/api/health   # 200 = up (usually <10s)
```

Dev server and `npm run build` both use `.next` — never run them at the same time.
If `npx tsc --noEmit` shows Prisma type errors on committed code, run `npx prisma generate` first.
Stopping the `npm run dev` background task can orphan the `next-server` child, which keeps
holding port 4001 (next start fails with EADDRINUSE). Check and kill:
`lsof -nP -iTCP:4001 -sTCP:LISTEN -t | xargs kill`

## Authenticated browser session (no password needed)

Playwright 1.58 + chromium are already in node_modules. Auth is a JWT in an
`auth-token` cookie signed with `JWT_SECRET` from `.env`. Mint one and inject it:

```js
const jwt = require('<repo>/node_modules/jsonwebtoken')
const secret = fs.readFileSync('<repo>/.env', 'utf8').match(/^JWT_SECRET="?([^"\n]+)"?/m)[1]
const token = jwt.sign({ userId: 'fallback-fitboost-account', name: 'FitBoost Admin',
  email: 'fitboost@system.local', role: 'OWNER', staffId: null, permissions: {} },
  secret, { expiresIn: '1h' })
await ctx.addCookies([{ name: 'auth-token', value: token, url: 'http://localhost:4001',
  httpOnly: true, sameSite: 'Strict' }])
```

`fallback-fitboost-account` is the OWNER row in `prisma/gym.db` (the active DATABASE_URL).
Read the DB read-only only: `sqlite3 "file:<repo>/prisma/gym.db?mode=ro" ...`

## Gotchas when driving the UI

- Use `waitUntil: 'domcontentloaded'`, not `networkidle` — HMR/polling keeps the network busy.
- Translations load via async `import('../messages/<locale>.json')`; `t()` returns the raw
  key (e.g. `nav.home`) for the first few hundred ms. Wait for labels before asserting text.
- Many pages have hidden duplicate inputs (mobile variants) — select with `input:visible`.
- First hit of each route in dev triggers compilation; flaky timing on cold routes is
  compile lag, not a bug. Re-run once warm before concluding FAIL.
- Client-side navigation (Next Link click) can take seconds in dev — after clicking a link
  inside a frame, `await frame.waitForURL('**/target')` before asserting anything about the
  destination page, or you'll type into / read from the previous page.
- UI is Arabic RTL by default; primary color is dynamic (yellow in current DB settings).

## Tab system (Chrome-like tabs, added 2026-07)

Strip renders only in the top window when logged in (`role="tablist"`); secondary tabs are
same-origin keep-alive iframes overlaying sidebar+content. State persists in
`localStorage.gymTabs`. Max 3 tabs (`MAX_TABS` in contexts/TabsContext.tsx).
Requires middleware to send `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`.
A hidden spare iframe preloads `/` ~2.5s after login so "+" adopts it instantly (~50ms);
expect one extra `<iframe>` beyond the visible tabs when counting frames in tests.
Never let a test (or refactor) reorder/move the iframe DOM nodes — moving an iframe reloads it;
TabFrames keeps creation order append-only and the spare last for exactly this reason.
