const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const DB_FILE = process.env.DB_PATH === ':memory:'
  ? null
  : (process.env.DB_PATH || path.join(__dirname, 'data.json'));

let entries = [];
let nextId = 1;

function load() {
  if (DB_FILE && fs.existsSync(DB_FILE)) {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    entries = data.entries || [];
    nextId = data.nextId || (entries.length ? Math.max(...entries.map(e => e.id)) + 1 : 1);
  }
}

function persist() {
  if (DB_FILE) fs.writeFileSync(DB_FILE, JSON.stringify({ entries, nextId }));
}

load();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.post('/api/log', (req, res) => {
  const { date, sales, customers } = req.body ?? {};
  if (typeof date !== 'string' || !DATE_RE.test(date))
    return res.status(400).json({ error: 'date must be a string in YYYY-MM-DD format' });
  if (typeof sales !== 'number' || isNaN(sales) || sales < 0)
    return res.status(400).json({ error: 'sales must be a non-negative number' });
  if (!Number.isInteger(customers) || customers < 0)
    return res.status(400).json({ error: 'customers must be a non-negative integer' });

  const existing = entries.findIndex(e => e.date === date);
  let id;
  if (existing >= 0) {
    id = entries[existing].id;
    entries[existing] = { id, date, sector: 'coffee', sales, customers };
  } else {
    id = nextId++;
    entries.push({ id, date, sector: 'coffee', sales, customers });
  }
  persist();
  res.status(201).json({ id });
});

app.get('/api/summary', (req, res) => {
  const rows = entries
    .filter(e => e.sector === 'coffee')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, sales, customers }) => ({ date, sales, customers }));
  const total_sales = rows.reduce((s, r) => s + r.sales, 0);
  const total_customers = rows.reduce((s, r) => s + r.customers, 0);
  res.json({ total_sales, total_customers, series: rows });
});

app.delete('/api/log/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date))
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  const idx = entries.findIndex(e => e.date === date && e.sector === 'coffee');
  if (idx < 0) return res.status(404).json({ error: 'entry not found' });
  entries.splice(idx, 1);
  persist();
  res.json({ deleted: date });
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
}

const db = { close() {} };
module.exports = { app, db };
