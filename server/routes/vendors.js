const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────────
// GET all vendors (with running totals)
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  db.all(`SELECT * FROM vendors ORDER BY name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────────
// GET single vendor with transactions
// ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM vendors WHERE id = ?`, [id], (err, vendor) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    db.all(
      `SELECT * FROM vendor_transactions WHERE vendor_id = ? ORDER BY transaction_date DESC, created_at DESC`,
      [id],
      (err, transactions) => {
        if (err) return res.status(500).json({ error: err.message });

        // Parse items JSON + denomination breakdown for each transaction
        const parsed = transactions.map(t => {
          let denomination_breakdown = null;
          if (t.denomination_breakdown) {
            try { denomination_breakdown = JSON.parse(t.denomination_breakdown); }
            catch (e) { denomination_breakdown = null; } // corrupt/old data — silently ignore
          }
          return {
            ...t,
            items: t.items_json ? JSON.parse(t.items_json) : [],
            denomination_breakdown
          };
        });

        res.json({ ...vendor, transactions: parsed });
      }
    );
  });
});

// ─────────────────────────────────────────────
// POST add vendor
// ─────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, phone, shop_type, city, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(
    `INSERT INTO vendors (name, phone, shop_type, city, notes) VALUES (?, ?, ?, ?, ?)`,
    [name, phone, shop_type, city, notes],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Vendor added' });
    }
  );
});

// ─────────────────────────────────────────────
// PUT edit vendor details
// ─────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, shop_type, city, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(
    `UPDATE vendors SET name = ?, phone = ?, shop_type = ?, city = ?, notes = ? WHERE id = ?`,
    [name, phone, shop_type, city, notes, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Vendor not found' });
      res.json({ message: 'Vendor updated' });
    }
  );
});

// ─────────────────────────────────────────────
// DELETE vendor (and all their transactions)
// ─────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM vendor_transactions WHERE vendor_id = ?`, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM vendors WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Vendor not found' });
      res.json({ message: 'Vendor deleted' });
    });
  });
});

// ─────────────────────────────────────────────
// POST vendor purchase
// Body: { amount, description, transaction_date, items: [...] }
// items: [{ name, qty, unit, rate, amount }]
// ─────────────────────────────────────────────
router.post('/:id/purchase', (req, res) => {
  const { id } = req.params;
  const { amount, description, transaction_date, items = [] } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount required' });

  const txDate = transaction_date || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
  const itemsJson = JSON.stringify(items);

  db.run(
    `INSERT INTO vendor_transactions (vendor_id, type, amount, transaction_date, description, items_json, created_at)
      VALUES (?, 'purchase', ?, ?, ?, ?, ?)`,
      [id, amount, txDate, description, itemsJson,
      new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ')],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      // Update vendor running totals
      db.run(
        `UPDATE vendors SET
           total_purchased = total_purchased + ?,
           balance_due     = balance_due     + ?
         WHERE id = ?`,
        [amount, amount, id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: 'Purchase recorded' });
        }
      );
    }
  );
});

// ─────────────────────────────────────────────
// POST vendor payment
// Body: { amount, description, transaction_date,
//         payment_method: 'cash'|'upi'|'bank',
//         upi_account,          // if upi
//         bank_transfer_type }  // if bank: NEFT / RTGS / IMPS / NACH
//
// Side-effects:
//   → Always:  INSERT into expenses
//   → Always:  INSERT into daily_ledger
//   → If cash: INSERT into cash_drawer_entries  (debit — cash going out)
// ─────────────────────────────────────────────
router.post('/:id/payment', (req, res) => {
  const { id } = req.params;
  const {
    amount,
    description,
    transaction_date,
    payment_method = 'cash',
    upi_account = null,
    bank_transfer_type = null,
    denomination_breakdown = null
  } = req.body;

  // Frontend object bhejta hai (jaise { 500: 2, 100: 3 }), DB mein text column hai —
  // baaki jagah (expenses, orders, salary) jaisa hi JSON string bana ke store karo.
  const denominationJson = denomination_breakdown ? JSON.stringify(denomination_breakdown) : null;

  if (!amount) return res.status(400).json({ error: 'amount required' });

  const txDate = transaction_date || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];

  // Build a readable payment label
  let paymentLabel = 'Cash';
  if (payment_method === 'upi')  paymentLabel = `UPI (${upi_account || 'UPI'})`;
  if (payment_method === 'bank') paymentLabel = `Bank Transfer - ${bank_transfer_type || 'NEFT'}`;

  // First: get vendor name for ledger descriptions
  db.get(`SELECT name FROM vendors WHERE id = ?`, [id], (err, vendor) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const vendorName = vendor.name;
    const txDesc = description || `Payment to ${vendorName}`;
    const fullDesc = `${txDesc} [${paymentLabel}]`;

    // ── Step 1: Record vendor_transaction ──
    db.run(
      `INSERT INTO vendor_transactions
          (vendor_id, type, amount, transaction_date, description, payment_method, upi_account, bank_transfer_type, denomination_breakdown, created_at)
        VALUES (?, 'payment', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, amount, txDate, txDesc, payment_method, upi_account, bank_transfer_type, denominationJson,
        new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ')],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // ── Step 2: Update vendor totals ──
        db.run(
          `UPDATE vendors SET
             total_paid  = total_paid  + ?,
             balance_due = balance_due - ?
           WHERE id = ?`,
          [amount, amount, id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // ── Step 3: Record expense ──
            db.run(
              `INSERT INTO expenses (category, amount, expense_date, description, payment_mode, paid_to_type, paid_to_id, created_at)
              VALUES ('Vendor Payment', ?, ?, ?, ?, 'vendor', ?, ?)`,
              [amount, txDate, fullDesc, payment_method, id, new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ')],
                (err) => {
                  if (err) console.error('Expense insert error:', err.message);

                  // ── daily_records update ──
                  db.run(`
                    INSERT INTO daily_records (record_date, total_expenses)
                    VALUES (?, ?)
                    ON CONFLICT(record_date) DO UPDATE SET
                      total_expenses = total_expenses + excluded.total_expenses
                  `, [txDate, parseFloat(amount)], (err) => {
                    if (err) console.error('daily_records update error:', err.message);
                  });

                  // Purane "daily_ledger" aur "cash_drawer_entries" tables ab exist
                  // nahi karte — cash_income/expenses + denomination-drawer system
                  // inko replace kar chuka hai. Ye 2 INSERT calls hata di, jo har
                  // vendor payment pe silently "no such table" error de rahi thi.
                  res.status(201).json({ message: 'Payment recorded' });
              }
            );
          }
        );
      }
    );
  });
});

module.exports = router;