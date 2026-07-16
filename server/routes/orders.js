const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { uploadOrder } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { createOrderSchema, updateOrderSchema, updateOrderItemsSchema } = require('../schemas/orderSchemas');
const { recalculateOrderBalance } = require('../utils/orderBalance');
const logger = require('../utils/logger');

// ─────────────────────────────────────────
// GET /api/orders — ?page & ?limit optional. Bina diye purana behavior (full array).
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, customer_id, search, page, limit } = req.query;

  let whereClause = `WHERE 1=1 AND orders.deleted_at IS NULL`;
  let params = [];

  if (status) { whereClause += ` AND orders.status = ?`; params.push(status); }
  if (customer_id) { whereClause += ` AND orders.customer_id = ?`; params.push(customer_id); }
  if (search) {
    whereClause += ` AND (customers.firm_name LIKE ? OR orders.description LIKE ? OR orders.order_number LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const fromJoin = `FROM orders JOIN customers ON orders.customer_id = customers.id ${whereClause}`;
  const baseQuery = `SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone ${fromJoin} ORDER BY orders.created_at DESC`;

  if (!page) {
    return db.all(baseQuery, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * limitNum;

  db.get(`SELECT COUNT(*) as total ${fromJoin}`, params, (err, countRow) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`${baseQuery} LIMIT ? OFFSET ?`, [...params, limitNum, offset], (err, rows) => {
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

// ─────────────────────────────────────────
// GET /api/orders/:id
// ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`
    SELECT orders.*, customers.firm_name, customers.contact_name, customers.phone
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?
  `, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.all(`SELECT * FROM order_items WHERE order_id = ?`, [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`SELECT * FROM payments WHERE order_id = ?`, [id], (err, payments) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT * FROM cheques WHERE order_id = ? ORDER BY received_date ASC`, [id], (err, cheques) => {
          if (err) return res.status(500).json({ error: err.message });

          db.all(`SELECT * FROM order_activity_log WHERE order_id = ? ORDER BY created_at DESC`, [id], (err, activityLog) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ ...order, items, payments, cheques, activityLog: activityLog || [] });
          });
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// HELPER: Get IST timestamp string for consistent storage
// Use this everywhere — never new Date().toISOString() (gives UTC)
// ─────────────────────────────────────────
function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

function todayIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];
}

// ─────────────────────────────────────────
// HELPER: Generate next order number for a given year
// Format: VF-YYYY-NNNNNN
// Finds the highest existing sequence for that year and increments it.
// Thread-safe enough for SQLite single-process servers.
// ─────────────────────────────────────────
function generateOrderNumber(year, callback) {
  const prefix = `VF-${year}-`;

  db.get(
    `SELECT order_number FROM orders
     WHERE order_number LIKE ?
     ORDER BY order_number DESC
     LIMIT 1`,
    [`${prefix}%`],
    (err, row) => {
      if (err) return callback(err);

      let nextSeq = 1;
      if (row && row.order_number) {
        const parts = row.order_number.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }

      const orderNumber = `${prefix}${String(nextSeq).padStart(6, '0')}`;
      callback(null, orderNumber);
    }
  );
}

