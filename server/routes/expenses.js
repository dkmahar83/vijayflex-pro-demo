const express = require('express');
const router = express.Router();
const db = require('../db/database');
const validate = require('../middleware/validate');
const { createExpenseSchema } = require('../schemas/expenseSchemas');
const { getLiveCashBalance } = require('../utils/cashBalance');

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
    customer_id, customer_name,
    // Commission split (optional, category === 'Commission' only) — jitna hum
    // apne paas rakhte hain (income) vs jitna wapis karte hain (ye expense row,
    // amount field). commission_kept_amount > 0 hone par hi commission_income
    // row banti hai; warna purana behavior (sirf return-expense) as-is chalta hai.
    commission_gross_amount, commission_percent, commission_kept_amount
  } = req.body;

  // Commission ke liye customer zaroori hai
  if (category === 'Commission' && !customer_id) {
    return res.status(400).json({ error: 'Commission ke liye customer select karna zaroori hai' });
  }

  if (!category || !amount)
    return res.status(400).json({ error: 'category and amount are required' });

  const keptAmount = category === 'Commission' ? parseFloat(commission_kept_amount || 0) : 0;
  if (keptAmount < 0)
    return res.status(400).json({ error: 'Commission kept amount negative nahi ho sakta' });

  const date = expense_date || new Date().toISOString().split('T')[0];
  const createdAt = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Kolkata'}).replace('T', ' ');

  // Only store denomination breakdown for cash payments, and only if it has actual counts
  const breakdownToSave = ((payment_mode || 'cash') !== 'upi' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
    ? JSON.stringify(denomination_breakdown)
    : null;

  function insertExpenseRow() {
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

        // Commission ka kept-hissa (income) — is expense row (jo return-amount
        // hai) se linked, sirf tab banta hai jab commission_kept_amount > 0 diya
        // gaya ho. Customer ke due/balance par isse koi asar nahi padta.
        if (category === 'Commission' && keptAmount > 0) {
          const gross = commission_gross_amount != null
            ? parseFloat(commission_gross_amount)
            : keptAmount + parseFloat(amount);
          const pct = commission_percent != null
            ? parseFloat(commission_percent)
            : (gross > 0 ? (keptAmount / gross) * 100 : null);

          db.run(`
            INSERT INTO commission_income
              (customer_id, gross_amount, percent, amount, return_amount, expense_id, note, transaction_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            parseInt(customer_id), gross, pct, keptAmount, parseFloat(amount),
            expenseId, description || null, date, createdAt
          ], (err3) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.status(201).json({
              id: expenseId,
              message: 'Expense recorded',
              commission_income: { amount: keptAmount, gross_amount: gross, percent: pct }
            });
          });
        } else {
          res.status(201).json({ id: expenseId, message: 'Expense recorded' });
        }
      });
    });
  }

  // Cash expense se pehle live galla balance check — insufficient cash pe
  // insert hi nahi hone dete, isliye drawer kabhi negative nahi jaayega.
  if ((payment_mode || 'cash') === 'cash') {
    getLiveCashBalance((err, balance) => {
      if (err) return res.status(500).json({ error: err.message });
      if (parseFloat(amount) > balance) {
        return res.status(400).json({
          error: `Galla mein sirf ₹${balance} cash hai — ₹${amount} ka expense nahi ho sakta (₹${(parseFloat(amount) - balance).toFixed(0)} kam hai).`
        });
      }
      insertExpenseRow();
    });
  } else {
    insertExpenseRow();
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM expenses WHERE id = ?`, [id], (err, expense) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const deleteExpenseRow = () => {
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
    };

    // Commission expense delete hone se PEHLE uska linked commission_income
    // (kept/income share) row delete karo — DB mein foreign_keys = ON hai,
    // isliye parent (expenses) row ko child (commission_income) se pehle
    // delete karne par FOREIGN KEY constraint error aata hai.
    if (expense.category === 'Commission') {
      db.run(`DELETE FROM commission_income WHERE expense_id = ?`, [id], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        deleteExpenseRow();
      });
    } else {
      deleteExpenseRow();
    }
  });
});

module.exports = router;