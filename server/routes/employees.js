const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ─────────────────────────────────────────
// HELPER: IST timestamp (consistent with orders.js)
// ─────────────────────────────────────────
function nowIST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ');
}

// ─────────────────────────────────────────
// GET /api/employees
// ─────────────────────────────────────────
router.get('/', (req, res) => {
  db.all(`SELECT * FROM employees WHERE is_active = 1 ORDER BY name ASC`,
  [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ─────────────────────────────────────────
// POST /api/employees
// ─────────────────────────────────────────
router.post('/', (req, res) => {
  const { name, phone, monthly_salary, join_date } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(`
    INSERT INTO employees (name, phone, monthly_salary, join_date)
    VALUES (?, ?, ?, ?)
  `, [name, phone, monthly_salary || 0, join_date], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: this.lastID,
      name,
      phone,
      monthly_salary,
      message: 'Employee added successfully'
    });
  });
});

// ─────────────────────────────────────────
// PUT /api/employees/:id
// ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, monthly_salary, is_active } = req.body;

  db.run(`
    UPDATE employees SET name = ?, phone = ?, monthly_salary = ?, is_active = ?
    WHERE id = ?
  `, [name, phone, monthly_salary, is_active, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee updated successfully' });
  });
});

// ─────────────────────────────────────────
// POST /api/employees/attendance
// ─────────────────────────────────────────
router.post('/attendance', (req, res) => {
  const { date, records } = req.body;

  if (!date || !records || records.length === 0) {
    return res.status(400).json({ error: 'date and records are required' });
  }

  const upsert = (record) => new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO attendance (employee_id, date, status)
       VALUES (?, ?, ?)
       ON CONFLICT(employee_id, date) DO UPDATE SET status = excluded.status`,
      [record.employee_id, date, record.status],
      (err) => err ? reject(err) : resolve()
    );
  });

  Promise.all(records.map(upsert))
    .then(() => res.status(201).json({ message: 'Attendance marked successfully' }))
    .catch(err => res.status(500).json({ error: 'Attendance save failed: ' + err.message }));
});

// ─────────────────────────────────────────
// ⚠️  IMPORTANT: Named routes (non-:param) MUST come before /:param routes
// in Express. If /attendance/:id or /salary/:id appear before /profile/:id,
// Express will never match /profile/:id correctly.
// Order is: POST/GET on static paths first, then /:param last.
// ─────────────────────────────────────────

// GET /api/employees/attendance/:employee_id
router.get('/attendance/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;

  let query = `SELECT * FROM attendance WHERE employee_id = ?`;
  let params = [employee_id];

  if (month && year) {
    query += ` AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`;
    params.push(month, year);
  }

  query += ` GROUP BY date ORDER BY date ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/employees/salary/:employee_id
router.get('/salary/:employee_id', (req, res) => {
  const { employee_id } = req.params;
  const { month, year } = req.query;

  db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    db.all(`
      SELECT * FROM attendance
      WHERE employee_id = ?
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
      GROUP BY date
    `, [employee_id, month, year], (err, attendance) => {
      if (err) return res.status(500).json({ error: err.message });

      const total_days     = attendance.length;
      const present_days   = attendance.filter(a => a.status === 'present').length;
      const half_days      = attendance.filter(a => a.status === 'half_day').length;
      const absent_days    = attendance.filter(a => a.status === 'absent').length;
      const per_day_salary = employee.monthly_salary / 30;
      const effective_days = present_days + (half_days * 0.5);
      const calculated_salary = Math.round(per_day_salary * effective_days);
      const deduction = employee.monthly_salary - calculated_salary;

      res.json({
        employee_name: employee.name,
        monthly_salary: employee.monthly_salary,
        per_day_salary: Math.round(per_day_salary),
        total_days_marked: total_days,
        present_days,
        half_days,
        absent_days,
        effective_days,
        calculated_salary,
        deduction,
        month,
        year
      });
    });
  });
});

// ─────────────────────────────────────────
// GET /api/employees/profile/:id
// Employee profile + payment history
//
// FIX: This route was previously shadowed by /attendance/:employee_id
// and /salary/:employee_id if registered after them. Now declared here
// in the correct order — static-segment routes always before /:param.
// ─────────────────────────────────────────
router.get('/profile/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Advances — ALL-TIME (join date se ab tak)
    db.all(`
      SELECT id, expense_date as date, amount, description, payment_mode, upi_account,
             'advance' as type, created_at
      FROM expenses
      WHERE paid_to_type = 'employee' AND paid_to_id = ?
      ORDER BY expense_date DESC
    `, [id], (err, advances) => {
      if (err) return res.status(500).json({ error: err.message });

      // Salary credits — ALL-TIME
      db.all(`
        SELECT id, credited_date as date, salary_amount as amount, notes as description,
              payment_mode, upi_account, 'salary' as type, NULL as created_at
        FROM employee_salary_credits
        WHERE employee_id = ?
        ORDER BY credited_date DESC
      `, [id], (err, salaries) => {
        if (err) return res.status(500).json({ error: err.message });

        // Attendance — ALL-TIME (month/year filter hataya). Wajah: "Salary Earned"
        // aur "Advance Given" ab hamesha SAME time-period (poora tenure) represent
        // karte hain — pehle salary_earned sirf ek mahine ka tha jabki advance/salary
        // history hamesha all-time thi, jisse Net Payable galat/misleading ban jaata tha.
        db.all(`
          SELECT * FROM attendance
          WHERE employee_id = ?
          GROUP BY date
        `, [id], (err, attendance) => {
          if (err) return res.status(500).json({ error: err.message });

          const presentDays  = attendance.filter(a => a.status === 'present').length;
          const halfDays     = attendance.filter(a => a.status === 'half_day').length;
          const effectiveDays = presentDays + (halfDays * 0.5);
          const perDay        = employee.monthly_salary / 30;
          const salaryEarned  = Math.round(perDay * effectiveDays);

          const totalAdvancePaid     = advances.reduce((s, a) => s + a.amount, 0);
          const totalSalaryCredited  = salaries.reduce((s, s2) => s + s2.amount, 0);
          const totalPaid            = totalAdvancePaid + totalSalaryCredited;
          // Ab already-credited salary bhi ghataate hain — warna purani credit hui
          // salary bhi "abhi dena baaki hai" jaisi dikhti (kyunki salaryEarned ab
          // poore tenure ka hai, sirf ek mahine ka nahi).
          const netPayable = salaryEarned - totalAdvancePaid - totalSalaryCredited;

          const payment_history = [...advances, ...salaries]
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

          res.json({
            employee,
            payment_history,
            total_advance_paid:    totalAdvancePaid,
            total_salary_credited: totalSalaryCredited,
            total_paid:            totalPaid,
            salary_earned:         salaryEarned,
            effective_days:        effectiveDays,
            present_days:          presentDays,
            half_days:             halfDays,
            net_payable:           netPayable
          });
        });
      });
    });
  });
});

