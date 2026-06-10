const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const DB_FILE = process.env.DB_PATH === ':memory:'
  ? null
  : (process.env.DB_PATH || path.join(__dirname, 'coffee.db'));

let db = null;

const dbReady = (async () => {
  const SQL = await require('sql.js')();
  if (DB_FILE && fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS daily_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT    NOT NULL UNIQUE,
    sector    TEXT    NOT NULL DEFAULT 'coffee',
    sales     REAL    NOT NULL,
    customers INTEGER NOT NULL
  )`);
  persist();
})();

function persist() {
  if (DB_FILE && db) fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

app.use((req, res, next) => {
  if (db) return next();
  dbReady.then(() => next()).catch(() => res.status(500).json({ error: 'db not ready' }));
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.post('/api/log', (req, res) => {
  const { date, sales, customers } = req.body ?? {};
  if (typeof date !== 'string' || !DATE_RE.test(date))
    return res.status(400).json({ error: 'date must be a string in YYYY-MM-DD format' });
  if (typeof sales !== 'number' || isNaN(sales) || sales < 0)
    return res.status(400).json({ error: 'sales must be a non-negative number' });
  if (!Number.isInteger(customers) || customers < 0)
    return res.status(400).json({ error: 'customers must be a non-negative integer' });

  db.run(`INSERT OR REPLACE INTO daily_log (date, sector, sales, customers) VALUES (?, 'coffee', ?, ?)`,
    [date, sales, customers]);
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  persist();
  res.status(201).json({ id });
});

app.get('/api/summary', (req, res) => {
  const stmt = db.prepare(`SELECT date, sales, customers FROM daily_log WHERE sector = 'coffee' ORDER BY date`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  const total_sales = rows.reduce((s, r) => s + r.sales, 0);
  const total_customers = rows.reduce((s, r) => s + r.customers, 0);
  res.json({ total_sales, total_customers, series: rows });
});

app.delete('/api/log/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date))
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  const stmt = db.prepare(`SELECT id FROM daily_log WHERE date = ? AND sector = 'coffee'`);
  stmt.bind([date]);
  const exists = stmt.step();
  stmt.free();
  if (!exists) return res.status(404).json({ error: 'entry not found' });
  db.run(`DELETE FROM daily_log WHERE date = ? AND sector = 'coffee'`, [date]);
  persist();
  res.json({ deleted: date });
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  dbReady.then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
  });
}

const dbProxy = { close() { db?.close(); } };
module.exports = { app, db: dbProxy };
