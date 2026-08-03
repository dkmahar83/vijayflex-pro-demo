const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/commission-income — poori history (optional ?customer_id, ?month, ?year filters)
router.get('/', (req, res) => {
  const { customer_id, month, year } = req.query;
  let query = `
    SELECT ci.*, c.firm_name, c.phone
    FROM commission_income ci
    JOIN customers c ON ci.customer_id = c.id
    WHERE c.deleted_at IS NULL
  `;
  const params = [];
  if (customer_id) {
    query += ` AND ci.customer_id = ?`;
    params.push(customer_id);
  }
  if (month && year) {
    query += ` AND strftime('%m', ci.transaction_date) = ? AND strftime('%Y', ci.transaction_date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  query += ` ORDER BY ci.created_at DESC`;
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/commission-income/summary?month=&year= — total kept (income) vs total returned (expense)
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  let where = `WHERE c.deleted_at IS NULL`;
  const params = [];
  if (month && year) {
    where += ` AND strftime('%m', ci.transaction_date) = ? AND strftime('%Y', ci.transaction_date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  db.get(`
    SELECT
      COALESCE(SUM(ci.amount), 0) as total_kept,
      COALESCE(SUM(ci.return_amount), 0) as total_returned,
      COALESCE(SUM(ci.gross_amount), 0) as total_gross,
      COUNT(*) as count
    FROM commission_income ci
    JOIN customers c ON ci.customer_id = c.id
    ${where}
  `, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

module.exports = router;