// ─────────────────────────────────────────
// POST /api/employees/generate-salary
// ─────────────────────────────────────────
router.post('/generate-salary', (req, res) => {
  const { employee_id, month, year, payment_mode, upi_account, notes, denomination_breakdown } = req.body;
  const createdAt = nowIST();
  const breakdownToSave = ((payment_mode || 'cash') === 'cash' && denomination_breakdown && Object.keys(denomination_breakdown).length > 0)
    ? JSON.stringify(denomination_breakdown)
    : null;

  db.get(`
    SELECT * FROM employee_salary_credits
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [employee_id, month, year], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) {
      return res.status(400).json({ error: `Salary already generated for ${month}/${year}` });
    }

    db.get(`SELECT * FROM employees WHERE id = ?`, [employee_id], (err, employee) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });

      db.all(`
        SELECT * FROM attendance
        WHERE employee_id = ?
        AND strftime('%m', date) = ?
        AND strftime('%Y', date) = ?
        GROUP BY date
      `, [employee_id, month, year], (err, attendance) => {
        if (err) return res.status(500).json({ error: err.message });

        const presentDays = attendance.filter(a => a.status === 'present').length;
        const halfDays    = attendance.filter(a => a.status === 'half_day').length;
        const effectiveDays = presentDays + (halfDays * 0.5);
        const calculatedSalary = Math.round((employee.monthly_salary / 30) * effectiveDays);

        // Use IST date, not UTC
        const today = nowIST().split(' ')[0];

        db.run(`
          INSERT INTO employee_salary_credits
            (employee_id, month, year, salary_amount, credited_date, notes, payment_mode, upi_account, denomination_breakdown)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          employee_id, month, year, calculatedSalary, today,
          notes || `${month}/${year} salary`,
          payment_mode || 'cash', upi_account || null, breakdownToSave
        ], function(err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`
            INSERT INTO expenses
              (category, amount, expense_date, description, paid_to_type, paid_to_id,
               payment_mode, upi_account, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            'Employee Salary', calculatedSalary, today,
            `${employee.name} salary (${month}/${year})`,
            'employee', employee_id,
            payment_mode || 'cash', upi_account || null, createdAt
          ], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Salary generated successfully', salary_amount: calculatedSalary });
          });
        });
      });
    });
  });
});
// ─────────────────────────────────────────
// PUT /api/employees/:id/salary
// ─────────────────────────────────────────
router.put('/:id/salary', (req, res) => {
  const { id } = req.params;
  const { new_salary, reason, effective_date } = req.body;

  if (!new_salary || isNaN(new_salary) || new_salary <= 0)
    return res.status(400).json({ error: 'Valid salary required' });

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const old_salary = employee.monthly_salary;
    const date = effective_date || nowIST().split(' ')[0];

    db.run(`UPDATE employees SET monthly_salary = ? WHERE id = ?`, [new_salary, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      db.run(`
        INSERT INTO expenses (category, amount, expense_date, description, payment_mode, created_at)
        VALUES ('Salary Revision', 0, ?, ?, 'cash', ?)
      `, [
        date,
        `${employee.name} salary revised: ₹${old_salary} → ₹${new_salary}${reason ? ' | Reason: ' + reason : ''}`,
        nowIST()
      ], (err) => {
        if (err) console.warn('History log failed:', err.message);
        res.json({ message: 'Salary updated', old_salary, new_salary: parseInt(new_salary) });
      });
    });
  });
});
// Employee + saara related data delete karta hai
// ─────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.get(`SELECT * FROM employees WHERE id = ?`, [id], (err, employee) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    db.serialize(() => {
      db.run(`DELETE FROM attendance WHERE employee_id = ?`, [id]);
      db.run(`DELETE FROM employee_salary_credits WHERE employee_id = ?`, [id]);
      db.run(`DELETE FROM expenses WHERE paid_to_type = 'employee' AND paid_to_id = ?`, [id]);
      db.run(`DELETE FROM employees WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `${employee.name} aur unka saara data delete ho gaya.` });
      });
    });
  });
});

module.exports = router;