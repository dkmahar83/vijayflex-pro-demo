const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { recalculateOrderBalance } = require('../utils/orderBalance');
const logger = require('../utils/logger');
const validate = require('../middleware/validate');
const { createChequeSchema, updateChequeStatusSchema, updateChequeSchema } = require('../schemas/chequeSchemas');

// Helper — store dates as YYYY-MM-DD always
function toISO(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // If DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

// GET /api/cheques
router.get('/', (req, res) => {
  const { status, month, year } = req.query;
  let query = `
    SELECT cheques.*, customers.firm_name as customer_firm
    FROM cheques
    LEFT JOIN customers ON cheques.customer_id = customers.id
    WHERE 1=1
  `;
  let params = [];

  if (status) {
    query += ` AND cheques.status = ?`;
    params.push(status);
  }
  if (month && year) {
    query += ` AND strftime('%m', cheques.received_date) = ? AND strftime('%Y', cheques.received_date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  query += ` ORDER BY cheques.received_date DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/cheques/summary?month=07&year=2026
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  let query = `SELECT status, COUNT(*) as count, SUM(amount) as total FROM cheques WHERE 1=1`;
  let params = [];

  // GET / (list) wala hi filter-pattern — pehle isme month/year ignore
  // ho raha tha, isliye cards month-select pe kabhi update nahi hote the.
  if (month && year) {
    query += ` AND strftime('%m', received_date) = ? AND strftime('%Y', received_date) = ?`;
    params.push(month.padStart(2, '0'), year);
  }
  query += ` GROUP BY status`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/cheques/:id — single cheque detail
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT cheques.*, customers.firm_name as customer_firm, customers.phone as customer_phone
    FROM cheques
    LEFT JOIN customers ON cheques.customer_id = customers.id
    WHERE cheques.id = ?
  `, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Cheque not found' });
    res.json(row);
  });
});

// POST /api/cheques
router.post('/', validate(createChequeSchema), (req, res) => {
  const { cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes } = req.body;

  const date = toISO(received_date);

  db.run(`
    INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [cheque_number || null, firm_name, customer_id || null, bank_name || null,
     amount, date, order_id || null, notes || null],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Cheque recorded' });
  });
});

// PUT /api/cheques/:id/status
router.put('/:id/status', validate(updateChequeStatusSchema), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.get(`SELECT * FROM cheques WHERE id = ?`, [id], (err, cheque) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cheque) return res.status(404).json({ error: 'Cheque not found' });

    db.run(`UPDATE cheques SET status = ? WHERE id = ?`, [status, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Cheque not found' });

      // When a cheque clears: (1) drop a "Cash Income" style entry on TODAY's date
      // so it appears in the Daily Ledger / cash flow, and (2) settle the linked order's balance.
      if (status === 'cleared' && cheque.status !== 'cleared') {
        const clearedDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
        const createdAt   = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

        db.run(`
          INSERT INTO cash_income (customer_id, amount, income_date, notes, payment_mode, upi_account, created_at)
          VALUES (?, ?, ?, ?, 'cheque', NULL, ?)
        `,
        [cheque.customer_id, cheque.amount, clearedDate,
         `Cheque Cleared${cheque.cheque_number ? ' #' + cheque.cheque_number : ''} (${cheque.firm_name})`,
         createdAt],
        (err) => {
          if (err) logger.error('Could not add cheque-cleared ledger entry: ' + err.message);
        });

        if (cheque.order_id) {
          recalculateOrderBalance(cheque.order_id, (err) => {
            if (err) logger.error('Balance recalc failed after cheque clear: ' + err.message);
          });
        }
      }

      res.json({ message: `Cheque marked as ${status}` });
    });
  });
});

// PUT /api/cheques/:id — update cheque details
router.put('/:id', validate(updateChequeSchema), (req, res) => {
  const { id } = req.params;
  const { cheque_number, bank_name, notes, received_date } = req.body;

  db.run(`
    UPDATE cheques SET cheque_number = ?, bank_name = ?, notes = ?, received_date = ?
    WHERE id = ?
  `, [cheque_number, bank_name, notes, toISO(received_date), id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cheque updated' });
  });
});

module.exports = router;