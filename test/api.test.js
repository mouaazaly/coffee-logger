const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
const { app, db } = require('../server');

let server;
let base;

before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    base = `http://localhost:${server.address().port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => {
  server.close(() => { db.close(); resolve(); });
}));

test('POST /api/log creates an entry and returns 201 with an id', async () => {
  const res = await fetch(`${base}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-01-01', sales: 300, customers: 50 }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(typeof body.id, 'number');
});

test('GET /api/summary returns correct totals and a sorted time series', async () => {
  await fetch(`${base}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-01-02', sales: 200, customers: 30 }),
  });
  await fetch(`${base}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-01-03', sales: 150, customers: 20 }),
  });

  const res = await fetch(`${base}/api/summary`);
  assert.equal(res.status, 200);
  const body = await res.json();

  // 3 rows in DB: 300+200+150=650 sales, 50+30+20=100 customers
  assert.equal(body.total_sales, 650);
  assert.equal(body.total_customers, 100);
  assert.ok(Array.isArray(body.series));
  assert.equal(body.series.length, 3);

  for (let i = 1; i < body.series.length; i++) {
    assert.ok(body.series[i].date >= body.series[i - 1].date, 'series must be sorted by date ascending');
  }
});

test('POST /api/log with invalid input returns 400 with an error message', async () => {
  const res = await fetch(`${base}/api/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: 'not-a-date', sales: -5, customers: 'abc' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
});
