const db = require('../db/database');

// Single source of truth for order balance:
// balance_due = total_amount - advance_paid - discount_amount - SUM(payments) - SUM(cleared cheques)
// Har jagah jahan balance_due recalculate karna ho (payment add, discount change,
// cheque clear, item edit) — yahi function call karo, formula kahin aur mat likho.
function recalculateOrderBalance(orderId, callback) {
  db.get(`SELECT total_amount, advance_paid, discount_amount FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) return callback(err);
    if (!order) return callback(new Error('Order not found'));

    db.get(`SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE order_id = ?`, [orderId], (err, p) => {
      if (err) return callback(err);

      db.get(`SELECT COALESCE(SUM(amount), 0) as cleared FROM cheques WHERE order_id = ? AND status = 'cleared'`, [orderId], (err, c) => {
        if (err) return callback(err);

        const balance = Math.max(0,
          order.total_amount
          - (order.advance_paid || 0)
          - (order.discount_amount || 0)
          - p.paid
          - c.cleared
        );

        db.run(`UPDATE orders SET balance_due = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [balance, orderId], (err) => {
            if (err) return callback(err);
            callback(null, balance);
          });
      });
    });
  });
}

module.exports = { recalculateOrderBalance };