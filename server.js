const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database(process.env.DB_PATH || 'coffee.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT    NOT NULL UNIQUE,
      sector    TEXT    NOT NULL DEFAULT 'coffee',
      sales     REAL    NOT NULL,
      customers INTEGER NOT NULL
    )
  `);
});

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

  db.run(
    `INSERT OR REPLACE INTO daily_log (date, sector, sales, customers) VALUES (?, 'coffee', ?, ?)`,
    [date, sales, customers],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.get('/api/summary', (req, res) => {
  db.all(
    `SELECT date, sales, customers FROM daily_log WHERE sector = 'coffee' ORDER BY date`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const total_sales = rows.reduce((sum, r) => sum + r.sales, 0);
      const total_customers = rows.reduce((sum, r) => sum + r.customers, 0);
      res.json({ total_sales, total_customers, series: rows });
    }
  );
});

app.delete('/api/log/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  db.run(
    `DELETE FROM daily_log WHERE date = ? AND sector = 'coffee'`,
    [date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'entry not found' });
      res.json({ deleted: date });
    }
  );
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(3000, () => console.log('Listening on http://localhost:3000'));
}

module.exports = { app, db };