// ─────────────────────────────────────────
// HELPER: Record advance payment into ALL financial tables
//
// Single source of truth for order advance payments.
// Every advance must appear in:
//   1. customer_payments   → Customer Profile payment history
//   2. cash_income         → Daily Sales "Payments from Orders", Cash Drawer, Daily Ledger
//      OR upi_transactions → Daily Sales "Payments from Orders", UPI Accounts, Daily Ledger
//
// Called on order create and when advance is edited.
// ─────────────────────────────────────────
function recordAdvancePayment({ customer_id, firm_name, advance, payment_mode, upi_account, order_id, date }, callback) {
  const createdAt = nowIST();
  const notes = `Order Advance Payment`;

  db.run(`
    INSERT INTO customer_payments
      (customer_id, amount, payment_mode, payment_date, source, source_id, notes, created_at)
    VALUES (?, ?, ?, ?, 'order_advance', ?, ?, ?)
  `,
  [customer_id, advance, payment_mode, date, order_id, notes, createdAt],
  function(cpErr) {
    if (cpErr) console.warn('customer_payments insert skipped:', cpErr.message);

    if (payment_mode === 'upi') {
      db.run(`
        INSERT INTO upi_transactions
          (upi_account, customer_name, customer_id, amount, transaction_date, notes, order_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [upi_account, firm_name, customer_id, advance, date, notes, order_id, createdAt],
      function(err) {
        if (err) return callback(err);
        callback(null, { table: 'upi_transactions', id: this.lastID });
      });
    } else {
      db.run(`
        INSERT INTO cash_income
          (customer_id, amount, income_date, notes, payment_mode, upi_account, created_at)
        VALUES (?, ?, ?, ?, 'cash', NULL, ?)
      `,
      [customer_id, advance, date, notes, createdAt],
      function(err) {
        if (err) return callback(err);
        callback(null, { table: 'cash_income', id: this.lastID });
      });
    }
  });
}

// ─────────────────────────────────────────
// HELPER: Delete a previously recorded advance entry
// ─────────────────────────────────────────
function deleteAdvanceEntry({ advance_entry_table, advance_entry_id, order_id }, callback) {
  if (order_id) {
    db.run(
      `DELETE FROM customer_payments WHERE source = 'order_advance' AND source_id = ?`,
      [order_id],
      (err) => { if (err) console.warn('customer_payments delete skipped:', err.message); }
    );
  }

  if (!advance_entry_table || !advance_entry_id) return callback(null);

  const table = advance_entry_table === 'upi_transactions' ? 'upi_transactions' : 'cash_income';
  db.run(`DELETE FROM ${table} WHERE id = ?`, [advance_entry_id], callback);
}

// ─────────────────────────────────────────
// POST /api/orders — Create a new order
// ─────────────────────────────────────────
router.post('/', validate(createOrderSchema), (req, res) => {
  const {
    customer_id,
    description,
    advance_paid,
    advance_payment_mode,
    advance_upi_account,
    follow_up_date,
    notes,
    items,
    discount_amount,
    discount_note,
    advance_denomination_breakdown,
    advance_payment_date
  } = req.body;

  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });

  const advance  = parseFloat(advance_paid) || 0;
  const discount = parseFloat(discount_amount) || 0;

  if (advance > 0 && !advance_payment_mode) {
    return res.status(400).json({ error: 'advance_payment_mode is required when advance_paid > 0' });
  }
  if (advance > 0 && advance_payment_mode === 'upi' && !advance_upi_account) {
    return res.status(400).json({ error: 'advance_upi_account is required when payment mode is UPI' });
  }

  const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const balance_due  = total_amount - advance - discount;
  const today        = todayIST();
  const createdAt    = nowIST();
  const year         = new Date().getFullYear();

  db.get(`SELECT firm_name FROM customers WHERE id = ?`, [customer_id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Generate order number first, then insert
    generateOrderNumber(year, (err, orderNumber) => {
      if (err) return res.status(500).json({ error: 'Could not generate order number: ' + err.message });

      const breakdownToSave = (advance > 0 && advance_payment_mode === 'cash' && advance_denomination_breakdown && Object.keys(advance_denomination_breakdown).length > 0)
        ? JSON.stringify(advance_denomination_breakdown)
        : null;

      db.run(`
        INSERT INTO orders
          (customer_id, description, status, total_amount, advance_paid, balance_due,
           advance_payment_mode, follow_up_date, notes, advance_entry_table, advance_entry_id,
           discount_amount, discount_note, created_at, advance_denomination_breakdown, order_number)
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
      `,
      [customer_id, description, total_amount, advance, balance_due,
       advance > 0 ? advance_payment_mode : null,
       follow_up_date, notes,
       discount, discount_note || null, createdAt, breakdownToSave, orderNumber],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const order_id = this.lastID;

        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, item_name, quantity, unit_price, subtotal, length, breadth, item_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        items.forEach(item => {
          insertItem.run([order_id, item.item_name, item.quantity, item.unit_price,
                          item.quantity * item.unit_price,
                          item.length || null, item.breadth || null,
                          item.item_date || today]);
        });
        insertItem.finalize();

        if (advance > 0) {
          recordAdvancePayment({
            customer_id,
            firm_name: customer.firm_name,
            advance,
            payment_mode: advance_payment_mode,
            upi_account: advance_upi_account,
            order_id,
            date: advance_payment_date || today
          }, (err, entry) => {
            if (err) return res.status(500).json({ error: 'Order created but advance entry failed: ' + err.message });

            db.run(`
              UPDATE orders SET advance_entry_table = ?, advance_entry_id = ? WHERE id = ?
            `, [entry.table, entry.id, order_id], (err) => {
              if (err) logger.error('Could not save advance_entry ref: ' + err.message);
            });

            res.status(201).json({
              id: order_id, order_number: orderNumber, customer_id, total_amount,
              advance_paid: advance, balance_due, status: 'pending',
              advance_payment_mode,
              message: `Order ${orderNumber} created and advance recorded in financial ledger`
            });
          });
        } else {
          res.status(201).json({
            id: order_id, order_number: orderNumber, customer_id, total_amount,
            advance_paid: 0, balance_due, status: 'pending',
            message: `Order ${orderNumber} created successfully`
          });
        }
      });
    });
  });
});

router.put('/:id/follow-up', (req, res) => {
  const { id } = req.params;
  const { follow_up_date } = req.body;
  db.run(
    `UPDATE orders SET follow_up_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [follow_up_date, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });
      res.json({ message: 'Follow-up date updated' });
    }
  );
});

