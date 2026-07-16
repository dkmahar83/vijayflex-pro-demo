const express = require('express');
const router = express.Router();
const db = require('../db/database');
const validate = require('../middleware/validate');
const { createPaymentSchema } = require('../schemas/paymentSchemas');
const logger = require('../utils/logger');
const { recalculateOrderBalance } = require('../utils/orderBalance');

function parseToYMD(dateStr) {
  if (!dateStr) return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.split(' ')[0];
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2].split(' ')[0]}-${parts[1]}-${parts[0]}`;
  return dateStr.split(' ')[0];
}

function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

router.post('/', validate(createPaymentSchema), (req, res) => {
  const { order_id, customer_id, amount, payment_date, note, payment_mode, upi_account, cheque_number, bank_name, denomination_breakdown } = req.body;

  const cleanDate = parseToYMD(payment_date);
  const cleanMode = payment_mode || 'cash';
  const cleanUpi  = (cleanMode === 'upi' && upi_account) ? upi_account : null;
  const createdAt = nowIST();

  // Cheque payments go to the cheques table, not the payments table —
  // they only count as real cash once cleared (handled in cheques.js)
  if (cleanMode === 'cheque') {
    return db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run(`
          INSERT INTO cheques (cheque_number, firm_name, customer_id, bank_name, amount, received_date, order_id, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [cheque_number || null, customer ? customer.firm_name : '', customer_id, bank_name || null,
         amount, cleanDate, order_id, note || 'Order Payment'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });

          // Note: balance_due is NOT reduced here — order stays "due" until cheque clears.
          // Mark cleared in Accounts > Cheques, which will then settle the order balance.
          res.status(201).json({
            id:       this.lastID,
            order_id,
            amount,
            payment_mode: 'cheque',
            message:  'Cheque recorded — balance will update once cheque is marked cleared'
          });
        });
      });
    });
  }

  db.get(`SELECT * FROM orders WHERE id = ?`, [order_id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const breakdownToSave = (cleanMode === 'cash' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
      ? JSON.stringify(denomination_breakdown)
      : null;

    db.run(`
      INSERT INTO payments (order_id, customer_id, amount, payment_date, note, payment_mode, upi_account, created_at, denomination_breakdown)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [order_id, customer_id, amount, cleanDate, note || '', cleanMode, cleanUpi, createdAt, breakdownToSave],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const payment_id = this.lastID;

      recalculateOrderBalance(order_id, (err, new_balance) => {
        if (err) return res.status(500).json({ error: err.message });

          // ✅ UPI payment ko upi_transactions me bhi mirror karo
          if (cleanMode === 'upi' && cleanUpi) {
            db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
              if (err) logger.error('Could not fetch customer for UPI record: ' + err.message);

              db.run(`
                INSERT INTO upi_transactions 
                  (upi_account, customer_name, customer_id, amount, transaction_date, notes, order_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                cleanUpi,
                customer ? customer.firm_name : null,
                customer_id,
                amount,
                cleanDate,
                note || 'Order Payment',
                order_id,
                createdAt
              ],
              (err) => {
                if (err) logger.error('UPI transaction insert failed: ' + err.message);
              });
            });
          }

          res.status(201).json({
            id:              payment_id,
            order_id,
            amount,
            payment_date:    cleanDate,
            payment_mode:    cleanMode,
            upi_account:     cleanUpi,
            new_balance_due: new_balance,
            message:         'Payment recorded successfully'
          });
        });
      });
    });
  });

router.get('/dues', (req, res) => {
  // CUSTOMER-WISE ab, Dashboard ke all_dues jaisa. 2 fixes ek saath:
  // (1) opening_balance ab include hota hai, warna aise customers invisible
  //     rehte jinka poora due sirf opening-balance se ho.
  // (2) orders.deleted_at IS NULL filter add kiya — pehle missing tha, isliye
  //     soft-deleted orders ka due bhi galti se yahan leak ho sakta tha.
  db.all(`
    SELECT
      customers.id as customer_id,
      customers.firm_name,
      customers.contact_name,
      customers.phone,
      COALESCE(SUM(orders.balance_due), 0) as orders_due,
      COUNT(orders.id) as orders_due_count,
      COALESCE(customers.opening_balance, 0) as opening_balance,
      (COALESCE(SUM(orders.balance_due), 0) + COALESCE(customers.opening_balance, 0)) as total_due,
      MIN(orders.follow_up_date) as follow_up_date
    FROM customers
    LEFT JOIN orders
      ON orders.customer_id = customers.id
      AND orders.balance_due > 0
      AND orders.deleted_at IS NULL
    WHERE customers.deleted_at IS NULL
    GROUP BY customers.id
    HAVING (COALESCE(SUM(orders.balance_due), 0) + COALESCE(customers.opening_balance, 0)) > 0
    ORDER BY follow_up_date ASC, total_due DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/order/:order_id', (req, res) => {
  const { order_id } = req.params;
  db.all(`
    SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC
  `, [order_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;