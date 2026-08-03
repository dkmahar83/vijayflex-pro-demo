// reset_data.js — Run from server/ folder: node reset_data.js --confirm
// ⚠️ SAFETY GUARD — production mein kabhi nahi chalega, aur bina --confirm ke bhi nahi.
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to run reset_data.js — NODE_ENV is "production". Ye script poora financial data delete kar deta hai.');
  process.exit(1);
}
if (process.argv[2] !== '--confirm') {
  console.error('⚠️  Ye SAAB payments, expenses, cash income, UPI transactions, cheques, orders, customers, employees, vendors, inventory PERMANENTLY delete kar dega.');
  console.error('    Confirm karne ke liye phir se chalao: node reset_data.js --confirm');
  process.exit(1);
}

const util = require('util');
const db = require('./db/database');

const runAsync = util.promisify(db.run).bind(db);

async function step(label, sql) {
  await runAsync(sql);
  console.log(`✅ ${label}`);
}

async function main() {
  // Chhota sa startup-wait — db.js ke andar migrations/table-creation abhi
  // bhi chal rahi ho sakti hai jab server pehli baar start ho. Ab har DELETE
  // apna completion khud await karta hai (sequential), isliye ye sirf ek
  // extra safety margin hai — poore script ki correctness ab isi pe
  // depend nahi karti jaisa purane fixed setTimeout(1500)+setTimeout(1000)
  // mein thi.
  await new Promise(r => setTimeout(r, 1500));

  await runAsync('BEGIN TRANSACTION');
  try {
    await step('payments cleared',               `DELETE FROM payments`);
    await step('cash_income cleared',             `DELETE FROM cash_income`);
    await step('upi_transactions cleared',        `DELETE FROM upi_transactions`);
    await step('cheques cleared',                 `DELETE FROM cheques`);
    await step('expenses cleared',                `DELETE FROM expenses`);
    await step('daily_records cleared',           `DELETE FROM daily_records`);
    await step('vendor_transactions cleared',     `DELETE FROM vendor_transactions`);
    await step('employee_salary_credits cleared', `DELETE FROM employee_salary_credits`);

    // NAYA: pehle missing tha — advance-payment-linked rows the, jo
    // payments/cash_income/upi wipe hone ke baad dangling ho jaate.
    await step('customer_payments cleared', `DELETE FROM customer_payments`);

    // NAYA: Galla baseline bhi clear karo — warna Denomination Drawer reset
    // ke baad bhi purani baseline-count se hi calculate hoti rahegi.
    await step('cash_drawer_baseline cleared', `DELETE FROM cash_drawer_baseline`);

    // NAYA: ye 2 tables pehle bilkul miss the — dono orders.id ko FK
    // reference karte hain. order_activity_log Dashboard ke "Recent
    // Activity" mein WhatsApp-sends dikhata hai, order_photos order ke
    // upload kiye hue photos. Inhe clear kiye bina: (a) purani WhatsApp/
    // photo history reset ke baad bhi Recent Activity mein dikhti rehti
    // (b) orders ka ID-counter neeche reset hone ki wajah se naye orders
    // purane order_id ko reuse kar sakte hain, aur ye purani rows galti se
    // naye (bilkul unrelated) order se jud jaatin. FK-safe order ke liye
    // orders delete hone se PEHLE hi clear kar rahe hain.
    await step('order_activity_log cleared', `DELETE FROM order_activity_log`);
    await step('order_photos cleared',       `DELETE FROM order_photos`);

    // NAYA: master data bhi clear karo — warna seed_demo.js ka
    // "orders already exist → skip" check hamesha true rahega, aur
    // reset ke baad bhi purana hi data dikhta rahega (naya random
    // dummy data kabhi generate hi nahi hoga). Ye 3 purane steps
    // (orders UPDATE, vendors UPDATE, customers UPDATE) replace karte
    // hain — ab rows update nahi, delete hoti hain taaki seed_demo.js
    // fresh row-count 0 dekhe aur naya randomized data bana sake.
    await step('order_items cleared',    `DELETE FROM order_items`);
    await step('orders cleared',         `DELETE FROM orders`);
    await step('attendance cleared',     `DELETE FROM attendance`);
    await step('customers cleared',      `DELETE FROM customers`);
    await step('employees cleared',      `DELETE FROM employees`);
    await step('vendors cleared',        `DELETE FROM vendors`);
    await step('inventory_flex cleared',      `DELETE FROM inventory_flex`);
    await step('inventory_stamps cleared',    `DELETE FROM inventory_stamps`);
    await step('inventory_chemicals cleared', `DELETE FROM inventory_chemicals`);
    await step('inventory_frames cleared',    `DELETE FROM inventory_frames`);
    await step('inventory_ink cleared',       `DELETE FROM inventory_ink`);

    // NAYA: pehle missing tha — inventory items delete hone ke baad, purane
    // inventory_log rows (jo unhi item_ids ko refer karte the) dangling ho
    // jaate the aur naye (unrelated) inventory items se galti se jud jaate,
    // Dashboard Recent Activity mein galat "restocked/used" history dikhate.
    await step('inventory_log cleared', `DELETE FROM inventory_log`);

    // Autoincrement counters bhi reset — taaki naye IDs 1 se shuru hon
    await step('id counters reset', `
      DELETE FROM sqlite_sequence WHERE name IN (
        'orders','order_items','customers','employees','vendors',
        'attendance','inventory_flex','inventory_stamps',
        'inventory_chemicals','inventory_frames','inventory_ink',
        'order_activity_log','order_photos','inventory_log'
      )
    `);

    await runAsync('COMMIT');
  } catch (err) {
    await runAsync('ROLLBACK').catch(() => {});
    throw err;
  }

  console.log('\n🎉 All data cleared successfully! Restart the server to seed fresh demo data.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Reset failed:', err.message);
  process.exit(1);
});