// ─────────────────────────────────────────
// PUT /api/orders/:id/status
// ─────────────────────────────────────────
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'in_progress', 'ready', 'delivered'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  db.run(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });
      res.json({ message: `Order status updated to ${status}` });
    });
});

// ─────────────────────────────────────────
// PUT /api/orders/:id — Update order details
// ─────────────────────────────────────────
router.put('/:id', validate(updateOrderSchema), (req, res) => {
  const { id } = req.params;
  const {
    description,
    notes,
    follow_up_date,
    advance_paid,
    advance_payment_mode,
    advance_upi_account,
    discount_amount,
    discount_note
  } = req.body;

  db.get(`
    SELECT orders.*, customers.firm_name
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.id = ?
  `, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const new_advance     = advance_paid !== undefined ? parseFloat(advance_paid) || 0 : order.advance_paid;
    const new_discount    = discount_amount !== undefined ? parseFloat(discount_amount) || 0 : (order.discount_amount || 0);
    const new_balance     = order.total_amount - new_advance - new_discount;
    const advance_changed = new_advance !== order.advance_paid;
    const today           = todayIST();

    if (advance_changed && new_advance > 0 && !advance_payment_mode) {
      return res.status(400).json({ error: 'advance_payment_mode is required when advance_paid > 0' });
    }
    if (advance_changed && new_advance > 0 && advance_payment_mode === 'upi' && !advance_upi_account) {
      return res.status(400).json({ error: 'advance_upi_account is required for UPI mode' });
    }

    const doUpdate = (entryTable, entryId) => {
      db.run(`UPDATE orders SET description=?, notes=?, follow_up_date=?,
              advance_paid=?, advance_payment_mode=?,
              advance_entry_table=?, advance_entry_id=?,
              discount_amount=?, discount_note=?,
              updated_at=CURRENT_TIMESTAMP
              WHERE id=?`,
        [
          description !== undefined ? description : order.description,
          notes !== undefined ? notes : order.notes,
          follow_up_date !== undefined ? follow_up_date : order.follow_up_date,
          new_advance,
          new_advance > 0 ? (advance_payment_mode || order.advance_payment_mode) : null,
          entryTable || order.advance_entry_table, entryId || order.advance_entry_id,
          new_discount, discount_note !== undefined ? discount_note : (order.discount_note || null),
          id
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          recalculateOrderBalance(id, (err, fresh_balance) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Order updated successfully', balance_due: fresh_balance });
          });
        });
    };

    if (!advance_changed) {
      return doUpdate(order.advance_entry_table, order.advance_entry_id);
    }

    deleteAdvanceEntry({
      advance_entry_table: order.advance_entry_table,
      advance_entry_id:    order.advance_entry_id,
      order_id:            parseInt(id)
    }, (err) => {
      if (err) logger.error('Could not delete old advance entry: ' + err.message);

      if (new_advance <= 0) {
        return doUpdate(null, null);
      }

      recordAdvancePayment({
        customer_id:  order.customer_id,
        firm_name:    order.firm_name,
        advance:      new_advance,
        payment_mode: advance_payment_mode,
        upi_account:  advance_upi_account,
        order_id:     parseInt(id),
        date:         today
      }, (err, entry) => {
        if (err) {
          logger.error('Advance re-record failed: ' + err.message);
          return doUpdate(null, null);
        }
        doUpdate(entry.table, entry.id);
      });
    });
  });
});

