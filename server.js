const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(process.env.DB_PATH || 'coffee.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT    NOT NULL UNIQUE,
    sector    TEXT    NOT NULL DEFAULT 'coffee',
    sales     REAL    NOT NULL,
    customers INTEGER NOT NULL
  )
`);

app.use(express.json());

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.post('/api/log', (req, res) => {
  const { date, sales, customers } = req.body ?? {};

  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return res.status(400).json({ error: 'date must be a string in YYYY-MM-DD format' });
  }
  if (typeof sales !== 'number' || isNaN(sales) || sales < 0) {
    return res.status(400).json({ error: 'sales must be a non-negative number' });
  }
  if (!Number.isInteger(customers) || customers < 0) {
    return res.status(400).json({ error: 'customers must be a non-negative integer' });
  }

  const result = db.prepare(
    `INSERT OR REPLACE INTO daily_log (date, sector, sales, customers) VALUES (?, 'coffee', ?, ?)`
  ).run(date, sales, customers);

  res.status(201).json({ id: result.lastInsertRowid });
});

app.get('/api/summary', (req, res) => {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(sales), 0)     AS total_sales,
      COALESCE(SUM(customers), 0) AS total_customers,
      json_group_array(
        json_object('date', date, 'sales', sales, 'customers', customers)
      ) AS series
    FROM daily_log
    WHERE sector = 'coffee'
  `).get();

  const series = JSON.parse(row.series).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    total_sales: row.total_sales,
    total_customers: row.total_customers,
    series,
  });
});

app.delete('/api/log/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  const result = db.prepare(`DELETE FROM daily_log WHERE date = ? AND sector = 'coffee'`).run(date);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'entry not found' });
  }
  res.json({ deleted: date });
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(3000, () => console.log('Listening on http://localhost:3000'));
}

module.exports = { app, db };
