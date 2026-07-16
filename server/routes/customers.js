const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { upload } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { createCustomerSchema, updateCustomerSchema, openingBalanceSchema } = require('../schemas/customerSchemas');

// GET /api/customers — ?page & ?limit optional. Bina diye purana behavior (full array).
router.get('/', (req, res) => {
  const search = req.query.search;
  const { page, limit } = req.query;

  let whereClause = `WHERE deleted_at IS NULL`;
  let params = [];

  if (search) {
    whereClause += ` AND (firm_name LIKE ? OR contact_name LIKE ? OR phone LIKE ?)`;
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }

  const baseQuery = `SELECT * FROM customers ${whereClause} ORDER BY created_at ASC`;

  if (!page) {
    return db.all(baseQuery, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset   = (pageNum - 1) * limitNum;

  db.get(`SELECT COUNT(*) as total FROM customers ${whereClause}`, params, (err, countRow) => {
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

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    db.all(`SELECT * FROM orders WHERE customer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`, [id], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(`
        SELECT id, amount, payment_date as date,
          CASE
            WHEN payment_mode = 'upi' AND upi_account IS NOT NULL THEN upi_account
            WHEN payment_mode = 'upi' THEN 'UPI'
            WHEN payment_mode = 'cash' OR payment_mode IS NULL THEN 'Cash'
            ELSE payment_mode
          END as source,
          'Order Payment' as payment_type, payment_mode, upi_account, note, created_at
        FROM payments WHERE customer_id = ?
      `, [id], (err, orderPayments) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(`SELECT id, amount, transaction_date as date, upi_account as source, 'UPI' as payment_type, created_at FROM upi_transactions WHERE customer_id = ? AND order_id IS NULL AND (notes NOT LIKE 'EXPENSE:%' OR notes IS NULL)`, [id], (err, upiPayments) => {
          if (err) return res.status(500).json({ error: err.message });

          db.all(`SELECT id, amount, received_date as date, bank_name as source, status, cheque_number, 'Cheque' as payment_type FROM cheques WHERE customer_id = ?`, [id], (err, chequePayments) => {
            if (err) return res.status(500).json({ error: err.message });

            db.all(`
              SELECT 
                id, 
                amount, 
                income_date as date, 
                CASE 
                  WHEN payment_mode = 'upi' AND upi_account IS NOT NULL 
                  THEN upi_account 
                  ELSE COALESCE(notes, 'Cash') 
                END as source,
                CASE 
                  WHEN payment_mode = 'upi' THEN 'UPI'
                  ELSE 'Cash Income'
                END as payment_type,
                created_at
              FROM cash_income 
              WHERE customer_id = ?
              AND (notes IS NULL OR notes NOT IN ('Order Advance Payment', 'Order Payment'))
              AND (notes IS NULL OR notes NOT LIKE 'Cheque Cleared%')
              AND (notes IS NULL OR notes NOT LIKE 'Galla Opening Balance%')
            `, [id], (err, cashIncomePayments) => {
              if (err) return res.status(500).json({ error: err.message });

              db.all(`
                SELECT 
                  id,
                  amount,
                  expense_date as date,
                  CASE 
                    WHEN payment_mode = 'upi' AND upi_account IS NOT NULL 
                    THEN upi_account 
                    ELSE 'Cash' 
                  END as source,
                  'Commission' as payment_type,
                  description,
                  payment_mode,
                  upi_account,
                  created_at
                FROM expenses
                WHERE category = 'Commission'
                  AND customer_id = ?
                ORDER BY expense_date DESC
              `, [id], (err, commissionPayments) => {
                if (err) return res.status(500).json({ error: err.message });

                // Opening balance ab order nahi — customer.opening_balance field se
                // seedha yahan add hota hai.
                const totalBilled = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) + Number(customer.opening_balance || 0);
                const totalDiscount = orders.reduce((sum, o) => sum + Number(o.discount_amount || 0), 0);
                const totalAdvance = orders.reduce((sum, o) => sum + Number(o.advance_paid || 0), 0);
                const totalOrderPayments = orderPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalUpi = upiPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalChequeCleared = chequePayments
                  .filter(p => p.status === 'cleared')
                  .reduce((sum, p) => sum + Number(p.amount || 0), 0);
                // Pehle sirf 'Cash Income' type sum hota tha — UPI-mode cash_income
                // entries (payment_type='UPI') exclude ho jaati thi, kyunki pehle
                // inka ek mirror-row upi_transactions mein bhi banta tha (totalUpi
                // usko already count kar leta tha). Wo mirror-insert ab hata diya
                // gaya hai (UPI double-counting fix ke time) — isliye cash_income hi
                // in entries ka sole source hai, isse yahan bhi count karna zaroori
                // hai, warna Balance Due se ye paisa poora gayab ho jaata hai.
                const totalCashIncome = cashIncomePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                const totalCommission = commissionPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

                const totalPaid = totalAdvance + totalOrderPayments + totalUpi + totalChequeCleared + totalCashIncome;
                const totalDue = totalBilled - totalPaid - totalDiscount + totalCommission;

                const allPayments = [
                  ...orders.filter(o => o.advance_paid > 0).map(o => ({
                    id: `adv-${o.id}`,
                    amount: o.advance_paid,
                    date: o.created_at?.split('T')[0],
                    source: 'Advance Payment',
                    payment_type: 'Advance',
                    order_description: o.description
                  })),
                  ...orderPayments,
                  ...upiPayments,
                  ...chequePayments,
                  // Pehle UPI-type cash_income entries yahan se exclude hoti thi,
                  // assume karke ki unka duplicate upiPayments (upi_transactions)
                  // array mein already hai — jo purane mirror-insert ki wajah se sahi
                  // tha. Wo mirror ab nahi banta, isliye ab sab include kar rahe hain.
                  ...cashIncomePayments,
                  ...commissionPayments
                ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                res.json({
                  ...customer,
                  orders,
                  payments: allPayments,
                  totalBilled,
                  totalAdvance,
                  totalOrderPayments,
                  totalUpi,
                  totalChequeCleared,
                  totalCashIncome,
                  totalCommission,
                  totalPaid,
                  totalDiscount,
                  totalDue
                });
              }); // commissionPayments close
            }); // cashIncomePayments close
          }); // chequePayments close
        }); // upiPayments close
      }); // orderPayments close
    }); // orders close
  }); // customer close
});