// ─────────────────────────────────────────
// DELETE /api/orders/:id — Soft delete
// ─────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT advance_entry_table, advance_entry_id FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });

    db.run(`UPDATE orders SET deleted_at = datetime('now', '+5 hours', '+30 minutes') WHERE id = ?`, [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Order not found' });

      db.run(`DELETE FROM payments WHERE order_id = ?`, [id], (err) => {
        if (err) logger.error('Could not delete payments: ' + err.message);
      });

      db.run(`DELETE FROM cash_income WHERE notes = 'Order Payment' AND customer_id = (
        SELECT customer_id FROM orders WHERE id = ?
      )`, [id], (err) => {
        if (err) logger.error('Could not delete cash_income payments: ' + err.message);
      });

      db.run(`DELETE FROM upi_transactions WHERE order_id = ? AND notes != 'Order Advance Payment'`, [id], (err) => {
        if (err) logger.error('Could not delete upi payments: ' + err.message);
      });

      if (order && order.advance_entry_table && order.advance_entry_id) {
        deleteAdvanceEntry({
          advance_entry_table: order.advance_entry_table,
          advance_entry_id:    order.advance_entry_id,
          order_id:            parseInt(id)
        }, (err) => {
          if (err) logger.error('Could not remove advance entry on delete: ' + err.message);
        });
      }

      res.json({ message: 'Order deleted (recoverable for 30 days)' });
    });
  });
});

// ─────────────────────────────────────────
// PUT /api/orders/:id/restore
// ─────────────────────────────────────────
router.put('/:id/restore', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE orders SET deleted_at = NULL WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Order restored successfully' });
  });
});

// ─────────────────────────────────────────
// GET /api/orders/deleted/recent
// ─────────────────────────────────────────
router.get('/deleted/recent', (req, res) => {
  db.all(`
    SELECT orders.*, customers.firm_name
    FROM orders
    JOIN customers ON orders.customer_id = customers.id
    WHERE orders.deleted_at IS NOT NULL
    AND orders.deleted_at > datetime('now', '-30 days')
    ORDER BY orders.deleted_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// PUT /api/orders/:id/items — replace all items
// ─────────────────────────────────────────
router.put('/:id/items', validate(updateOrderItemsSchema), (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  const total_amount = items.reduce((sum, item) =>
    sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);

  db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.run(`DELETE FROM order_items WHERE order_id = ?`, [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const stmt = db.prepare(`
        INSERT INTO order_items (order_id, item_name, quantity, unit_price, subtotal, length, breadth, item_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach(item => {
        const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
        stmt.run([id, item.item_name, item.quantity, item.unit_price, subtotal,
                  item.length || null, item.breadth || null,
                  item.item_date || todayIST()]);
      });
      stmt.finalize();

      db.run(`UPDATE orders SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [total_amount, id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          recalculateOrderBalance(id, (err, new_balance) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Items updated', total_amount, balance_due: new_balance });
          });
        });
    });
  });
});

// GET /api/orders/:id/photos
router.get('/:id/photos', (req, res) => {
  db.all(
    `SELECT * FROM order_photos WHERE order_id = ? ORDER BY uploaded_at ASC`,
    [req.params.id],
    (err, photos) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(photos);
    }
  );
});

// POST /api/orders/:id/photos
router.post('/:id/photos', uploadOrder.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo received' });

  const photoPath = `uploads/orders/${req.file.filename}`;
  const uploadedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');

  db.run(
    `INSERT INTO order_photos (order_id, photo_path, caption, uploaded_at) VALUES (?, ?, ?, ?)`,
    [req.params.id, photoPath, req.body.caption || null, uploadedAt],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, photo_path: photoPath });
    }
  );
});

// DELETE /api/orders/:id/photos/:photoId
router.delete('/:id/photos/:photoId', (req, res) => {
  db.get(
    `SELECT * FROM order_photos WHERE id = ? AND order_id = ?`,
    [req.params.photoId, req.params.id],
    (err, photo) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!photo) return res.status(404).json({ error: 'Photo not found' });

      db.run(`DELETE FROM order_photos WHERE id = ?`, [photo.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        const fullPath = path.join(__dirname, '..', photo.photo_path);
        fs.unlink(fullPath, () => {});
        res.json({ message: 'Photo deleted' });
      });
    }
  );
});

module.exports = router;