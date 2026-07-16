const express = require('express');
const router = express.Router();
const db = require('../db/database');

function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}
function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

// GET /api/commission — poori history (optional ?customer_id=X filter)
router.get('/', (req, res) => {
  const { customer_id } = req.query;
  let query = `
    SELECT ct.*, c.firm_name, c.phone
    FROM commission_transactions ct
    JOIN customers c ON ct.customer_id = c.id
    WHERE c.deleted_at IS NULL
  `;
  const params = [];
  if (customer_id) {
    query += ` AND ct.customer_id = ?`;
    params.push(customer_id);
  }
  query += ` ORDER BY ct.created_at DESC`;
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/commission/balance/:customerId — ek customer ka net balance
router.get('/balance/:customerId', (req, res) => {
  db.all(
    `SELECT type, amount FROM commission_transactions WHERE customer_id = ?`,
    [req.params.customerId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const balance = rows.reduce((sum, r) => {
        return r.type === 'credit' ? sum + r.amount : sum - r.amount;
      }, 0);
      res.json({ customer_id: req.params.customerId, balance });
    }
  );
});

// POST /api/commission/credit — commission credit karo (customer ne zyada diya)
router.post('/credit', (req, res) => {
  const { customer_id, amount, note, transaction_date } = req.body;
  if (!customer_id || !amount || amount <= 0)
    return res.status(400).json({ error: 'customer_id aur valid amount required hai' });

  const date = transaction_date || todayIST();
  const createdAt = nowIST();

  db.run(
    `INSERT INTO commission_transactions (customer_id, type, amount, note, transaction_date, created_at)
     VALUES (?, 'credit', ?, ?, ?, ?)`,
    [customer_id, parseInt(amount), note || null, date, createdAt],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Commission credit ho gaya' });
    }
  );
});

// POST /api/commission/return — commission wapas karo customer ko
router.post('/return', (req, res) => {
  const { customer_id, amount, return_mode, return_upi_account, cheque_number, bank_name, note, transaction_date } = req.body;
  if (!customer_id || !amount || amount <= 0)
    return res.status(400).json({ error: 'customer_id aur valid amount required hai' });
  if (return_mode === 'upi' && !return_upi_account)
    return res.status(400).json({ error: 'UPI ke liye account select karo' });

  // Pehle check karo ki balance enough hai
  db.all(
    `SELECT type, amount FROM commission_transactions WHERE customer_id = ?`,
    [customer_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const balance = rows.reduce((sum, r) => r.type === 'credit' ? sum + r.amount : sum - r.amount, 0);
      if (parseInt(amount) > balance)
        return res.status(400).json({ error: `Sirf ₹${balance} commission balance hai, ₹${amount} return nahi ho sakta` });

      const date = transaction_date || todayIST();
      const createdAt = nowIST();

      db.run(
        `INSERT INTO commission_transactions
           (customer_id, type, amount, return_mode, return_upi_account, cheque_number, bank_name, note, transaction_date, created_at)
         VALUES (?, 'return', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer_id, parseInt(amount), return_mode || 'cash',
         return_mode === 'upi' ? return_upi_account : null,
         return_mode === 'cheque' ? (cheque_number || null) : null,
         return_mode === 'cheque' ? (bank_name || null) : null,
         note || null, date, createdAt],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ id: this.lastID, message: 'Commission return ho gaya' });
        }
      );
    }
  );
});

module.exports = router;