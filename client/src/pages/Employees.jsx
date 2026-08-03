import { useState, useEffect } from 'react'
import PageLock from '../components/PageLock'
import {
  getEmployees, createEmployee, markAttendance,
  getSalary, getAttendance, getEmployeeProfile, deleteEmployee, generateSalary,
  updateEmployeeSalary, getSetting, getDenominationDrawer,
  uploadEmployeePhoto, deleteEmployeePhoto,
} from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { PrimaryButton, SecondaryButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'
import {
  Users, CalendarCheck, CalendarDays, Wallet, Trash2,
  Banknote, Smartphone, CheckCircle2, XCircle, Pencil, X,
  Send, ArrowUpFromLine, AlertTriangle, Clock, Phone, Camera,
  Plus, IndianRupee,
} from 'lucide-react'

const UPI_ACCOUNTS = [
  'Demo UPI Account 1',
  'Demo UPI Account 2',
  'Demo UPI Account 3',
  'Demo UPI Account 4'
]

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

function attendanceTone(status) {
  return status === 'present' ? 'emerald' : status === 'absent' ? 'red' : 'amber'
}

function EmployeeAvatar({ employee, size = 14 }) {
  const sizeClasses = size === 14 ? 'w-14 h-14 text-xl' : 'w-9 h-9 text-sm'
  if (employee.photo_path) {
    return (
      <img
        src={`http://localhost:5000/${employee.photo_path}`}
        alt={employee.name}
        className={`${sizeClasses} rounded-2xl object-cover border border-slate-700 shrink-0`}
      />
    )
  }
  return (
    <div className={`${sizeClasses} rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 shrink-0`}>
      {employee.name?.charAt(0).toUpperCase()}
    </div>
  )
}

function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('list')

  // Message auto-clears after 4s instead of requiring a manual click to
  // dismiss — otherwise a stale success message could sit on screen
  // indefinitely until the next action.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  // Clear any leftover message the moment the tab changes — otherwise a
  // "salary credited" banner could still show up on the Mark Attendance
  // or Profile tab.
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
  // Note-wise cash tracking — global setting (same key as the Cash Drawer tab)
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)
  // Live drawer notes — keeps salary payouts from exceeding what's in the drawer
  const [availableNotes, setAvailableNotes] = useState(null)
  const [addEmpSaving, setAddEmpSaving] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [deletingEmpId, setDeletingEmpId] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [salaryCalcLoading, setSalaryCalcLoading] = useState(false)
  const [photoUploadingId, setPhotoUploadingId] = useState(null)

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
      return setMessage('Select a UPI account first.')
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
    if (!window.confirm(`Delete "${emp.name}"?\nTheir attendance, salary, and payment records will also be deleted!`)) return
    setDeletingEmpId(emp.id)
    deleteEmployee(emp.id)
      .then(() => {
        setMessage(`${emp.name} deleted.`)
        fetchEmployees()
      })
      .catch(() => setMessage('Error deleting employee.'))
      .finally(() => setDeletingEmpId(null))
  }

  function handleSalaryUpdate(e) {
    e.preventDefault()
    if (!salaryEditForm.new_salary) return setMessage('Enter the new salary amount.')
    setSalaryEditLoading(true)
    updateEmployeeSalary(selectedEmployee.id, {
      new_salary: parseInt(salaryEditForm.new_salary),
      reason: salaryEditForm.reason,
      effective_date: salaryEditForm.effective_date || today
    })
      .then(res => {
        setMessage(`✅ ${selectedEmployee.name}'s salary changed from ₹${res.data.old_salary} to ₹${res.data.new_salary}!`)
        setShowSalaryEdit(false)
        setSalaryEditForm({ new_salary: '', reason: '', effective_date: '' })
        fetchEmployees()
        loadEmployeeProfile(selectedEmployee)
      })
      .catch(err => setMessage('Error: ' + (err.response?.data?.error || 'Salary update failed')))
      .finally(() => setSalaryEditLoading(false))
  }

  // Profile shows ALL-TIME data (from join date to now) — month/year params
  // aren't needed (the backend ignores/doesn't accept them either).
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

  function openProfile(emp) {
    loadEmployeeProfile(emp)
    changeTab('profile')
  }

  function handlePhotoUpload(e, emp) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoUploadingId(emp.id)
    uploadEmployeePhoto(emp.id, file)
      .then(() => fetchEmployees())
      .catch(() => setMessage('Photo upload failed.'))
      .finally(() => setPhotoUploadingId(null))
  }

  function handlePhotoRemove(emp) {
    if (!window.confirm('Remove this photo?')) return
    deleteEmployeePhoto(emp.id)
      .then(() => fetchEmployees())
      .catch(() => setMessage('Error removing photo.'))
  }

  // display stored "YYYY-MM-DD HH:MM:SS" (IST) timestamp as-is, without
  // re-parsing through Date() — that would re-interpret it as UTC and shift
  // it by +5:30, showing the wrong time.
  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    const clean = dateStr.replace('T', ' ').substring(0, 19)
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

  // Calendar/Salary/Profile aren't in the top tab row — they're reached via
  // the per-employee actions instead (Salary/Calendar buttons, or clicking
  // the employee's name for Profile), which set activeTab AND select the
  // employee in one click.
  const TABS = [
    { key: 'list',       label: 'Employees',       icon: Users },
    { key: 'attendance', label: 'Mark Attendance', icon: CalendarCheck },
  ]

  return (
    <PageLock pageKey="employees" pageTitle="Employees">
      <div className="space-y-6">
        <PageHeader
          title="Employees"
          subtitle="Staff roster, attendance tracking, and salary management"
          actions={
            showForm ? (
              <SecondaryButton icon={X} onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
            ) : (
              <PrimaryButton icon={Plus} onClick={() => setShowForm(true)}>Add Employee</PrimaryButton>
            )
          }
        />

        {message && (
          <p
            onClick={() => setMessage('')}
            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl cursor-pointer text-sm"
          >
            {message}
          </p>
        )}

        {showForm && (
          <Card>
            <h3 className="text-white font-bold mb-4">New Employee</h3>
            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input className={inputClasses} placeholder="Full Name *" name="name"
                  value={form.name} onChange={handleFormChange} />
                <input className={inputClasses} placeholder="Phone Number" name="phone"
                  value={form.phone} onChange={handleFormChange} />
                <input className={inputClasses} placeholder="Monthly Salary (₹)"
                  name="monthly_salary" type="number"
                  value={form.monthly_salary} onChange={handleFormChange} />
                <div className="flex-1 min-w-0">
                  <label className={labelClasses}>Joining Date</label>
                  <input className={inputClasses} type="date" name="join_date"
                    value={form.join_date} onChange={handleFormChange} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">A photo can be added afterward from the employee's card.</p>
              <LoadingButton
                loading={addEmpSaving}
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
              >
                Save Employee
              </LoadingButton>
            </form>
          </Card>
        )}

        {/* TABS */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {/* ── TAB: LIST — card grid ── */}
        {activeTab === 'list' && (
          loading ? <SectionLoader label="Loading employees..." /> : employees.length === 0 ? (
            <p className="text-slate-500 text-sm">No employees found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {employees.map(emp => (
                <Card key={emp.id} className="hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <EmployeeAvatar employee={emp} />
                        <label
                          title="Upload photo"
                          className="absolute -bottom-1 -right-1 bg-slate-800 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-slate-700"
                        >
                          <Camera className="w-3 h-3 text-slate-300" />
                          <input type="file" accept="image/*" capture="environment" onChange={e => handlePhotoUpload(e, emp)} className="hidden" />
                        </label>
                      </div>

                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => openProfile(emp)}
                          className="font-bold text-white text-base hover:text-blue-400 transition-colors text-left truncate block"
                        >
                          {emp.name}
                        </button>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                          <Phone className="w-3 h-3 text-slate-500" /> {emp.phone || '—'}
                        </p>
                        {photoUploadingId === emp.id && <p className="text-[11px] text-slate-500 mt-1">Uploading photo...</p>}
                        {emp.photo_path && photoUploadingId !== emp.id && (
                          <button onClick={() => handlePhotoRemove(emp)} className="text-[11px] text-red-400 underline mt-1">
                            Remove photo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Monthly Salary</span>
                        <span className="font-mono font-bold text-white">₹{emp.monthly_salary}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Per Day</span>
                        <span className="font-mono text-slate-300">₹{Math.round(emp.monthly_salary / 30)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Joined</span>
                        <span className="text-slate-300">{emp.join_date || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => { setSelectedEmployee(emp); setSalaryData(null); changeTab('salary') }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 transition-all"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Salary
                    </button>
                    <button
                      onClick={() => { setCalendarEmployee(emp); changeTab('calendar'); fetchCalendar(emp.id, calendarMonth, calendarYear) }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 transition-all"
                    >
                      <CalendarDays className="w-3.5 h-3.5" /> Calendar
                    </button>
                    <LoadingButton
                      loading={deletingEmpId === emp.id}
                      loadingText="..."
                      onClick={() => handleDeleteEmployee(emp)}
                      className="ml-auto px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </LoadingButton>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* ── TAB: MARK ATTENDANCE ── */}
        {activeTab === 'attendance' && (
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="text-white font-bold">Mark Attendance</h3>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className={`${inputClasses} w-[170px]`}
                  value={attendanceDate}
                  onChange={e => setAttendanceDate(e.target.value)}
                />
                <LoadingButton
                  loading={attendanceSaving}
                  onClick={handleSubmitAttendance}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 whitespace-nowrap"
                >
                  Save Attendance
                </LoadingButton>
              </div>
            </div>

            {employees.length === 0 ? <p className="text-slate-500 text-sm">No employees.</p> : (
              <Table minWidth="500px">
                <THead>
                  <Th>#</Th>
                  <Th>Name</Th>
                  <Th>Per Day</Th>
                  <Th>Status</Th>
                </THead>
                <TBody>
                  {employees.map((emp, index) => (
                    <Tr key={emp.id}>
                      <Td className="text-slate-400">{index + 1}</Td>
                      <Td className="font-bold text-white">{emp.name}</Td>
                      <Td className="font-mono text-slate-300">₹{Math.round(emp.monthly_salary / 30)}</Td>
                      <Td>
                        <div className="flex gap-2 flex-wrap">
                          {['present', 'absent', 'half_day'].map(s => {
                            const active = attendanceRecords[emp.id] === s
                            const tone = attendanceTone(s)
                            return (
                              <button
                                key={s}
                                onClick={() => handleAttendanceChange(emp.id, s)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                  active
                                    ? tone === 'emerald' ? 'bg-emerald-600 border-emerald-500 text-white'
                                      : tone === 'red' ? 'bg-red-600 border-red-500 text-white'
                                      : 'bg-amber-600 border-amber-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                                }`}
                              >
                                {s === 'present' ? <><CheckCircle2 className="w-3 h-3" /> Present</>
                                  : s === 'absent' ? <><XCircle className="w-3 h-3" /> Absent</>
                                  : '½ Half Day'}
                              </button>
                            )
                          })}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        )}

        {/* ── TAB: CALENDAR ── */}
        {activeTab === 'calendar' && (
          <Card>
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Attendance Calendar</h3>

            <div className="flex gap-3 flex-wrap items-end mb-5">
              <div>
                <label className={labelClasses}>Employee</label>
                <select
                  className={`${inputClasses} min-w-[180px]`}
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
                <label className={labelClasses}>Month</label>
                <select className={`${inputClasses} min-w-[140px]`} value={calendarMonth} onChange={e => setCalendarMonth(e.target.value)}>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Year</label>
                <select className={`${inputClasses} min-w-[100px]`} value={calendarYear} onChange={e => setCalendarYear(e.target.value)}>
                  {['2024', '2025', '2026', '2027'].map(y => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
              <LoadingButton
                loading={calendarLoading}
                onClick={handleCalendarLoad}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
              >
                Load Calendar
              </LoadingButton>
            </div>

            {calendarEmployee && (
              <>
                <div className="flex gap-5 flex-wrap mb-4 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" /> Present</span>
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-500 inline-block" /> Absent</span>
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" /> Half Day</span>
                  <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-700 inline-block" /> Not Marked</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                  <h4 className="text-center text-white font-bold mb-4">
                    {calendarEmployee.name} — {new Date(2000, parseInt(calendarMonth) - 1).toLocaleString('en-IN', { month: 'long' })} {calendarYear}
                  </h4>
                  <div className="grid grid-cols-7 gap-1.5 mb-4">
                    {dayLabels.map(d => (
                      <div key={d} className="text-center text-xs font-bold text-slate-500 py-2">{d}</div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-[60px]" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const status = getDayStatus(day)
                      const bg = status === 'present' ? 'bg-emerald-600 text-white'
                        : status === 'absent' ? 'bg-red-600 text-white'
                        : status === 'half_day' ? 'bg-amber-600 text-white'
                        : 'bg-slate-800 text-slate-500'
                      return (
                        <div key={day} className={`h-[60px] rounded-xl flex flex-col items-center justify-center ${bg}`}>
                          <div className="text-sm font-bold">{day}</div>
                          {status && <div className="text-base mt-0.5">{status === 'present' ? '✓' : status === 'absent' ? '✗' : '½'}</div>}
                        </div>
                      )
                    })}
                  </div>

                  {attendanceCalendar.length > 0 && (
                    <div className="flex justify-around bg-slate-900 border border-slate-800 p-4 rounded-xl flex-wrap gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-bold text-emerald-400">{attendanceCalendar.filter(r => r.status === 'present').length}</span>
                        <span className="text-xs text-slate-400">Present</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-bold text-red-400">{attendanceCalendar.filter(r => r.status === 'absent').length}</span>
                        <span className="text-xs text-slate-400">Absent</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-bold text-amber-400">{attendanceCalendar.filter(r => r.status === 'half_day').length}</span>
                        <span className="text-xs text-slate-400">Half Day</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-bold text-white">{attendanceCalendar.length}</span>
                        <span className="text-xs text-slate-400">Total Marked</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        )}

        {/* ── TAB: SALARY ── */}
        {activeTab === 'salary' && (
          <Card>
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> Salary Calculator</h3>
            <div className="flex gap-3 flex-wrap items-end mb-5">
              <div>
                <label className={labelClasses}>Employee</label>
                <select
                  className={`${inputClasses} min-w-[200px]`}
                  value={selectedEmployee?.id || ''}
                  onChange={e => {
                    const emp = employees.find(em => em.id === parseInt(e.target.value))
                    setSelectedEmployee(emp)
                    setSalaryData(null)
                  }}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Month</label>
                <select className={`${inputClasses} min-w-[140px]`} value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)}>
                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Year</label>
                <select className={`${inputClasses} min-w-[100px]`} value={salaryYear} onChange={e => setSalaryYear(e.target.value)}>
                  {['2024', '2025', '2026', '2027'].map(y => (<option key={y} value={y}>{y}</option>))}
                </select>
              </div>
              <LoadingButton
                loading={salaryCalcLoading}
                onClick={() => {
                  if (!selectedEmployee) return
                  setSalaryCalcLoading(true)
                  fetchSalary(selectedEmployee.id, salaryMonth, salaryYear)
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
              >
                Calculate
              </LoadingButton>
            </div>

            {salaryData && (
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <h3 className="text-white font-bold mb-4">
                  {salaryData.employee_name} — {new Date(2000, parseInt(salaryMonth) - 1).toLocaleString('en-IN', { month: 'long' })} {salaryYear}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Monthly Salary</div>
                    <div className="text-lg font-bold text-white font-mono">₹{salaryData.monthly_salary}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Per Day Rate</div>
                    <div className="text-lg font-bold text-white font-mono">₹{salaryData.per_day_salary}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Present Days</div>
                    <div className="text-lg font-bold text-emerald-400 font-mono">{salaryData.present_days}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Half Days</div>
                    <div className="text-lg font-bold text-amber-400 font-mono">{salaryData.half_days}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Absent Days</div>
                    <div className="text-lg font-bold text-red-400 font-mono">{salaryData.absent_days}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
                    <div className="text-[11px] text-slate-400 mb-1.5">Deduction</div>
                    <div className="text-lg font-bold text-red-400 font-mono">- ₹{salaryData.deduction}</div>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-300">Payable Salary</span>
                  <strong className="text-2xl font-bold text-emerald-400 font-mono">₹{salaryData.calculated_salary}</strong>
                </div>

                {/* CREDIT SALARY */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2"><Send className="w-4 h-4" /> Credit This Salary</h4>

                  <div className="mb-3">
                    <label className={labelClasses}>Payment Mode</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setSalaryPaymentMode('cash'); setSalaryUpiAccount('') }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          salaryPaymentMode === 'cash' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalaryPaymentMode('upi')}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          salaryPaymentMode === 'upi' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" /> UPI
                      </button>
                    </div>
                  </div>

                  {salaryPaymentMode === 'upi' && (
                    <div className="mb-3">
                      <label className={labelClasses}>UPI Account *</label>
                      <select className={`${inputClasses} max-w-[280px]`} value={salaryUpiAccount} onChange={e => setSalaryUpiAccount(e.target.value)}>
                        <option value="">Select UPI Account</option>
                        {UPI_ACCOUNTS.map(acc => (<option key={acc} value={acc}>{acc}</option>))}
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
                    className="mt-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Credit ₹{salaryData.calculated_salary} to {selectedEmployee?.name}
                  </LoadingButton>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── TAB: PROFILE ── */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            {/* Employee selector chips */}
            <div className="flex gap-2 flex-wrap">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => loadEmployeeProfile(emp)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    selectedEmployee?.id === emp.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                  }`}
                >
                  <EmployeeAvatar employee={emp} size={6} />
                  {emp.name}
                </button>
              ))}
            </div>

            {profileError && (
              <p className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{profileError}</p>
            )}

            {!employeeProfile && selectedEmployee && !profileError && (
              <SectionLoader label="Loading profile..." size="small" />
            )}

            {!selectedEmployee && (
              <p className="text-slate-500 text-sm">Select an employee above to view their profile.</p>
            )}

            {employeeProfile && (
              <Card>
                <div className="flex items-start gap-4 mb-5">
                  <EmployeeAvatar employee={employeeProfile.employee} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-white">{employeeProfile.employee.name}</h3>
                        <p className="text-xs text-slate-400 flex items-center flex-wrap gap-1.5 mt-1">
                          <Phone className="w-3 h-3" /> {employeeProfile.employee.phone || '—'}
                          <span>•</span>
                          Salary: <strong className="text-slate-200">₹{employeeProfile.employee.monthly_salary}/month</strong>
                          <span>•</span>
                          Per day: ₹{Math.round(employeeProfile.employee.monthly_salary / 30)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowSalaryEdit(f => !f)
                          setSalaryEditForm({ new_salary: employeeProfile.employee.monthly_salary, reason: '', effective_date: today })
                        }}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          showSalaryEdit ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        {showSalaryEdit ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Pencil className="w-3.5 h-3.5" /> Edit Salary</>}
                      </button>
                    </div>

                    {showSalaryEdit && (
                      <form onSubmit={handleSalaryUpdate} className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 flex-wrap items-end">
                        <div>
                          <label className={labelClasses}>New Monthly Salary (₹) *</label>
                          <input
                            className={`${inputClasses} max-w-[180px] font-bold`}
                            type="number" placeholder="e.g. 12000"
                            value={salaryEditForm.new_salary}
                            onChange={e => setSalaryEditForm(f => ({ ...f, new_salary: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className={labelClasses}>Effective Date</label>
                          <input
                            className={`${inputClasses} max-w-[170px]`}
                            type="date" value={salaryEditForm.effective_date || today}
                            onChange={e => setSalaryEditForm(f => ({ ...f, effective_date: e.target.value }))}
                          />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className={labelClasses}>Reason (optional)</label>
                          <input
                            className={inputClasses} placeholder="e.g. Promotion, performance bonus..."
                            value={salaryEditForm.reason}
                            onChange={e => setSalaryEditForm(f => ({ ...f, reason: e.target.value }))}
                          />
                        </div>
                        <LoadingButton
                          type="submit" loading={salaryEditLoading}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Update Salary
                        </LoadingButton>
                      </form>
                    )}
                  </div>
                </div>

                {/* Stats — Profile always shows all-time data (join date to now) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Wallet className="w-3 h-3" /> Salary Earned — Total ({employeeProfile.effective_days} days)
                    </div>
                    <div className="text-xl font-bold text-emerald-400 font-mono">+ ₹{Math.abs(employeeProfile.salary_earned)}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                    <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <ArrowUpFromLine className="w-3 h-3" /> Advance Given
                    </div>
                    <div className="text-xl font-bold text-red-400 font-mono">- ₹{Math.abs(employeeProfile.total_advance_paid)}</div>
                  </div>
                  <div className={`p-4 rounded-xl border ${employeeProfile.net_payable >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                      {employeeProfile.net_payable >= 0 ? <><CheckCircle2 className="w-3 h-3" /> Net Payable to Employee</> : <><AlertTriangle className="w-3 h-3" /> Employee Owes Back</>}
                    </div>
                    <div className={`text-2xl font-bold font-mono ${employeeProfile.net_payable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {employeeProfile.net_payable >= 0 ? '+' : '-'} ₹{Math.abs(employeeProfile.net_payable)}
                    </div>
                  </div>
                </div>

                <h4 className="text-white font-bold mb-3 flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Payment History</h4>
                {employeeProfile.payment_history.length === 0 ? (
                  <p className="text-slate-500 text-sm">No payments recorded yet.</p>
                ) : (
                  <Table minWidth="600px">
                    <THead>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Description</Th>
                      <Th>Mode</Th>
                      <Th>Amount</Th>
                    </THead>
                    <TBody>
                      {employeeProfile.payment_history.map((p, i) => (
                        <Tr key={i}>
                          <Td>
                            <div className="text-slate-300">{p.date || '—'}</div>
                            {p.created_at && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" /> {fmtDT(p.created_at)}
                              </div>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={p.type === 'advance' ? 'amber' : 'emerald'} icon={p.type === 'advance' ? Banknote : Wallet}>
                              {p.type === 'advance' ? 'Advance' : 'Salary'}
                            </Badge>
                          </Td>
                          <Td className="text-slate-300">{p.description || '—'}</Td>
                          <Td className="text-slate-300">
                            <span className="inline-flex items-center gap-1.5">
                              {p.payment_mode === 'upi' && p.upi_account
                                ? <><Smartphone className="w-3 h-3" /> {p.upi_account}</>
                                : <><Banknote className="w-3 h-3" /> Cash</>}
                            </span>
                          </Td>
                          <Td>
                            <strong className={`font-mono ${p.type === 'advance' ? 'text-red-400' : 'text-emerald-400'}`}>
                              {p.type === 'advance' ? '- ' : '+ '}₹{p.amount}
                            </strong>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </PageLock>
  )
}

export default Employees
