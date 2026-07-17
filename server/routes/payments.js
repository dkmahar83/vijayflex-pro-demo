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
  // CUSTOMER-WISE, TRUE net-due formula — Dashboard ke all_dues jaisa hi
  // (orders + opening_balance - advance - order_payments - UPI - cleared
  // cheques - cash_income - discount + commission). orders_due neeche sirf
  // INFORMATIONAL hai; total_due hi asal sorting/filtering karta hai.
  db.all(`
    SELECT * FROM (
      SELECT
        c.id as customer_id,
        c.firm_name,
        c.contact_name,
        c.phone,
        COALESCE(oa.orders_due, 0) as orders_due,
        COALESCE(oa.orders_due_count, 0) as orders_due_count,
        COALESCE(c.opening_balance, 0) as opening_balance,
        oa.follow_up_date as follow_up_date,
        (
          COALESCE(oa.orders_total, 0) + COALESCE(c.opening_balance, 0)
          - COALESCE(oa.orders_advance, 0)
          - COALESCE(pay.total_order_payments, 0)
          - COALESCE(upi.total_upi, 0)
          - COALESCE(cheq.total_cheque_cleared, 0)
          - COALESCE(cash.total_cash_income, 0)
          - COALESCE(oa.orders_discount, 0)
          + COALESCE(comm.total_commission, 0)
        ) as total_due
      FROM customers c
      LEFT JOIN (
        SELECT customer_id,
          SUM(total_amount) as orders_total,
          SUM(discount_amount) as orders_discount,
          SUM(advance_paid) as orders_advance,
          SUM(CASE WHEN balance_due > 0 THEN balance_due ELSE 0 END) as orders_due,
          SUM(CASE WHEN balance_due > 0 THEN 1 ELSE 0 END) as orders_due_count,
          MIN(CASE WHEN balance_due > 0 THEN follow_up_date END) as follow_up_date
        FROM orders WHERE deleted_at IS NULL GROUP BY customer_id
      ) oa ON oa.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_order_payments FROM payments GROUP BY customer_id
      ) pay ON pay.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_upi FROM upi_transactions
        WHERE order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)
        GROUP BY customer_id
      ) upi ON upi.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_cheque_cleared FROM cheques WHERE status = 'cleared' GROUP BY customer_id
      ) cheq ON cheq.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_cash_income FROM cash_income
        WHERE (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment'))
          AND (notes IS NULL OR notes NOT LIKE 'Cheque Cleared%')
          AND (notes IS NULL OR notes NOT LIKE 'Galla Opening Balance%')
        GROUP BY customer_id
      ) cash ON cash.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as total_commission FROM expenses WHERE category = 'Commission' GROUP BY customer_id
      ) comm ON comm.customer_id = c.id
      WHERE c.deleted_at IS NULL
    )
    WHERE total_due > 0
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