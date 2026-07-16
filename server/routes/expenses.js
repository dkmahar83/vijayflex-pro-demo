const express = require('express');
const router = express.Router();
const db = require('../db/database');
const validate = require('../middleware/validate');
const { createExpenseSchema } = require('../schemas/expenseSchemas');

// GET /api/expenses?month=06&year=2026
router.get('/', (req, res) => {
  const { month, year } = req.query;

  let params = [month, year];
  let query = `
    SELECT expenses.*,
      CASE 
        WHEN expenses.paid_to_type = 'vendor' THEN vendors.name
        WHEN expenses.paid_to_type = 'employee' THEN employees.name
        ELSE NULL
      END as paid_to_name
    FROM expenses
    LEFT JOIN vendors ON expenses.paid_to_type = 'vendor' AND expenses.paid_to_id = vendors.id
    LEFT JOIN employees ON expenses.paid_to_type = 'employee' AND expenses.paid_to_id = employees.id
    WHERE strftime('%m', expense_date) = ?
    AND strftime('%Y', expense_date) = ?
    ORDER BY expense_date DESC
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/expenses/daily?date=2026-06-15
router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  db.all(`
    SELECT expenses.*,
      CASE 
        WHEN expenses.paid_to_type = 'vendor' THEN vendors.name
        WHEN expenses.paid_to_type = 'employee' THEN employees.name
        ELSE NULL
      END as paid_to_name
    FROM expenses
    LEFT JOIN vendors ON expenses.paid_to_type = 'vendor' AND expenses.paid_to_id = vendors.id
    LEFT JOIN employees ON expenses.paid_to_type = 'employee' AND expenses.paid_to_id = employees.id
    WHERE expense_date = ?
    ORDER BY id DESC
  `, [date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/expenses/summary?month=06&year=2026
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  db.all(`
    SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count,
      SUM(CASE WHEN payment_mode = 'upi' THEN amount ELSE 0 END) as upi_total,
      SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) as cash_total
    FROM expenses
    WHERE strftime('%m', expense_date) = ?
    AND strftime('%Y', expense_date) = ?
    GROUP BY category
    ORDER BY total DESC
  `, [month, year], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/expenses
router.post('/', (req, res) => {
  const {
    category, amount, expense_date, description,
    paid_to_type, paid_to_id,
    payment_mode, upi_account, utr_number, denomination_breakdown,
    customer_id, customer_name
  } = req.body;

  // Commission ke liye customer zaroori hai
  if (category === 'Commission' && !customer_id) {
    return res.status(400).json({ error: 'Commission ke liye customer select karna zaroori hai' });
  }

  if (!category || !amount)
    return res.status(400).json({ error: 'category and amount are required' });

  const date = expense_date || new Date().toISOString().split('T')[0];
  const createdAt = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).replace('T', ' ');

  // Only store denomination breakdown for cash payments, and only if it has actual counts
  const breakdownToSave = ((payment_mode || 'cash') !== 'upi' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
    ? JSON.stringify(denomination_breakdown)
    : null;

  db.run(`
    INSERT INTO expenses 
      (category, amount, expense_date, description, paid_to_type, paid_to_id, payment_mode, upi_account, utr_number, created_at, denomination_breakdown, customer_id, customer_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    category, parseInt(parseFloat(amount), 10), date, description || null,
    paid_to_type || null, paid_to_id ? parseInt(paid_to_id) : null,
    payment_mode || 'cash', upi_account || null, utr_number || null,
    createdAt, breakdownToSave,
    customer_id ? parseInt(customer_id) : null,
    customer_name || null
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const expenseId = this.lastID;

    // Vendor payment → update vendor_transactions + balance
    if (paid_to_type === 'vendor' && paid_to_id) {
      db.run(`
        INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description)
        VALUES (?, 'payment', ?, ?, ?)
      `, [paid_to_id, parseFloat(amount), date, description || category], () => {});

      db.run(`
        UPDATE vendors 
        SET total_paid = total_paid + ?, balance_due = balance_due - ?
        WHERE id = ?
      `, [parseFloat(amount), parseFloat(amount), paid_to_id], () => {});
    }

    // Update daily_records total_expenses
    db.run(`
      INSERT INTO daily_records (record_date, total_expenses)
      VALUES (?, ?)
      ON CONFLICT(record_date) DO UPDATE SET
        total_expenses = total_expenses + excluded.total_expenses
    `, [date, parseFloat(amount)], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json({ id: expenseId, message: 'Expense recorded' });
    });
  });
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM expenses WHERE id = ?`, [id], (err, expense) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    db.run(`DELETE FROM expenses WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      // Reverse vendor balance
      if (expense.paid_to_type === 'vendor' && expense.paid_to_id) {
        db.run(`
          UPDATE vendors 
          SET total_paid = total_paid - ?, balance_due = balance_due + ?
          WHERE id = ?
        `, [expense.amount, expense.amount, expense.paid_to_id], () => {});
      }

      // Reverse daily_records total
      db.run(`
        UPDATE daily_records
        SET total_expenses = total_expenses - ?
        WHERE record_date = ?
      `, [expense.amount, expense.expense_date], () => {});

      res.json({ message: 'Expense deleted' });
    });
  });
});

module.exports = router;