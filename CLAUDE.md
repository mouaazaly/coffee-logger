# Coffee Logger

Daily sales and customer entry logger for a coffee shop SMB.

## Stack
- **Runtime**: Node.js 22
- **Server**: Express 5 (`server.js`)
- **Database**: better-sqlite3 — single file `coffee.db`, synchronous API
- **Frontend**: Vanilla HTML/JS at `public/index.html`, Chart.js via CDN
- **Tests**: Node built-in `node:test`, no extra deps

## Schema
```sql
daily_log(
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT    NOT NULL UNIQUE,   -- YYYY-MM-DD
  sector    TEXT    NOT NULL DEFAULT 'coffee',
  sales     REAL    NOT NULL,
  customers INTEGER NOT NULL
)
```

## API
| Method | Path | Body / Response |
|--------|------|-----------------|
| POST | `/api/log` | `{ date, sales, customers }` → `{ id }` (201) or `{ error }` (400) |
| GET | `/api/summary` | `{ total_sales, total_customers, series: [{date,sales,customers}] }` |

## Conventions
- `sector` is always `"coffee"` — injected server-side, never sent by the client
- `INSERT OR REPLACE` on `date` — re-posting the same date updates rather than errors
- `DB_PATH=:memory:` env var in tests keeps them isolated from `coffee.db`

## Commands
```bash
npm install   # first time only
npm start     # http://localhost:3000
npm test      # runs test/api.test.js
```

## Key files
- `server.js` — all routes + DB init
- `public/index.html` — single-page app (form + dashboard + chart)
- `test/api.test.js` — 3 API tests