// POST /api/customers
router.post('/', validate(createCustomerSchema), (req, res) => {
  const { firm_name, contact_name, phone } = req.body;

  db.run(`INSERT INTO customers (firm_name, contact_name, phone) VALUES (?, ?, ?)`,
    [firm_name, contact_name, phone], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, firm_name, contact_name, phone, message: 'Customer created successfully' });
    });
});

// PUT /api/customers/:id
router.put('/:id', validate(updateCustomerSchema), (req, res) => {
  const { id } = req.params;
  const { firm_name, contact_name, phone } = req.body;

  db.run(`UPDATE customers SET firm_name = ?, contact_name = ?, phone = ? WHERE id = ?`,
    [firm_name, contact_name, phone, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
      res.json({ message: 'Customer updated successfully' });
    });
});

// DELETE /api/customers/:id — soft delete
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = datetime('now', '+5 hours', '+30 minutes') WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted (recoverable for 30 days)' });
  });
});

// PUT /api/customers/:id/restore
router.put('/:id/restore', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE customers SET deleted_at = NULL WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Customer restored successfully' });
  });
});

// GET /api/customers/deleted/recent
router.get('/deleted/recent', (req, res) => {
  db.all(`
    SELECT * FROM customers 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at > datetime('now', '-30 days')
    ORDER BY deleted_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/customers/:id/opening-balance
// Pehle ye ek order create karta tha ('Opening Balance' description wala) —
// ab seedha customer record ke field mein jaata hai. Additive hai (jaisa
// pehle bhi tha — har "Add" click ek naya order jodta tha), taaki purana
// behavior/expectation na tootay.
router.post('/:id/opening-balance', validate(openingBalanceSchema), (req, res) => {
  const { id } = req.params;
  const { amount, date, notes } = req.body;

  const entryDate = date || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).split(' ')[0];

  db.get(`SELECT opening_balance FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const newBalance = Number(customer.opening_balance || 0) + Number(amount);

    db.run(`
      UPDATE customers
      SET opening_balance = ?, opening_balance_date = ?, opening_balance_notes = ?
      WHERE id = ?
    `, [newBalance, entryDate, notes || 'Pichle saal ka bakaya', id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ opening_balance: newBalance, message: 'Opening balance added successfully' });
    });
  });
});

// POST /api/customers/:id/photo
router.post('/:id/photo', upload.single('photo'), (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No photo file received' });
  }

  db.get(`SELECT photo_path FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Customer not found' });
    }

    const newPhotoPath = `uploads/customers/${req.file.filename}`;

    db.run(`UPDATE customers SET photo_path = ? WHERE id = ?`, [newPhotoPath, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      if (customer.photo_path) {
        const oldFullPath = path.join(__dirname, '..', customer.photo_path);
        fs.unlink(oldFullPath, () => {});
      }

      res.json({ message: 'Photo uploaded successfully', photo_path: newPhotoPath });
    });
  });
});

// DELETE /api/customers/:id/photo
router.delete('/:id/photo', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT photo_path FROM customers WHERE id = ? AND deleted_at IS NULL`, [id], (err, customer) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (!customer.photo_path) return res.status(400).json({ error: 'No photo to delete' });

    const fullPath = path.join(__dirname, '..', customer.photo_path);

    db.run(`UPDATE customers SET photo_path = NULL WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      fs.unlink(fullPath, () => {});
      res.json({ message: 'Photo removed successfully' });
    });
  });
});

module.exports = router;