import { useState, useEffect } from 'react'
import PageLock from '../components/PageLock'
import {
  getEmployees, createEmployee, markAttendance,
  getSalary, getAttendance, getEmployeeProfile, deleteEmployee, generateSalary,
  updateEmployeeSalary, getSetting, getDenominationDrawer
} from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import {
  Users, CalendarCheck, CalendarDays, Wallet, User, Trash2,
  Banknote, Smartphone, CheckCircle2, XCircle, Pencil, X,
  Send, ArrowUpFromLine, AlertTriangle, Clock, Phone,
} from 'lucide-react'

const UPI_ACCOUNTS = [
  'Demo UPI Account 1',
  'Demo UPI Account 2',
  'Demo UPI Account 3',
  'Demo UPI Account 4'
]

function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('list')

  // Message ab khud-ba-khud gayab ho jaata hai (4 sec baad) — pehle sirf
  // click-karke-hatao tha, isliye purana success-message screen pe atka
  // reh jaata tha jab tak koi naya action na ho.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // Tab badalte hi purana message turant clear — warna "salary credited"
  // wala banner "Mark Attendance" ya "Profile" tab pe bhi dikhta rehta tha.
  function changeTab(tab) {
    setMessage('')
    setActiveTab(tab)
  }
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [salaryData, setSalaryData] = useState(null)
  const [attendanceCalendar, setAttendanceCalendar] = useState([])
  const [salaryPaymentMode, setSalaryPaymentMode] = useState('cash')
  const [salaryUpiAccount, setSalaryUpiAccount] = useState('')
  const [salaryDenomination, setSalaryDenomination] = useState({})
  const [crediting, setCrediting] = useState(false)
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [showSalaryEdit, setShowSalaryEdit] = useState(false)
  const [salaryEditForm, setSalaryEditForm] = useState({ new_salary: '', reason: '', effective_date: '' })
  const [salaryEditLoading, setSalaryEditLoading] = useState(false)
  // Note-wise Cash Tracking — global setting (Galla Hisaab tab wali hi key)
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)
  // Live drawer notes — salary (outflow) ko available notes se zyada nahi badhne dena
  const [availableNotes, setAvailableNotes] = useState(null)
  const [addEmpSaving, setAddEmpSaving] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [deletingEmpId, setDeletingEmpId] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [salaryCalcLoading, setSalaryCalcLoading] = useState(false)

  const [form, setForm] = useState({
    name: '', phone: '', monthly_salary: '', join_date: ''
  })

  const today = new Date().toISOString().split('T')[0]
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [attendanceRecords, setAttendanceRecords] = useState({})

  const [salaryMonth, setSalaryMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )
  const [salaryYear, setSalaryYear] = useState(
    String(new Date().getFullYear())
  )
  const [calendarEmployee, setCalendarEmployee] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )
  const [calendarYear, setCalendarYear] = useState(
    String(new Date().getFullYear())
  )

  // const [genMonth, setGenMonth] = useState(
  //   String(new Date().getMonth() + 1).padStart(2, '0')
  // )
  // const [genYear, setGenYear] = useState(
  //   String(new Date().getFullYear())
  // )
  // (genMonth/genYear hataye — Profile ab all-time hai, month/year selector
  // ki zaroorat nahi. Note: "Salary" tab ka apna salaryMonth/salaryYear alag
  // hai — wo as-is rehta hai, kyunki wo specific month ki salary credit karne
  // ke liye hai, jo intentionally month-wise hi rehna chahiye.)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    getSetting('note_tracking_enabled')
      .then(res => setNoteTrackingEnabled(res.data.value === null ? true : res.data.value === 'true'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAvailableNotes()
  }, [])

  function fetchEmployees() {
    setLoading(true)
    getEmployees()
      .then(res => {
        setEmployees(res.data)
        const initial = {}
        res.data.forEach(e => { initial[e.id] = 'present' })
        setAttendanceRecords(initial)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function refreshAvailableNotes() {
    getDenominationDrawer()
      .then(res => setAvailableNotes(res.data.denominations))
      .catch(() => {})
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAddEmployee(e) {
    e.preventDefault()
    if (!form.name) return setMessage('Name is required.')
    setAddEmpSaving(true)
    createEmployee(form)
      .then(() => {
        setMessage('Employee added successfully!')
        setForm({ name: '', phone: '', monthly_salary: '', join_date: '' })
        setShowForm(false)
        fetchEmployees()
      })
      .catch(() => setMessage('Error adding employee.'))
      .finally(() => setAddEmpSaving(false))
  }

  function handleAttendanceChange(employeeId, status) {
    setAttendanceRecords({ ...attendanceRecords, [employeeId]: status })
  }

  function handleSubmitAttendance() {
    const records = Object.entries(attendanceRecords).map(([emp_id, status]) => ({
      employee_id: parseInt(emp_id), status
    }))
    setAttendanceSaving(true)
    markAttendance({ date: attendanceDate, records })
      .then(() => {
        setMessage(`Attendance marked for ${attendanceDate}`)
        if (calendarEmployee) fetchCalendar(calendarEmployee.id, calendarMonth, calendarYear)
      })
      .catch(() => setMessage('Error marking attendance.'))
      .finally(() => setAttendanceSaving(false))
  }

  function fetchSalary(empId, month, year) {
    getSalary(empId, { month, year })
      .then(res => setSalaryData(res.data))
      .catch(err => {
        console.error('Salary fetch failed:', err)
        setMessage('Error fetching salary: ' + (err?.response?.data?.error || err.message))
      })
      .finally(() => setSalaryCalcLoading(false))
  }

  function handleCreditSalary() {
  if (!selectedEmployee || !salaryData) return
  if (salaryPaymentMode === 'upi' && !salaryUpiAccount) {
    return setMessage('UPI ke liye account select karo.')
  }
  setCrediting(true)
  generateSalary({
    employee_id: selectedEmployee.id,
    month: salaryMonth,
    year: salaryYear,
    payment_mode: salaryPaymentMode,
    upi_account: salaryPaymentMode === 'upi' ? salaryUpiAccount : null,
    notes: `${salaryMonth}/${salaryYear} salary`,
    denomination_breakdown: salaryPaymentMode === 'cash' && Object.keys(salaryDenomination).length > 0
      ? salaryDenomination : null
  })
    .then(() => {
      setMessage(`✅ ₹${salaryData.calculated_salary} salary credited to ${selectedEmployee.name}`)
      setSalaryDenomination({})
      fetchSalary(selectedEmployee.id, salaryMonth, salaryYear)
      refreshAvailableNotes()
    })
    .catch(err => setMessage('Error: ' + (err.response?.data?.error || 'Could not credit salary')))
    .finally(() => setCrediting(false))
}

  function fetchCalendar(empId, month, year) {
    return getAttendance(empId, { month, year })
      .then(res => setAttendanceCalendar(res.data))
      .catch(err => {
        console.error('Calendar load failed:', err)
        setMessage('Error loading calendar: ' + (err?.response?.data?.error || err.message))
      })
  }

  function handleCalendarLoad() {
    if (!calendarEmployee) return setMessage('Select an employee first.')
    setCalendarLoading(true)
    fetchCalendar(calendarEmployee.id, calendarMonth, calendarYear)
      .finally(() => setCalendarLoading(false))
  }
  function handleDeleteEmployee(emp) {
    if (!window.confirm(`"${emp.name}" ko delete karna chahte ho?\nIska attendance, salary aur payments bhi delete ho jayega!`)) return
    setDeletingEmpId(emp.id)
    deleteEmployee(emp.id)
      .then(() => {
        setMessage(`${emp.name} delete ho gaya.`)
        fetchEmployees()
      })
      .catch(() => setMessage('Error deleting employee.'))
      .finally(() => setDeletingEmpId(null))
  }

  function handleSalaryUpdate(e) {
    e.preventDefault()
    if (!salaryEditForm.new_salary) return setMessage('Nai salary daalo.')
    setSalaryEditLoading(true)
    updateEmployeeSalary(selectedEmployee.id, {
      new_salary: parseInt(salaryEditForm.new_salary),
      reason: salaryEditForm.reason,
      effective_date: salaryEditForm.effective_date || today
    })
      .then(res => {
        setMessage(`✅ ${selectedEmployee.name} ki salary ₹${res.data.old_salary} se ₹${res.data.new_salary} ho gayi!`)
        setShowSalaryEdit(false)
        setSalaryEditForm({ new_salary: '', reason: '', effective_date: '' })
        fetchEmployees()
        loadEmployeeProfile(selectedEmployee)
      })
      .catch(err => setMessage('Error: ' + (err.response?.data?.error || 'Salary update failed')))
      .finally(() => setSalaryEditLoading(false))
  }

  // Profile ab ALL-TIME data dikhata hai (join date se ab tak) — month/year
  // params ki ab zaroorat nahi (backend bhi ab ignore/accept nahi karta).
  function loadEmployeeProfile(emp) {
    setSelectedEmployee(emp)
    setEmployeeProfile(null)
    setProfileError('')

    getEmployeeProfile(emp.id)
      .then(res => {
        setEmployeeProfile(res.data)
      })
      .catch(err => {
        const msg = err?.response?.data?.error || err?.message || 'Unknown error'
        setProfileError(`Error loading profile: ${msg}`)
        console.error('Profile load failed:', err)
      })
  }

  // ── FIX: fmtDT — display stored timestamp as-is, no Date() re-parsing
  // The DB stores "2026-06-17 14:52:58" (IST). Passing this through new Date()
  // re-interprets it as UTC and adds +5:30 offset, showing the wrong time.
  // Instead we just format the stored string directly.
  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    // Try to parse YYYY-MM-DD HH:MM:SS or ISO format
    // We display as-is without timezone conversion
    const clean = dateStr.replace('T', ' ').substring(0, 19)
    // clean = "2026-06-17 14:52:58"
    const parts = clean.split(' ')
    if (parts.length === 2) {
      const [datePart, timePart] = parts
      const [yyyy, mm, dd] = datePart.split('-')
      return `${timePart}  ${dd}.${mm}.${yyyy}`
    }
    return clean
  }

  function buildCalendar(month, year) {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay()
    return { daysInMonth, firstDay }
  }

  function getDayStatus(day) {
    const dateStr = `${calendarYear}-${calendarMonth}-${String(day).padStart(2, '0')}`
    const record = attendanceCalendar.find(r => r.date === dateStr)
    return record ? record.status : null
  }

  const { daysInMonth, firstDay } = buildCalendar(calendarMonth, calendarYear)
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Calendar/Salary/Profile ab top-tabs mein nahi hain — redundant the row-action
  // buttons (Salary/Calendar/Profile, employee-list mein har row ke saamne) ke saath,
  // jo already same activeTab set karte hain + employee bhi seedha select kar dete hain
  // (ek-click, faster). Tab content (activeTab === 'salary' / 'calendar' / 'profile')
  // as-is rehta hai — bas manual-click se navigate karne ka option hata hai.
  const TABS = [
    { key: 'list',       label: <><Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Employees</> },
    { key: 'attendance', label: <><CalendarCheck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Mark Attendance</> }
  ]

  return (
    <PageLock pageKey="employees" pageTitle="Employees">
    <div>
      {/* HEADER */}
      <div style={styles.header}>
        <h2>Employees</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {/* ADD FORM */}
      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>New Employee</h3>
          <form onSubmit={handleAddEmployee}>
            <div style={styles.formRow}>
              <input style={styles.input} placeholder="Full Name *" name="name"
                value={form.name} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Phone Number" name="phone"
                value={form.phone} onChange={handleFormChange} />
              <input style={styles.input} placeholder="Monthly Salary (₹)"
                name="monthly_salary" type="number"
                value={form.monthly_salary} onChange={handleFormChange} />
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Joining Date</label>
                <input style={styles.input} type="date" name="join_date"
                  value={form.join_date} onChange={handleFormChange} />
              </div>
            </div>
            <LoadingButton loading={addEmpSaving} style={styles.submitBtn} type="submit">Save Employee</LoadingButton>
          </form>
        </div>
      )}

      {/* TABS */}
      <div style={styles.tabRow}>
        {TABS.map(t => (
          <button key={t.key}
            style={{ ...styles.tab, ...(activeTab === t.key ? styles.activeTab : {}) }}
            onClick={() => changeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: LIST ── */}
      {activeTab === 'list' && (
        loading ? <SectionLoader label="Employees load ho rahe hain..." /> : employees.length === 0 ? (
          <p style={{ color: '#888' }}>No employees found.</p>
        ) : (
          <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Monthly Salary</th>
                <th style={styles.th}>Per Day</th>
                <th style={styles.th}>Joining Date</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, index) => (
                <tr key={emp.id} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}><strong>{emp.name}</strong></td>
                  <td style={styles.td}>{emp.phone || '—'}</td>
                  <td style={styles.td}>₹{emp.monthly_salary}</td>
                  <td style={styles.td}>₹{Math.round(emp.monthly_salary / 30)}</td>
                  <td style={styles.td}>{emp.join_date || '—'}</td>
                  <td style={styles.td}>
                    <button onClick={() => {
                      setSelectedEmployee(emp)
                      setSalaryData(null)
                      changeTab('salary')
                    }} style={{ ...styles.actionBtn, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Wallet size={12} /> Salary
                    </button>
                    <button onClick={() => {
                      setCalendarEmployee(emp)
                      changeTab('calendar')
                      fetchCalendar(emp.id, calendarMonth, calendarYear)
                    }} style={{ ...styles.actionBtn, marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CalendarDays size={12} /> Calendar
                    </button>
                    <button onClick={() => {
                      loadEmployeeProfile(emp)
                      changeTab('profile')
                    }} style={{ ...styles.actionBtn, marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} /> Profile
                    </button>
                    <LoadingButton
                      loading={deletingEmpId === emp.id}
                      loadingText="..."
                      onClick={() => handleDeleteEmployee(emp)}
                      style={{ backgroundColor: '#800000', color: '#fff', border: '1px solid #800000', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', marginLeft: '6px' }}>
                      <Trash2 size={12} /> Delete
                    </LoadingButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}

      {/* ── TAB: MARK ATTENDANCE ── */}
      {activeTab === 'attendance' && (
        <div style={styles.section}>
          <div style={styles.attendanceHeader}>
            <h3>Mark Attendance</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: '180px', flex: 'none' }}
                type="date" value={attendanceDate}
                onChange={e => setAttendanceDate(e.target.value)}
              />
              <LoadingButton loading={attendanceSaving} style={styles.submitBtn} onClick={handleSubmitAttendance}>
                Save Attendance
              </LoadingButton>
            </div>
          </div>

          {employees.length === 0 ? <p style={{ color: '#888' }}>No employees.</p> : (
            <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Per Day</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, index) => (
                  <tr key={emp.id} style={styles.tr}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}><strong>{emp.name}</strong></td>
                    <td style={styles.td}>₹{Math.round(emp.monthly_salary / 30)}</td>
                    <td style={styles.td}>
                      <div style={styles.statusBtns}>
                        {['present', 'absent', 'half_day'].map(s => (
                          <button key={s}
                            onClick={() => handleAttendanceChange(emp.id, s)}
                            style={{
                              ...styles.statusBtn,
                              backgroundColor: attendanceRecords[emp.id] === s ? attendanceColor(s) : '#fff',
                              color: attendanceRecords[emp.id] === s ? '#fff' : '#555',
                              border: `1px solid ${attendanceColor(s)}`
                            }}
                          >
                            {s === 'present' ? <><CheckCircle2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Present</>
                              : s === 'absent' ? <><XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Absent</>
                              : '½ Half Day'}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CALENDAR ── */}
      {activeTab === 'calendar' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={17} /> Attendance Calendar</h3>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select style={{ ...styles.input, minWidth: '180px' }}
                value={calendarEmployee?.id || ''}
                onChange={e => {
                  const emp = employees.find(em => em.id === parseInt(e.target.value))
                  setCalendarEmployee(emp)
                  setAttendanceCalendar([])
                }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Month</label>
              <select style={{ ...styles.input, minWidth: '130px' }} value={calendarMonth}
                onChange={e => setCalendarMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>
                    {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={calendarYear}
                onChange={e => setCalendarYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <LoadingButton loading={calendarLoading} style={styles.submitBtn} onClick={handleCalendarLoad}>
              Load Calendar
            </LoadingButton>
          </div>

          {calendarEmployee && (
            <>
              <div style={styles.legend}>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#27ae60' }}></span> Present
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#e74c3c' }}></span> Absent
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#f39c12' }}></span> Half Day
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#ecf0f1' }}></span> Not Marked
                </span>
              </div>

              <div style={styles.calendarBox}>
                <h4 style={{ marginBottom: '12px', textAlign: 'center', color: '#1a1a2e' }}>
                  {calendarEmployee.name} — {new Date(2000, parseInt(calendarMonth) - 1)
                    .toLocaleString('en-IN', { month: 'long' })} {calendarYear}
                </h4>
                <div style={styles.calendarGrid}>
                  {dayLabels.map(d => (
                    <div key={d} style={styles.dayLabel}>{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} style={styles.emptyCell}></div>
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const status = getDayStatus(day)
                    return (
                      <div key={day} style={{
                        ...styles.dayCell,
                        backgroundColor: status === 'present' ? '#27ae60'
                          : status === 'absent' ? '#e74c3c'
                          : status === 'half_day' ? '#f39c12'
                          : '#ecf0f1',
                        color: status ? '#fff' : '#888'
                      }}>
                        <div style={styles.dayNumber}>{day}</div>
                        {status && (
                          <div style={styles.dayStatus}>
                            {status === 'present' ? '✓' : status === 'absent' ? '✗' : '½'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {attendanceCalendar.length > 0 && (
                  <div style={styles.calendarSummary}>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'present').length}
                      </span>
                      <span style={styles.summaryLabel}>Present</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'absent').length}
                      </span>
                      <span style={styles.summaryLabel}>Absent</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#f39c12', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.filter(r => r.status === 'half_day').length}
                      </span>
                      <span style={styles.summaryLabel}>Half Day</span>
                    </div>
                    <div style={styles.summaryItem}>
                      <span style={{ color: '#1a1a2e', fontWeight: 'bold', fontSize: '20px' }}>
                        {attendanceCalendar.length}
                      </span>
                      <span style={styles.summaryLabel}>Total Marked</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: SALARY ── */}
      {activeTab === 'salary' && (
        <div style={styles.section}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Wallet size={17} /> Salary Calculator</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={styles.label}>Employee</label>
              <select style={{ ...styles.input, minWidth: '200px' }}
                value={selectedEmployee?.id || ''}
                onChange={e => {
                  const emp = employees.find(em => em.id === parseInt(e.target.value))
                  setSelectedEmployee(emp)
                  setSalaryData(null)
                }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Month</label>
              <select style={{ ...styles.input, minWidth: '130px' }} value={salaryMonth}
                onChange={e => setSalaryMonth(e.target.value)}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>
                    {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Year</label>
              <select style={{ ...styles.input, minWidth: '100px' }} value={salaryYear}
                onChange={e => setSalaryYear(e.target.value)}>
                {['2024', '2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <LoadingButton
              loading={salaryCalcLoading}
              style={styles.submitBtn}
              onClick={() => {
                if (!selectedEmployee) return
                setSalaryCalcLoading(true)
                fetchSalary(selectedEmployee.id, salaryMonth, salaryYear)
              }}
            >
              Calculate
            </LoadingButton>
          </div>

          {salaryData && (
            <div style={styles.salaryCard}>
              <h3 style={{ marginBottom: '16px', color: '#1a1a2e' }}>
                {salaryData.employee_name} — {new Date(2000, parseInt(salaryMonth) - 1)
                  .toLocaleString('en-IN', { month: 'long' })} {salaryYear}
              </h3>
              <div style={styles.salaryGrid}>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Monthly Salary</div>
                  <div style={styles.salaryValue}>₹{salaryData.monthly_salary}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Per Day Rate</div>
                  <div style={styles.salaryValue}>₹{salaryData.per_day_salary}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Present Days</div>
                  <div style={{ ...styles.salaryValue, color: '#27ae60' }}>{salaryData.present_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Half Days</div>
                  <div style={{ ...styles.salaryValue, color: '#f39c12' }}>{salaryData.half_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Absent Days</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>{salaryData.absent_days}</div>
                </div>
                <div style={styles.salaryItem}>
                  <div style={styles.salaryLabel}>Deduction</div>
                  <div style={{ ...styles.salaryValue, color: '#e74c3c' }}>- ₹{salaryData.deduction}</div>
                </div>
              </div>
              <div style={styles.salaryTotal}>
                <span>Payable Salary</span>
                <strong style={{ fontSize: '24px', color: '#27ae60' }}>
                  ₹{salaryData.calculated_salary}
                </strong>
              </div>

              {/* CREDIT SALARY */}
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginTop: '16px' }}>
                <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={15} /> Credit This Salary</h4>

                <div style={{ marginBottom: '12px' }}>
                  <label style={styles.label}>Payment Mode</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button"
                      onClick={() => { setSalaryPaymentMode('cash'); setSalaryUpiAccount('') }}
                      style={{
                        padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '13px',
                        backgroundColor: salaryPaymentMode === 'cash' ? '#27ae60' : '#fff',
                        color: salaryPaymentMode === 'cash' ? '#fff' : '#333'
                      }}
                    ><Banknote size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cash</button>
                    <button type="button"
                      onClick={() => setSalaryPaymentMode('upi')}
                      style={{
                        padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '13px',
                        backgroundColor: salaryPaymentMode === 'upi' ? '#1565c0' : '#fff',
                        color: salaryPaymentMode === 'upi' ? '#fff' : '#333'
                      }}
                    ><Smartphone size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />UPI</button>
                  </div>
                </div>

                {salaryPaymentMode === 'upi' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={styles.label}>UPI Account *</label>
                    <select style={{ ...styles.input, maxWidth: '260px' }}
                      value={salaryUpiAccount}
                      onChange={e => setSalaryUpiAccount(e.target.value)}
                    >
                      <option value="">Select UPI Account</option>
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>
                )}

                {salaryPaymentMode === 'cash' && noteTrackingEnabled && (
                  <DenominationCounter
                    context="expense"
                    availableNotes={availableNotes}
                    onApply={(total, counts) => setSalaryDenomination(counts)}
                  />
                )}

                <LoadingButton
                  onClick={handleCreditSalary}
                  loading={crediting}
                  loadingText="Crediting..."
                  style={{ ...styles.submitBtn, marginTop: '12px' }}
                >
                  <CheckCircle2 size={14} /> Credit ₹{salaryData.calculated_salary} to {selectedEmployee?.name}
                </LoadingButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: PROFILE ── */}
      {activeTab === 'profile' && (
        <div>
          {/* Employee selector buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {employees.map(emp => (
              <button key={emp.id}
                onClick={() => loadEmployeeProfile(emp)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                  backgroundColor: selectedEmployee?.id === emp.id ? '#1a1a2e' : '#fff',
                  color: selectedEmployee?.id === emp.id ? '#fff' : '#333',
                  border: selectedEmployee?.id === emp.id ? '1px solid #1a1a2e' : '1px solid #ddd'
                }}
              >
                <User size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{emp.name}
              </button>
            ))}
          </div>

          {/* FIX: Show real error message instead of generic "Error loading profile" */}
          {profileError && (
            <p style={{ color: '#c0392b', backgroundColor: '#fdf2f2', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px' }}>
              {profileError}
            </p>
          )}

          {!employeeProfile && selectedEmployee && !profileError && (
            <SectionLoader label="Profile load ho raha hai..." size="small" />
          )}

          {!selectedEmployee && (
            <p style={{ color: '#888' }}>Select an employee above to view their profile.</p>
          )}

          {employeeProfile && (
            <div style={styles.section}>
              {/* Header */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '4px' }}>{employeeProfile.employee.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <p style={{ color: '#888', fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <Phone size={12} /> {employeeProfile.employee.phone || '—'} &nbsp;•&nbsp;
                    Salary: <strong style={{ color: '#1a1a2e' }}>₹{employeeProfile.employee.monthly_salary}/month</strong> &nbsp;•&nbsp;
                    Per day: ₹{Math.round(employeeProfile.employee.monthly_salary / 30)}
                  </p>
                  <button
                    onClick={() => {
                      setShowSalaryEdit(f => !f)
                      setSalaryEditForm({ new_salary: employeeProfile.employee.monthly_salary, reason: '', effective_date: today })
                    }}
                    style={{
                      backgroundColor: showSalaryEdit ? '#e74c3c' : '#f39c12',
                      color: '#fff', border: 'none', padding: '8px 16px',
                      borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
                    }}
                  >
                    {showSalaryEdit ? <><X size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cancel</> : <><Pencil size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Edit Salary</>}
                  </button>
                </div>

                {showSalaryEdit && (
                  <form onSubmit={handleSalaryUpdate} style={{
                    marginTop: '16px', backgroundColor: '#fff9e6', border: '1px solid #ffc107',
                    borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end'
                  }}>
                    <div>
                      <label style={styles.label}>Nai Monthly Salary (₹) *</label>
                      <input
                        style={{ ...styles.input, maxWidth: '180px', fontSize: '18px', fontWeight: 'bold' }}
                        type="number" placeholder="e.g. 12000"
                        value={salaryEditForm.new_salary}
                        onChange={e => setSalaryEditForm(f => ({ ...f, new_salary: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={styles.label}>Effective Date</label>
                      <input
                        style={{ ...styles.input, maxWidth: '170px' }}
                        type="date" value={salaryEditForm.effective_date || today}
                        onChange={e => setSalaryEditForm(f => ({ ...f, effective_date: e.target.value }))}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <label style={styles.label}>Reason (optional)</label>
                      <input
                        style={styles.input} placeholder="e.g. Promotion, performance bonus..."
                        value={salaryEditForm.reason}
                        onChange={e => setSalaryEditForm(f => ({ ...f, reason: e.target.value }))}
                      />
                    </div>
                    <LoadingButton
                      type="submit" loading={salaryEditLoading}
                      style={{
                        backgroundColor: '#27ae60', color: '#fff', border: 'none',
                        padding: '10px 20px', borderRadius: '6px',
                        fontSize: '14px', fontWeight: 'bold'
                      }}
                    >
                      <CheckCircle2 size={13} /> Update Salary
                    </LoadingButton>
                  </form>
                )}
              </div>

              {/* Month/Year selector hataya — Profile ab hamesha all-time (join
                  date se ab tak) data dikhata hai, isliye period-select ki
                  zaroorat nahi rahi. */}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={styles.statBox}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Wallet size={12} /> Salary Earned — Total ({employeeProfile.effective_days} din)
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#27ae60' }}>
                    + ₹{Math.abs(employeeProfile.salary_earned)}
                  </div>
                </div>

                <div style={styles.statBox}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ArrowUpFromLine size={12} /> Advance Given
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#e74c3c' }}>
                    - ₹{Math.abs(employeeProfile.total_advance_paid)}
                  </div>
                </div>

                <div style={{
                  ...styles.statBox,
                  backgroundColor: employeeProfile.net_payable >= 0 ? '#f0fff4' : '#fff5f5',
                  border: `1px solid ${employeeProfile.net_payable >= 0 ? '#c3e6cb' : '#fdd'}`
                }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {employeeProfile.net_payable >= 0 ? <><CheckCircle2 size={12} /> Net Payable to Employee</> : <><AlertTriangle size={12} /> Employee Owes Back</>}
                  </div>
                  <div style={{
                    fontSize: '26px', fontWeight: 'bold',
                    color: employeeProfile.net_payable >= 0 ? '#27ae60' : '#e74c3c'
                  }}>
                    {employeeProfile.net_payable >= 0 ? '+' : '-'} ₹{Math.abs(employeeProfile.net_payable)}
                  </div>
                </div>
              </div>

              {/* Payment history */}
              <h4 style={{ marginBottom: '12px' }}>Payment History</h4>
              {employeeProfile.payment_history.length === 0 ? (
                <p style={{ color: '#888' }}>No payments recorded yet.</p>
              ) : (
                <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Description</th>
                      <th style={styles.th}>Mode</th>
                      <th style={styles.th}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeProfile.payment_history.map((p, i) => (
                      <tr key={i} style={styles.tr}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        <td style={styles.td}>
                          {/* FIX: display stored timestamp directly without re-parsing through Date() */}
                          <div>{p.date || '—'}</div>
                          {p.created_at && (
                            <div style={{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={10} /> {fmtDT(p.created_at)}
                            </div>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: p.type === 'advance' ? '#f39c12' : '#27ae60',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}>
                            {p.type === 'advance' ? <><Banknote size={11} /> Advance</> : <><Wallet size={11} /> Salary</>}
                          </span>
                        </td>
                        <td style={styles.td}>{p.description || '—'}</td>
                        <td style={styles.td}>
                          <span style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {p.payment_mode === 'cash' ? <><Banknote size={11} /> Cash</>
                              : p.upi_account ? <><Smartphone size={11} /> {p.upi_account}</>
                              : <><Banknote size={11} /> Cash</>}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <strong style={{ color: p.type === 'advance' ? '#e74c3c' : '#27ae60' }}>
                            {p.type === 'advance' ? '- ' : '+ '}₹{p.amount}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </PageLock>
  )
}

function attendanceColor(status) {
  return status === 'present' ? '#27ae60' : status === 'absent' ? '#e74c3c' : '#f39c12'
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: { padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  section: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  attendanceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '650px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  statusBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  statusBtn: { padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  actionBtn: { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px' },
  legend: { display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' },
  legendDot: { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block' },
  calendarBox: { backgroundColor: '#f8f8f8', padding: '20px', borderRadius: '12px' },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '16px' },
  dayLabel: { textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#888', padding: '8px 0' },
  emptyCell: { height: '60px' },
  dayCell: { height: '60px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: '14px', fontWeight: 'bold' },
  dayStatus: { fontSize: '16px', marginTop: '2px' },
  calendarSummary: { display: 'flex', justifyContent: 'space-around', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', flexWrap: 'wrap', gap: '12px' },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  summaryLabel: { fontSize: '12px', color: '#888' },
  salaryCard: { backgroundColor: '#f8f8f8', padding: '24px', borderRadius: '12px' },
  salaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' },
  salaryItem: { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', textAlign: 'center' },
  salaryLabel: { fontSize: '12px', color: '#888', marginBottom: '6px' },
  salaryValue: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e' },
  salaryTotal: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px' },
  statBox: { backgroundColor: '#f8f8f8', padding: '16px 20px', borderRadius: '8px', minWidth: '160px' },
}

export default Employees
