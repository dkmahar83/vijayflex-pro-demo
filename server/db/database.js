const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

// Database file will be created at server/db/flexshop.db
const DB_PATH = path.join(__dirname, 'flexshop.db');

// Connect to SQLite database (creates file if it doesn't exist)
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    logger.error('Error connecting to database: ' + err.message);
  } else {
    logger.info('Connected to SQLite database.');
  }
});

db.DB_PATH = DB_PATH;

// ═══════════════════════════════════════════════════════════════════════
// IMPORTANT: db.serialize() ke bina, sqlite3 module db.run() calls ka
// execution order guarantee NAHI karta — even agar wo code mein ek ke
// baad ek sequentially likhe hon. Isliye pura schema setup (tables →
// columns → indexes → backfill) EK hi serialize() block ke andar hai.
// Isse fresh database par bhi sahi order mein chalega.
// ═══════════════════════════════════════════════════════════════════════
db.serialize(() => {

  // Enable foreign keys (SQLite has them off by default)
  db.run('PRAGMA foreign_keys = ON');

  // ── PHASE 1: Create all tables ──────────────────────────────────────

  // Create employee_salary_credits table
  db.run(`CREATE TABLE IF NOT EXISTS employee_salary_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year TEXT NOT NULL,
    salary_amount REAL NOT NULL,
    credited_date TEXT DEFAULT CURRENT_DATE,
    notes TEXT,
    payment_mode TEXT DEFAULT 'cash',
    upi_account TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS cash_drawer_baseline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    denomination_counts TEXT NOT NULL,
    set_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  )`);

  // App-wide ON/OFF settings (simple key-value store) — abhi sirf
  // note-tracking toggle ke liye, future mein aur settings bhi isi mein ja sakti hain.
  db.run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    caption TEXT DEFAULT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS upi_qr_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upi_account TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    payee_name TEXT,
    amount REAL NOT NULL,
    remarks TEXT,
    paid INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    activity TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`)

  // 1. CUSTOMERS
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firm_name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. ORDERS
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    total_amount REAL DEFAULT 0,
    advance_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    follow_up_date TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // 3. ORDER ITEMS (line items like flex, pipe, labour)
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  // 4. PAYMENTS
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT DEFAULT CURRENT_DATE,
    note TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // 4b. CUSTOMER PAYMENTS (customer-wide payment history — used by Customer Profile page)
  db.run(`CREATE TABLE IF NOT EXISTS customer_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT DEFAULT 'cash',
    payment_date TEXT DEFAULT CURRENT_DATE,
    source TEXT,
    source_id INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  // 5. EMPLOYEES
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    monthly_salary REAL DEFAULT 0,
    join_date TEXT,
    is_active INTEGER DEFAULT 1
  )`);
  // Employee salary credits (for recording monthly salary payments)
  db.run(`
  CREATE TABLE IF NOT EXISTS employee_salary_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year TEXT NOT NULL,
    salary_amount REAL NOT NULL,
    credited_date TEXT DEFAULT CURRENT_DATE,
    notes TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )
  `)

  // 6. ATTENDANCE
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  // Purane duplicate rows (same employee_id+date) hatao — UNIQUE index se
  // pehle zaroori hai, warna index creation fail hogi. Har startup pe
  // chalna safe hai: ek baar dedupe hone ke baad ye kuch match nahi karega.
  db.run(`
    DELETE FROM attendance
    WHERE id NOT IN (
      SELECT MAX(id) FROM attendance GROUP BY employee_id, date
    )
  `);

  // Ab se ek employee ka ek date pe sirf ek hi row ban sakega.
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)`);

  // 7. DAILY RECORDS (sales + expenses per day)
  db.run(`CREATE TABLE IF NOT EXISTS daily_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date TEXT UNIQUE,
    total_sales REAL DEFAULT 0,
    total_expenses REAL DEFAULT 0,
    notes TEXT
  )`);

  // 8. EXPENSE CATEGORIES
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    expense_date TEXT DEFAULT CURRENT_DATE,
    description TEXT,
    daily_record_id INTEGER,
    FOREIGN KEY (daily_record_id) REFERENCES daily_records(id)
  )`);

  // 9. FLEX INVENTORY
  db.run(`CREATE TABLE IF NOT EXISTS flex_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gsm_type TEXT NOT NULL,
    roll_width_ft REAL,
    total_meters REAL DEFAULT 0,
    remaining_meters REAL DEFAULT 0,
    supplier_name TEXT,
    purchase_date TEXT DEFAULT CURRENT_DATE,
    cost_paid REAL DEFAULT 0,
    notes TEXT
  )`);

  // 10. SUPPLIERS
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    notes TEXT
  )`);

  // 11. PRICE MASTER (your standard rates)
  db.run(`CREATE TABLE IF NOT EXISTS price_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    unit TEXT,
    default_price REAL DEFAULT 0,
    description TEXT
  )`);

  // 12. CHEQUES REGISTER
  db.run(`CREATE TABLE IF NOT EXISTS cheques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cheque_number TEXT,
    firm_name TEXT NOT NULL,
    customer_id INTEGER,
    bank_name TEXT,
    amount REAL NOT NULL,
    received_date TEXT DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'received',
    order_id INTEGER,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  // 13. UPI TRANSACTIONS
  db.run(`CREATE TABLE IF NOT EXISTS upi_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upi_account TEXT NOT NULL,
    customer_name TEXT,
    customer_id INTEGER,
    amount REAL NOT NULL,
    transaction_date TEXT DEFAULT CURRENT_DATE,
    utr_number TEXT,
    order_id INTEGER,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  // 14. VENDORS
  db.run(`CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    shop_type TEXT,
    city TEXT,
    total_purchased REAL DEFAULT 0,
    total_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    notes TEXT
  )`);

  // 15. VENDOR TRANSACTIONS
  db.run(`CREATE TABLE IF NOT EXISTS vendor_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_date TEXT DEFAULT CURRENT_DATE,
    description TEXT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  )`);

  // NEW: cash_income table — links manual cash entries to a customer
  db.run(`CREATE TABLE IF NOT EXISTS cash_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    income_date TEXT DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employee_salary_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year TEXT NOT NULL,
    salary_amount REAL NOT NULL,
    credited_date TEXT DEFAULT CURRENT_DATE,
    notes TEXT,
    payment_mode TEXT DEFAULT 'cash',
    upi_account TEXT DEFAULT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`)

  // INVENTORY TABLES

  // Flex Roll Stock
  db.run(`CREATE TABLE IF NOT EXISTS inventory_flex (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    size_ft REAL NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'roll',
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Stamp Inventory
  db.run(`CREATE TABLE IF NOT EXISTS inventory_stamps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stamp_type TEXT NOT NULL,
    size TEXT,
    design_type TEXT,
    quantity INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Chemical / Bond Inventory
  db.run(`CREATE TABLE IF NOT EXISTS inventory_chemicals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chemical_name TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'litre',
    minimum_stock REAL DEFAULT 0,
    notes TEXT,
    items_per_box INTEGER DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Photo Frame Inventory
  db.run(`CREATE TABLE IF NOT EXISTS inventory_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frame_type TEXT NOT NULL,
    size TEXT,
    design TEXT,
    quantity INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Ink & Solvent Inventory
  db.run(`CREATE TABLE IF NOT EXISTS inventory_ink (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT NOT NULL,
    item_type TEXT DEFAULT 'ink',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'litre',
    minimum_level REAL DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Inventory transaction log (har add/use ka record)
  db.run(`CREATE TABLE IF NOT EXISTS inventory_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT,
    action TEXT NOT NULL,
    quantity_changed REAL NOT NULL,
    quantity_before REAL,
    quantity_after REAL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Dynamic Inventory Categories (custom category system — used by /categories routes)
  db.run(`CREATE TABLE IF NOT EXISTS inventory_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    attr1_label TEXT DEFAULT 'Size',
    attr2_label TEXT DEFAULT 'Type',
    unit_default TEXT DEFAULT 'pcs',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_dynamic_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    attr1 TEXT,
    attr2 TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    minimum_stock REAL DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── PHASE 2: Add new columns to existing tables (idempotent migrations) ──

  // Add new columns to expenses if they don't exist
  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_type TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN utr_number TEXT DEFAULT NULL`, () => {})

  // Add soft delete columns if they don't exist yet
  db.run(`ALTER TABLE customers ADD COLUMN deleted_at DATETIME DEFAULT NULL`, () => {})
  // Add photo_path column for customer photo upload feature
  db.run(`ALTER TABLE customers ADD COLUMN photo_path TEXT DEFAULT NULL`, () => {})
  // Opening Balance ab order nahi — customer record pe seedha field. Order
  // banne se status/follow-up/items jaisi cheezein attach ho jaati thi jo
  // iske liye meaningless hain (khud "delivered" kaise hoga ek khata?).
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance_date TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE customers ADD COLUMN opening_balance_notes TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN deleted_at DATETIME DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_type TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN paid_to_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN utr_number TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE employee_salary_credits ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE employee_salary_credits ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE cash_income ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE cash_income ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_payment_mode TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_entry_table TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_entry_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE cash_income ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE upi_transactions ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN payment_mode TEXT DEFAULT 'cash'`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`UPDATE payments SET payment_mode = 'cash' WHERE payment_mode IS NULL`, () => {})
  // Denomination breakdown columns (optional, JSON string) for cash forms
  db.run(`ALTER TABLE cash_income ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE payments ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE employee_salary_credits ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})

  // Commission entries expenses table ke through hoti hain
  // expenses table mein customer_id column add karo
  db.run(`ALTER TABLE expenses ADD COLUMN customer_id INTEGER DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE expenses ADD COLUMN customer_name TEXT DEFAULT NULL`, () => {})

  // Demo-copy fix: customers.js ka Commission-payments query expenses.created_at
  // select karti hai, lekin ye column CREATE TABLE mein kabhi define nahi hua
  // tha — production DB mein shayad manually add hua tha, is demo-database.js
  // mein missing tha. Isi wajah se Customer Profile route har customer ke liye
  // 500 (SQLITE_ERROR: no such column: created_at) de raha tha.
  db.run(`ALTER TABLE expenses ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {})

  // Order number system: VF-YYYY-NNNNNN
  db.run(`ALTER TABLE orders ADD COLUMN order_number TEXT DEFAULT NULL`, () => {})

  // ── Performance indexes (Phase 2) — data 10,000+ rows tak jaane par queries slow nahi hongi ──
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders(deleted_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_follow_up_date ON orders(follow_up_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cheques_customer_id ON cheques(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cheques_order_id ON cheques(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_upi_transactions_customer_id ON upi_transactions(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_upi_transactions_order_id ON upi_transactions(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_upi_transactions_transaction_date ON upi_transactions(transaction_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cash_income_customer_id ON cash_income(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cash_income_income_date ON cash_income(income_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_vendor_transactions_vendor_id ON vendor_transactions(vendor_id)`);

  // Demo-copy fix: discount_amount/discount_note/advance_upi_account production
  // orders.js/customers.js/pdf.js/dashboard.js mein use hote hain lekin is
  // database.js mein ALTER statement missing tha — production DB mein ye
  // shayad manually add hue the. Fresh demo-DB ke liye yahan add kar rahe hain.
  db.run(`ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN discount_note TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE orders ADD COLUMN advance_upi_account TEXT DEFAULT NULL`, () => {})

  // vendor_transactions ke columns jo vendors.js ke INSERT statements use karte hain
  // lekin CREATE TABLE mein define nahi the — agar already exist karte hain to no-op hai
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN items_json TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN payment_method TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN upi_account TEXT DEFAULT NULL`, () => {})
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN bank_transfer_type TEXT DEFAULT NULL`, () => {})
  // Note-wise Cash Tracking — vendor cash-payments ka bhi denomination breakdown
  // record hoga (jaise orders/expenses/salary mein already hota hai)
  db.run(`ALTER TABLE vendor_transactions ADD COLUMN denomination_breakdown TEXT DEFAULT NULL`, () => {})

  // ── ONE-TIME CLEANUP: purani "Galla Opening Balance" mirror-entries ──
  // set-baseline route pehle cash_income mein bhi ek mirror-row banata tha
  // (double-counting ka root cause), jo ab hata diya gaya hai — /cash-drawer
  // ab seedha cash_drawer_baseline table se baseline-aware calculate karta hai.
  // Naya query-level filter (notes != 'Galla Opening Balance') in purani rows ko
  // already exclude kar deta hai, isliye ye harmless hain — lekin DB ko clean
  // rakhne ke liye ek-baari delete kar rahe hain. Har startup pe chalna safe hai:
  // ek baar clean hone ke baad ye kuch match nahi karega (idempotent).
  db.run(`DELETE FROM cash_income WHERE notes = 'Galla Opening Balance'`, () => {})
  // Isi purane flow ne mirror-entries link karne ke liye ek "Opening Balance"
  // naam ka customer bhi bana diya tha — ab wo bhi kisi kaam ka nahi (naya
  // code kabhi is customer ko use nahi karta), isliye customer-list se bhi hataa rahe hain.
  db.run(`DELETE FROM customers WHERE firm_name = 'Opening Balance'`, () => {})

  // ── ONE-TIME MIGRATION: purane "Opening Balance" orders ──
  // Pehle Customer Profile ka "Add Opening Balance" seedha ek order create
  // karta tha (description = 'Opening Balance'). Ab wo customers.opening_balance
  // field mein jaata hai — isliye purane aise orders ko us field mein copy
  // karke, phir unhe soft-delete kar rahe hain (data delete nahi hota, sirf
  // orders-list/dashboard/statement se hat jaata hai, jaisa normal order-delete
  // karta hai). Idempotent hai: ek baar soft-delete hone ke baad "deleted_at
  // IS NULL" filter inhe dobara pakdega hi nahi, isliye har startup pe safe hai.
  db.all(
    `SELECT id, customer_id, total_amount, created_at, notes
     FROM orders
     WHERE description = 'Opening Balance' AND deleted_at IS NULL`,
    [],
    (err, rows) => {
      if (err || !rows || rows.length === 0) return;

      rows.forEach(row => {
        const obDate = row.created_at ? String(row.created_at).split(' ')[0] : null;
        // COALESCE se agar kisi wajah se ye dobara chal bhi jaaye (jaise ek
        // customer ke 2 purane Opening-Balance orders alag migration-runs mein
        // pakde gaye), to purani migrated value overwrite nahi hogi — add hogi.
        db.run(
          `UPDATE customers
           SET opening_balance = COALESCE(opening_balance, 0) + ?,
               opening_balance_date = COALESCE(opening_balance_date, ?),
               opening_balance_notes = COALESCE(opening_balance_notes, ?)
           WHERE id = ?`,
          [row.total_amount || 0, obDate, row.notes || 'Pichle saal ka bakaya', row.customer_id],
          (err) => {
            if (err) return logger.warn(`Opening-balance migrate failed for order ${row.id}: ${err.message}`);
            db.run(
              `UPDATE orders SET deleted_at = datetime('now', '+5 hours', '+30 minutes') WHERE id = ?`,
              [row.id],
              (err) => { if (err) logger.warn(`Opening-balance order soft-delete failed for ${row.id}: ${err.message}`); }
            );
          }
        );
      });
      logger.info(`Migrated ${rows.length} legacy Opening Balance orders to customer-level field.`);
    }
  );

  // ── ONE-TIME CORRECTION: pichli migration ne total_amount copy kiya tha,
  // balance_due nahi — agar kisi Opening-Balance order pe pehle se partial
  // payment record thi (jo balance_due ko total_amount se kam kar chuki thi),
  // to opening_balance galti se thoda overstate ho gaya hoga. Yahan wo
  // difference wapas ghata rahe hain. total_amount ko hi "already corrected?"
  // marker ki tarah use kiya hai (correction ke baad 0 kar dete hain), taaki
  // ye dobara na chale — idempotent hai, har startup pe safe.
  db.all(
    `SELECT id, customer_id, total_amount, balance_due
     FROM orders
     WHERE description = 'Opening Balance' AND deleted_at IS NOT NULL AND total_amount > 0`,
    [],
    (err, rows) => {
      if (err || !rows || rows.length === 0) return;

      rows.forEach(row => {
        const alreadyPaid = Number(row.total_amount || 0) - Number(row.balance_due || 0);
        if (alreadyPaid > 0) {
          db.run(
            `UPDATE customers SET opening_balance = MAX(0, opening_balance - ?) WHERE id = ?`,
            [alreadyPaid, row.customer_id],
            (err) => { if (err) logger.warn(`Opening-balance correction failed for customer ${row.customer_id}: ${err.message}`); }
          );
        }
        db.run(`UPDATE orders SET total_amount = 0 WHERE id = ?`, [row.id], () => {});
      });
      logger.info(`Checked ${rows.length} migrated orders for prior partial payments (corrected where needed).`);
    }
  );

  // Seed row — customers table + koi bhi column dependency nahi, safe hai yahan
  db.run(`
    INSERT INTO customers (firm_name, contact_name, phone)
    SELECT 'Ghar Khata', 'Owner', 'internal'
    WHERE NOT EXISTS (
      SELECT 1 FROM customers WHERE firm_name = 'Ghar Khata'
    )
  `);

  logger.info('All tables created successfully.');

  // ── PHASE 3: Backfill order numbers for existing orders that don't have one ──
  // order_number column ab guaranteed exist karta hai (isi serialize block mein
  // upar ALTER TABLE se abhi-abhi add hua). This runs once on server start —
  // safe to leave in permanently.
  db.all(
    `SELECT id, created_at FROM orders WHERE order_number IS NULL ORDER BY id ASC`,
    [],
    (err, rows) => {
      if (err || !rows || rows.length === 0) return;

      rows.forEach((row, idx) => {
        const year = row.created_at
          ? new Date(row.created_at).getFullYear()
          : new Date().getFullYear();

        // For backfill, use the row's id as sequence (good enough for old data)
        const seq = String(row.id).padStart(6, '0');
        const orderNumber = `VF-${year}-${seq}`;

        db.run(
          `UPDATE orders SET order_number = ? WHERE id = ? AND order_number IS NULL`,
          [orderNumber, row.id],
          (err) => { if (err) logger.warn(`Backfill failed for order ${row.id}: ${err.message}`); }
        );
      });
      logger.info(`Backfilled order_number for ${rows.length} existing orders.`);
    }
  );

});

module.exports = db;