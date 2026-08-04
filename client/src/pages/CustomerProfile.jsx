import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCustomerProfile, addOpeningBalance, uploadCustomerPhoto, deleteCustomerPhoto, generateCustomerStatement, sendStatementWhatsApp, getWhatsAppStatus } from '../services/api'
import PageLock from '../components/PageLock'
import SectionLoader from '../components/SectionLoader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import { PrimaryButton, SecondaryButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'
import {
  Camera,
  Phone,
  NotebookPen,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Scissors,
  ClipboardList,
  Clock,
  Package,
  X,
  ArrowLeft,
} from 'lucide-react'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

// Payment "type" and cheque-status badge colors — same recipe as the rest of
// the design system, just mapped onto the extra categories this ledger uses.
const PAYMENT_TYPE_TONE = {
  'Advance': 'amber',
  'Order Payment': 'blue',
  'UPI': 'sky',
  'Cheque': 'purple',
  'Cash Income': 'teal',
  'Commission': 'orange',
}
const CHEQUE_STATUS_TONE = { received: 'amber', deposited: 'blue', cleared: 'emerald', bounced: 'red' }
const ORDER_STATUS_TONE = { pending: 'amber', in_progress: 'blue', ready: 'emerald', delivered: 'slate' }

function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showObForm, setShowObForm] = useState(false)
  const [obAmount, setObAmount]     = useState('')
  const [obDate, setObDate]         = useState(new Date().toLocaleDateString('en-CA'))
  const [obNotes, setObNotes]       = useState('Previous year balance')
  const [obMsg, setObMsg]           = useState('')
  const [obSaving, setObSaving]     = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [stmtLoading, setStmtLoading]     = useState(false)
  const [waStmtModal, setWaStmtModal]     = useState(false)
  const [waStmtUpi, setWaStmtUpi]         = useState('')
  const [waStmtSending, setWaStmtSending] = useState(false)
  const [stmtMsg, setStmtMsg]             = useState('')
  const [stmtSuccess, setStmtSuccess]     = useState(false)
  // WhatsApp status — always comes back 'disabled' from the backend in this demo
  const [waStatus, setWaStatus] = useState('checking')

  useEffect(() => {
    getCustomerProfile(id)
      .then(res => { setCustomer(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    getWhatsAppStatus()
      .then(res => setWaStatus(res.data.status))
      .catch(() => {})
  }, [])

  // All three independent messages (opening-balance, photo, statement) now
  // auto-clear after 4s instead of requiring a manual click to dismiss.
  useEffect(() => {
    if (!obMsg) return
    const timer = setTimeout(() => setObMsg(''), 4000)
    return () => clearTimeout(timer)
  }, [obMsg])

  useEffect(() => {
    if (!photoMsg) return
    const timer = setTimeout(() => setPhotoMsg(''), 4000)
    return () => clearTimeout(timer)
  }, [photoMsg])

  useEffect(() => {
    if (!stmtMsg) return
    const timer = setTimeout(() => setStmtMsg(''), 4000)
    return () => clearTimeout(timer)
  }, [stmtMsg])

  if (loading) return <SectionLoader label="Loading customer profile..." size="large" minHeight="60vh" />
  if (!customer) return <p className="text-slate-400 p-5">Customer not found.</p>

  const orders = customer.orders || []
  const payments = customer.payments || []
  const totalBilled = customer.totalBilled || 0
  const totalPaid = customer.totalPaid || 0
  const totalDue = customer.totalDue || 0

  function fmtDT(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d)) return dateStr
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${min}:${ss}  ${dd}.${mm}.${yyyy}`
  }

  async function handleDownloadStatement() {
    setStmtLoading(true)
    try {
      const res = await generateCustomerStatement(id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `Statement-${customer.firm_name}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setStmtMsg('Error generating statement.')
    } finally {
      setStmtLoading(false)
    }
  }

  async function handleSendStatementWA() {
    if (!waStmtUpi) return setStmtMsg('Please select a UPI account.')
    setWaStmtSending(true)
    try {
      await sendStatementWhatsApp(id, waStmtUpi)
      setStmtMsg('Statement sent on WhatsApp')
      setStmtSuccess(true)
      setWaStmtModal(false)
      setWaStmtUpi('')
    } catch (err) {
      setStmtMsg(err.response?.data?.error || 'WhatsApp send failed.')
      setStmtSuccess(false)
    } finally {
      setWaStmtSending(false)
    }
  }

  function handleOpeningBalance(e) {
    e.preventDefault()
    if (!obAmount || isNaN(obAmount) || Number(obAmount) <= 0)
      return setObMsg('Valid amount required')

    setObSaving(true)
    addOpeningBalance(id, { amount: Number(obAmount), date: obDate, notes: obNotes })
      .then(() => {
        setObMsg('Opening balance added successfully!')
        setObAmount('')
        setShowObForm(false)
        return getCustomerProfile(id).then(res => setCustomer(res.data))
      })
      .catch(err => setObMsg('Error: ' + (err.response?.data?.error || 'Failed')))
      .finally(() => setObSaving(false))
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return

    setPhotoUploading(true)
    setPhotoMsg('')

    uploadCustomerPhoto(id, file)
      .then(() => {
        setPhotoMsg('Photo updated!')
        return getCustomerProfile(id)
      })
      .then(res => setCustomer(res.data))
      .catch(err => setPhotoMsg('Error: ' + (err.response?.data?.error || 'Upload failed')))
      .finally(() => setPhotoUploading(false))
  }

  function handlePhotoRemove() {
    if (!window.confirm('Remove this photo?')) return
    deleteCustomerPhoto(id)
      .then(() => getCustomerProfile(id))
      .then(res => setCustomer(res.data))
      .catch(err => setPhotoMsg('Error: ' + (err.response?.data?.error || 'Delete failed')))
  }

  return (
    <PageLock pageKey="customer-profile" pageTitle="Customer Profile">
      <div className="space-y-6">
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </button>

        {/* CUSTOMER HEADER */}
        <Card className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {customer.photo_path ? (
                <img
                  src={`http://localhost:5000/${customer.photo_path}`}
                  alt={customer.firm_name}
                  onClick={() => setShowPhotoModal(true)}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-700 cursor-pointer"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-blue-500/20">
                  {customer.firm_name?.charAt(0).toUpperCase()}
                </div>
              )}
              <label
                title="Upload photo"
                className="absolute -bottom-1 -right-1 bg-slate-800 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-slate-700"
              >
                <Camera className="w-3 h-3 text-slate-300" />
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{customer.firm_name}</h1>
              <p className="text-xs font-medium text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap">
                {customer.contact_name && <span>Contact: <span className="text-white font-semibold">{customer.contact_name}</span></span>}
                {customer.phone && (
                  <span className="flex items-center gap-1 text-slate-400">
                    {customer.contact_name && '•'} <Phone className="w-3 h-3" /> {customer.phone}
                  </span>
                )}
              </p>
              {photoUploading && <p className="text-xs text-slate-500 mt-1">Uploading...</p>}
              {photoMsg && (
                <p className={`text-xs mt-1 ${photoMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {photoMsg}
                  {customer.photo_path && !photoMsg.includes('Error') && (
                    <button onClick={handlePhotoRemove} className="ml-2 text-red-400 underline">Remove</button>
                  )}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Billed" value={`₹${totalBilled}`} icon={Package} tone="blue" />
          <StatCard label="Total Paid" value={`₹${totalPaid}`} valueClassName="text-emerald-400" icon={Wallet} tone="emerald" />
          <StatCard
            label="Total Due"
            value={totalDue < 0 ? `−₹${Math.abs(totalDue)} (We owe)` : `₹${totalDue}`}
            valueClassName={totalDue > 0 ? 'text-red-400' : totalDue < 0 ? 'text-orange-400' : 'text-emerald-400'}
            icon={AlertTriangle}
            tone={totalDue > 0 ? 'red' : totalDue < 0 ? 'orange' : 'emerald'}
          />
          <StatCard label="Total Orders" value={orders.length} icon={ClipboardList} tone="blue" />
        </div>

        {/* OPENING BALANCE BANNER */}
        {customer.opening_balance > 0 && (
          <div className="flex items-center justify-between gap-4 bg-purple-500/10 border-l-4 border-purple-500 p-4 rounded-xl">
            <div>
              <p className="text-xs font-bold text-purple-400">Opening Balance (Carried Forward)</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {customer.opening_balance_notes || ''}
                {customer.opening_balance_date && `  •  ${customer.opening_balance_date}`}
              </p>
            </div>
            <div className="text-lg font-bold text-purple-400 font-mono shrink-0">₹{customer.opening_balance}</div>
          </div>
        )}

        {showObForm && (
          <Card className="!border-purple-500/40">
            <h3 className="text-purple-400 font-bold mb-1.5 flex items-center gap-2">
              <NotebookPen className="w-4 h-4" /> Opening Balance — {customer.firm_name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add any balance carried over from a previous financial year here. It's added directly
              to the customer's total due (no new order is created).
            </p>
            <form onSubmit={handleOpeningBalance} className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className={labelClasses}>Amount (₹) *</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={obAmount}
                    onChange={e => { setObAmount(e.target.value); if (obMsg) setObMsg('') }}
                    className={`${inputClasses} font-bold`}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className={labelClasses}>Date</label>
                  <input type="date" value={obDate} onChange={e => setObDate(e.target.value)} className={inputClasses} />
                </div>
                <div className="flex-[2] min-w-[200px]">
                  <label className={labelClasses}>Notes</label>
                  <input type="text" value={obNotes} onChange={e => setObNotes(e.target.value)} className={inputClasses} />
                </div>
              </div>

              {obMsg && (
                <p className={`px-3 py-2 rounded-xl text-xs ${obMsg.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {obMsg}
                </p>
              )}

              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={obSaving}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {obSaving ? 'Saving...' : 'Save Opening Balance'}
                </button>
                <SecondaryButton type="button" disabled={obSaving} onClick={() => { setShowObForm(false); setObMsg('') }}>
                  Cancel
                </SecondaryButton>
              </div>
            </form>
          </Card>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowObForm(f => !f)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition-all"
          >
            <NotebookPen className="w-4 h-4" /> Add Opening Balance
          </button>

          <div className="w-px h-6 bg-slate-800 hidden sm:block" />

          <button
            onClick={handleDownloadStatement}
            disabled={stmtLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 text-xs font-bold shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4 text-blue-400" /> {stmtLoading ? 'Generating...' : 'Download Statement'}
          </button>

          <button
            onClick={() => {
              if (waStatus === 'disabled') return setStmtMsg('WhatsApp is Disabled in Demo due to security reasons.')
              setWaStmtModal(true)
            }}
            title={waStatus === 'disabled' ? 'Disabled in Demo due to security reasons' : 'Send statement on WhatsApp'}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
              waStatus === 'disabled'
                ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 border-slate-700/60 text-slate-200 hover:bg-slate-700/80'
            }`}
          >
            <Send className="w-4 h-4" /> Send Statement on WhatsApp
          </button>

          {stmtMsg && (
            <p
              onClick={() => setStmtMsg('')}
              className={`text-xs cursor-pointer flex items-center gap-1.5 ${stmtSuccess ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {stmtSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />} {stmtMsg}
            </p>
          )}
        </div>

        {/* DUE ALERT */}
        {totalDue > 0 && (() => {
          const orderDueCount  = orders.filter(o => o.balance_due > 0).length
          const orderDueAmount = orders.reduce((s, o) => s + Number(o.balance_due || 0), 0)
          const obDue          = Number(customer.opening_balance || 0)
          return (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm px-4 py-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                This customer has <strong className="text-white">₹{totalDue}</strong> pending
                {orderDueCount > 0 && <> — <strong className="text-white">₹{orderDueAmount}</strong> across <strong className="text-white">{orderDueCount}</strong> order{orderDueCount !== 1 ? 's' : ''}</>}
                {obDue > 0 && <>{orderDueCount > 0 ? ', ' : ' — '}<strong className="text-white">₹{obDue}</strong> opening balance</>}.
              </span>
            </div>
          )
        })()}

        {/* PAYMENT BREAKDOWN */}
        <Card>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4" /> Payment Breakdown</h3>
          <div className="flex gap-3 flex-wrap">
            {customer.totalAdvance > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-amber-500 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-amber-400 font-mono">₹{customer.totalAdvance}</div>
                <div className="text-[11px] text-slate-400">Advance Payments</div>
              </div>
            )}
            {customer.totalOrderPayments > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-blue-500 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-blue-400 font-mono">₹{customer.totalOrderPayments}</div>
                <div className="text-[11px] text-slate-400">Order Payments</div>
              </div>
            )}
            {customer.totalUpi > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-sky-500 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-sky-400 font-mono">₹{customer.totalUpi}</div>
                <div className="text-[11px] text-slate-400">UPI Payments</div>
              </div>
            )}
            {customer.totalChequeCleared > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-purple-500 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-purple-400 font-mono">₹{customer.totalChequeCleared}</div>
                <div className="text-[11px] text-slate-400">Cheques (Cleared)</div>
              </div>
            )}
            {customer.totalCashIncome > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-teal-500 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-teal-400 font-mono">₹{customer.totalCashIncome}</div>
                <div className="text-[11px] text-slate-400">Cash Income</div>
              </div>
            )}
            {customer.totalDiscount > 0 && (
              <div className="bg-slate-800/40 border-l-4 border-orange-400 rounded-xl px-4 py-3 min-w-[140px]">
                <div className="text-lg font-bold text-orange-300 font-mono">₹{customer.totalDiscount}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1"><Scissors className="w-3 h-3" /> Discount / Round-off</div>
              </div>
            )}
          </div>
        </Card>

        {/* COMPLETE PAYMENT HISTORY */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Complete Payment History</h3>
          {payments.length === 0 ? (
            <p className="text-slate-500 text-sm">No payments recorded yet.</p>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <Table minWidth="700px">
                <THead>
                  <Th className="pl-4">Date</Th>
                  <Th>Type</Th>
                  <Th>Source / Account</Th>
                  <Th>Amount</Th>
                  <Th className="pr-4">Status</Th>
                </THead>
                <TBody>
                  {orders.filter(o => o.discount_amount > 0).map((o) => (
                    <Tr key={`disc-${o.id}`} className="bg-orange-500/5">
                      <Td className="pl-4 text-slate-300">{o.created_at?.split(' ')[0] || '—'}</Td>
                      <Td><Badge tone="orange" icon={Scissors}>Discount</Badge></Td>
                      <Td className="text-slate-300">
                        {o.discount_note || 'Round-off'}
                        <span className="text-[11px] text-slate-500"> (Order #{o.id})</span>
                      </Td>
                      <Td><strong className="text-orange-400 font-mono">- ₹{o.discount_amount}</strong></Td>
                      <Td className="pr-4 text-slate-500">—</Td>
                    </Tr>
                  ))}
                  {payments.map((p, i) => (
                    <Tr key={i}>
                      <Td className="pl-4">
                        <div className="text-slate-300">{p.date || '—'}</div>
                        {p.created_at && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" /> {fmtDT(p.created_at)}
                          </div>
                        )}
                      </Td>
                      <Td><Badge tone={PAYMENT_TYPE_TONE[p.payment_type] || 'slate'}>{p.payment_type}</Badge></Td>
                      <Td className="text-slate-300">
                        {p.source || '—'}
                        {p.cheque_number && <span className="text-[11px] text-slate-500"> #{p.cheque_number}</span>}
                        {p.order_description && <span className="text-[11px] text-slate-500"> ({p.order_description})</span>}
                      </Td>
                      <Td>
                        <strong className={`font-mono ${
                          p.payment_type === 'Commission' || p.status === 'bounced' ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {p.payment_type === 'Commission' ? '-' : ''}₹{p.amount}
                        </strong>
                      </Td>
                      <Td className="pr-4">
                        {p.status ? <Badge tone={CHEQUE_STATUS_TONE[p.status] || 'slate'}>{p.status}</Badge> : '—'}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>

        {/* ALL ORDERS */}
        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> All Orders</h3>
          {orders.length === 0 ? (
            <p className="text-slate-500 text-sm">No orders yet.</p>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <Table minWidth="750px">
                <THead>
                  <Th className="pl-4">#</Th>
                  <Th>Description</Th>
                  <Th>Total</Th>
                  <Th>Advance</Th>
                  <Th>Balance Due</Th>
                  <Th>Status</Th>
                  <Th>Follow-up</Th>
                  <Th className="pr-4">Date</Th>
                </THead>
                <TBody>
                  {orders.map((o, index) => (
                    <Tr key={o.id} onClick={() => navigate('/orders')}>
                      <Td className="pl-4 text-slate-400">{index + 1}</Td>
                      <Td className="text-slate-300">{o.description || '—'}</Td>
                      <Td className="font-mono text-slate-200">₹{o.total_amount}</Td>
                      <Td className="font-mono text-slate-300">₹{o.advance_paid}</Td>
                      <Td>
                        <span className={`font-mono font-bold ${o.balance_due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          ₹{o.balance_due}
                        </span>
                      </Td>
                      <Td><Badge tone={ORDER_STATUS_TONE[o.status] || 'slate'}>{o.status?.replace('_', ' ')}</Badge></Td>
                      <Td>
                        {o.follow_up_date
                          ? <span className={o.follow_up_date <= new Date().toISOString().split('T')[0] ? 'text-red-400' : 'text-slate-300'}>
                              {o.follow_up_date}
                            </span>
                          : <span className="text-slate-500">—</span>}
                      </Td>
                      <Td className="pr-4 text-slate-400">{new Date(o.created_at).toLocaleDateString('en-IN')}</Td>
                    </Tr>
                  ))}
                </TBody>
                <tfoot>
                  <tr className="bg-slate-800/40 border-t border-slate-800">
                    <td colSpan="2" className="py-3 pl-4 pr-4 font-bold text-white">Total</td>
                    <td className="py-3 pr-4 font-bold text-white font-mono">₹{totalBilled}</td>
                    <td className="py-3 pr-4 font-bold text-slate-200 font-mono">₹{customer.totalAdvance}</td>
                    <td className={`py-3 pr-4 font-bold font-mono ${totalDue > 0 ? 'text-red-400' : totalDue < 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
                      {totalDue < 0 ? `−₹${Math.abs(totalDue)}` : `₹${totalDue}`}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </Table>
            </Card>
          )}
        </div>

        {/* STATEMENT WHATSAPP MODAL */}
        <Modal open={waStmtModal} onClose={() => setWaStmtModal(false)} width="380px">
          <h3 className="text-emerald-400 font-bold mb-1.5 flex items-center gap-2">
            <Send className="w-4 h-4" /> Send Statement via WhatsApp
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Customer: <strong className="text-slate-200">{customer.firm_name}</strong>
            {totalDue > 0 && (
              <> <br />Balance Due: <strong className="text-red-400">₹{totalDue}</strong> — a UPI QR will be included too</>
            )}
          </p>
          {totalDue > 0 && (
            <>
              <label className={labelClasses}>UPI Account for Payment QR</label>
              <select
                value={waStmtUpi}
                onChange={e => setWaStmtUpi(e.target.value)}
                className={`${inputClasses} mb-4`}
              >
                <option value="">Select UPI Account</option>
                <option value="demo1@upi">Demo UPI Account 1</option>
                <option value="demo2@upi">Demo UPI Account 2</option>
                <option value="demo3@upi">Demo UPI Account 3</option>
                <option value="demo4@upi">Demo UPI Account 4</option>
              </select>
            </>
          )}
          <div className="flex gap-2.5">
            <SecondaryButton className="flex-1 justify-center py-2.5" onClick={() => setWaStmtModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              icon={Send}
              disabled={waStmtSending || (totalDue > 0 && !waStmtUpi)}
              onClick={handleSendStatementWA}
              className="flex-1 py-2.5 !bg-none !bg-[#25D366] hover:!bg-[#20bd5a] !shadow-none"
            >
              {waStmtSending ? 'Sending...' : 'Send Now'}
            </PrimaryButton>
          </div>
        </Modal>

        {/* PHOTO LIGHTBOX */}
        {showPhotoModal && customer.photo_path && (
          <div
            onClick={() => setShowPhotoModal(false)}
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-[1000] cursor-pointer p-4"
          >
            <img
              src={`http://localhost:5000/${customer.photo_path}`}
              alt={customer.firm_name}
              className="max-w-[90%] max-h-[90%] rounded-xl shadow-2xl cursor-default"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute top-5 right-7 text-white hover:text-slate-300"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        )}
      </div>
    </PageLock>
  )
}

export default CustomerProfile