const express = require('express');
const router = express.Router();
const db = require('../db/database');
const logger = require('../utils/logger');

const UPI_ACCOUNTS = [
  'BOI Shop Account',
  'Google Pay - Rampratap Painter',
  'PhonePe - Bhavya Printers',
  'Amazon Pay - Deepak'
];

// GET all UPI transactions — ?page & ?limit optional. Bina diye purana behavior (full array).
router.get('/', (req, res) => {
  const { upi_account, month, year, page, limit } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  if (month && year) {
    dateFilter = `AND strftime('%m', transaction_date) = ? AND strftime('%Y', transaction_date) = ?`;
    params = [month.padStart(2,'0'), year];
  }

  let accountFilter = upi_account ? `AND upi_account = ?` : '';
  if (upi_account) params = [...params, upi_account, ...params, upi_account, ...params, upi_account];
  else params = [...params, ...params, ...params];

  const unionQuery = `
    SELECT id, upi_account, customer_name, customer_id, amount, transaction_date,
          utr_number, notes, 'credit' as direction, created_at, 'upi_transactions' as source
    FROM upi_transactions
    WHERE 1=1 ${dateFilter} ${accountFilter}

    UNION ALL

    SELECT cash_income.id, cash_income.upi_account, 
       customers.firm_name as customer_name,
       cash_income.customer_id, cash_income.amount, 
       cash_income.income_date as transaction_date,
       NULL as utr_number, cash_income.notes, 'credit' as direction, cash_income.created_at, 'cash_income' as source
    FROM cash_income
    LEFT JOIN customers ON cash_income.customer_id = customers.id
    WHERE cash_income.payment_mode = 'upi' AND cash_income.upi_account IS NOT NULL
    ${dateFilter.replace('transaction_date', 'income_date')} ${accountFilter}

    UNION ALL

    SELECT expenses.id, expenses.upi_account, 
           COALESCE(vendors.name, employees.name, expenses.category) as customer_name,
          NULL as customer_id, expenses.amount * -1 as amount,
          expenses.expense_date as transaction_date,
          NULL as utr_number, expenses.description as notes, 'debit' as direction, expenses.created_at, 'expense' as source
    FROM expenses
    LEFT JOIN vendors ON expenses.paid_to_type = 'vendor' AND expenses.paid_to_id = vendors.id
    LEFT JOIN employees ON expenses.paid_to_type = 'employee' AND expenses.paid_to_id = employees.id
    WHERE expenses.payment_mode = 'upi' AND expenses.upi_account IS NOT NULL
    ${dateFilter.replace('transaction_date', 'expense_date')} ${accountFilter}
  `;

  if (!page) {
    return db.all(`${unionQuery} ORDER BY transaction_date DESC`, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * limitNum;

  db.get(`SELECT COUNT(*) as total FROM (${unionQuery})`, params, (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`${unionQuery} ORDER BY transaction_date DESC LIMIT ? OFFSET ?`, [...params, limitNum, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: rows,
        page: pageNum,
        limit: limitNum,
        total: countRow.total,
        total_pages: Math.ceil(countRow.total / limitNum)
      });
    });
  });
});

// GET UPI account wise summary
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  let dateFilter = '';
  let params = month && year ? [month.padStart(2,'0'), year] : [];
  
  if (month && year) {
    dateFilter = `AND strftime('%m', d) = ? AND strftime('%Y', d) = ?`;
  }

  const query = `
    SELECT upi_account, COUNT(*) as count, SUM(amount) as total
    FROM (
      SELECT upi_account, amount, transaction_date as d FROM upi_transactions WHERE 1=1
      UNION ALL
      SELECT upi_account, amount, income_date as d FROM cash_income 
      WHERE payment_mode='upi' AND upi_account IS NOT NULL
      UNION ALL
      SELECT upi_account, amount * -1, expense_date as d FROM expenses 
      WHERE payment_mode='upi' AND upi_account IS NOT NULL
    )
    WHERE 1=1 ${dateFilter}
    GROUP BY upi_account
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ accounts: UPI_ACCOUNTS, summary: rows });
  });
});
// POST add UPI transaction
router.post('/', (req, res) => {
  const {
    upi_account,
    customer_name,
    customer_id,
    amount,
    transaction_date,
    utr_number,
    order_id,
    notes
  } = req.body;

  if (!upi_account || !amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({
      error: 'upi_account and a valid positive amount are required'
    });
  }
  let formattedDate;
    const createdAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

    if (transaction_date) {
      // Frontend (HTML date input) already sends YYYY-MM-DD — use as-is.
      // Only convert if it looks like DD-MM-YYYY (legacy/manual format).
      formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
        ? transaction_date
        : (() => {
            const parts = transaction_date.split('-');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              return `${year}-${month}-${day}`;
            }
            // Unrecognized format — garbage date insert karne ke bajaye IST-today fallback
            return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
          })();
    } else {
      // Poora app IST use karta hai — UTC ISO date yahan timezone-bug create karta tha
      formattedDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
    }

  db.run(
    `
    INSERT INTO upi_transactions 
    (upi_account, customer_name, customer_id, amount, transaction_date, utr_number, order_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      upi_account,
      customer_name,
      customer_id || null,
      amount,
      formattedDate,
      utr_number || null,
      order_id || null,
      notes || null,
      createdAt
    ],
    function (err) {
      if (err) {
        logger.error('UPI insert error: ' + err.message);
        return res.status(500).json({
          error: err.message
        });
      }

      res.status(201).json({
        id: this.lastID,
        message: 'UPI transaction recorded'
      });
    }
  );
});

module.exports = router;