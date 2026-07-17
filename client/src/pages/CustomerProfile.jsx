import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCustomerProfile, addOpeningBalance, uploadCustomerPhoto, deleteCustomerPhoto, generateCustomerStatement, sendStatementWhatsApp, getWhatsAppStatus } from '../services/api'
import PageLock from '../components/PageLock'
import SectionLoader from '../components/SectionLoader'
import {
  Camera,
  Phone,
  NotebookPen,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Banknote,
  Scissors,
  ClipboardList,
  Clock,
  Package,
  X,
} from 'lucide-react'

function CustomerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showObForm, setShowObForm] = useState(false)
  const [obAmount, setObAmount]     = useState('')
  const [obDate, setObDate]         = useState(new Date().toLocaleDateString('en-CA'))
  const [obNotes, setObNotes]       = useState('Pichle saal ka bakaya')
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
  // WhatsApp status — demo mein hamesha 'disabled' aayega backend se
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

  // Teeno independent messages (opening-balance, photo, statement) ab khud
  // 4 sec baad gayab ho jaate hain — pehle sirf click-karke hatao tha.
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

  if (loading) return <SectionLoader label="Customer profile load ho raha hai..." size="large" minHeight="60vh" />
  if (!customer) return <p style={{ padding: '20px' }}>Customer not found.</p>

  const orders = customer.orders || []
  const payments = customer.payments || []
  const totalBilled = customer.totalBilled || 0
  const totalPaid = customer.totalPaid || 0
  const totalDue = customer.totalDue || 0

  function paymentTypeColor(type) {
    const colors = {
      'Advance': '#f39c12',
      'Order Payment': '#3498db',
      'UPI': '#0a6ebd',
      'Cheque': '#8e44ad',
      'Cash Income': '#16a085',
      'Commission': '#e65100'
    }
    return colors[type] || '#888'
  }
  function fmtDT(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2,'0')
  const min = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
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
  if (!waStmtUpi) return setStmtMsg('UPI account select karo.')
  setWaStmtSending(true)
  try {
    await sendStatementWhatsApp(id, waStmtUpi)
    setStmtMsg('Statement WhatsApp par send ho gayi')
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
      // Reload profile
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
  function chequeStatusBadge(status) {
    const colors = {
      received: '#f39c12',
      deposited: '#3498db',
      cleared: '#27ae60',
      bounced: '#e74c3c'
    }
    return colors[status] || '#888'
  }

  return (
    <PageLock pageKey="customer-profile" pageTitle="Customer Profile">
    <div>
      <button onClick={() => navigate('/customers')} style={styles.backBtn}>
        ← Back to Customers
      </button>

      {/* CUSTOMER HEADER */}
      <div style={styles.profileCard}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative' }}>
            {customer.photo_path ? (
              <img
                src={`http://localhost:5000/${customer.photo_path}`}
                alt={customer.firm_name}
                style={{ ...styles.photoCircle, cursor: 'pointer' }}
                onClick={() => setShowPhotoModal(true)}
              />
            ) : (
              <div style={{ ...styles.photoCircle, ...styles.photoPlaceholder }}>
                {customer.firm_name?.charAt(0).toUpperCase()}
              </div>
            )}
            <label style={styles.photoEditBtn} title="Upload photo">
              <Camera size={13} />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div>
            <h2 style={{ marginBottom: '4px' }}>{customer.firm_name}</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>
              {customer.contact_name && `Contact: ${customer.contact_name}`}
              {customer.phone && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {' • '}<Phone size={12} /> {customer.phone}
                </span>
              )}
            </p>
            {photoUploading && <p style={{ fontSize: '12px', color: '#888' }}>Uploading...</p>}
            {photoMsg && (
              <p style={{ fontSize: '12px', color: photoMsg.includes('Error') ? '#e74c3c' : '#27ae60' }}>
                {photoMsg}
                {customer.photo_path && !photoMsg.includes('Error') && (
                  <span onClick={handlePhotoRemove} style={{ marginLeft: '8px', color: '#e74c3c', cursor: 'pointer', textDecoration: 'underline' }}>
                    Remove
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statNum}>₹{totalBilled}</div>
            <div style={styles.statLabel}>Total Billed</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: '#27ae60' }}>₹{totalPaid}</div>
            <div style={styles.statLabel}>Total Paid</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statNum, color: totalDue > 0 ? '#e74c3c' : totalDue < 0 ? '#e67e22' : '#27ae60' }}>
              {totalDue < 0 ? `−₹${Math.abs(totalDue)} (Hum denge)` : `₹${totalDue}`}
            </div>
            <div style={styles.statLabel}>Total Due</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statNum}>{orders.length}</div>
            <div style={styles.statLabel}>Total Orders</div>
          </div>
        </div>
      </div>

      {/* OPENING BALANCE DISPLAY — pehle ye kahi nahi dikhta tha, sirf Total Due
          mein silently mix ho jaata tha. Ab clear purple banner, statement PDF
          jaisi hi styling. */}
      {customer.opening_balance > 0 && (
        <div style={styles.obBanner}>
          <div>
            <div style={styles.obBannerLabel}>Opening Balance (Purana Bakaya)</div>
            <div style={styles.obBannerSub}>
              {customer.opening_balance_notes || ''}
              {customer.opening_balance_date && `  •  ${customer.opening_balance_date}`}
            </div>
          </div>
          <div style={styles.obBannerAmt}>₹{customer.opening_balance}</div>
        </div>
      )}

      {showObForm && (
        <div style={{
          backgroundColor: '#fff', border: '2px solid #8e44ad',
          borderRadius: '10px', padding: '20px', marginBottom: '20px'
        }}>
          <h3 style={{ color: '#8e44ad', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotebookPen size={17} /> Opening Balance — {customer.firm_name}
          </h3>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>
            Pichle financial year ka jo bhi bakaya hai wo yahan add karo.
            Customer ke total due mein seedha jud jayega (naya order nahi banega).
          </p>
          <form onSubmit={handleOpeningBalance}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                  Bakaya Amount (₹) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={obAmount}
                  onChange={e => { setObAmount(e.target.value); if (obMsg) setObMsg('') }}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '6px',
                    border: '1px solid #ddd', fontSize: '16px', fontWeight: 'bold',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={obDate}
                  onChange={e => setObDate(e.target.value)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '6px',
                    border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                  Notes
                </label>
                <input
                  type="text"
                  value={obNotes}
                  onChange={e => setObNotes(e.target.value)}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '6px',
                    border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            {obMsg && (
              <p style={{
                marginTop: '10px', padding: '8px 12px', borderRadius: '6px',
                backgroundColor: obMsg.includes('Error') ? '#fff3f3' : '#e8f5e9',
                color: obMsg.includes('Error') ? '#c0392b' : '#2e7d32',
                fontSize: '13px'
              }}>
                {obMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                type="submit"
                disabled={obSaving}
                style={{
                  backgroundColor: '#8e44ad', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: '6px', cursor: obSaving ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 'bold', opacity: obSaving ? 0.6 : 1
                }}
              >
                {obSaving ? 'Saving...' : 'Save Opening Balance'}
              </button>
              <button
                type="button"
                disabled={obSaving}
                onClick={() => { setShowObForm(false); setObMsg('') }}
                style={{
                  backgroundColor: '#fff', color: '#888', border: '1px solid #ddd',
                  padding: '10px 20px', borderRadius: '6px', cursor: obSaving ? 'not-allowed' : 'pointer', fontSize: '14px',
                  opacity: obSaving ? 0.6 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {/* ACTION BUTTONS — opening balance ek alag-intent action hai (purple accent
          rakha hai jaanbujh kar), isliye ek thin divider se statement-actions se
          visually separate kiya hai, par sab ek hi row mein, same height/padding. */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setShowObForm(f => !f)}
          style={{
            backgroundColor: '#8e44ad', color: '#fff', border: '1px solid #8e44ad',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 'bold',
            display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}
        >
          <NotebookPen size={15} /> Add Opening Balance (Purana Bakaya)
        </button>

        <div style={{ width: '1px', height: '28px', backgroundColor: '#e0e0e0', flexShrink: 0 }} />

        <button
          onClick={handleDownloadStatement}
          disabled={stmtLoading}
          style={{ backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', opacity: stmtLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {stmtLoading ? 'Generating...' : <><FileText size={15} /> Download Statement</>}
        </button>
        <button
          onClick={() => {
            if (waStatus === 'disabled') return setStmtMsg('WhatsApp is Disabled in Demo due to security reasons.')
            setWaStmtModal(true)
          }}
          style={{
            backgroundColor: waStatus === 'disabled' ? '#f5f5f5' : '#fff',
            color: waStatus === 'disabled' ? '#aaa' : '#1a1a2e',
            border: waStatus === 'disabled' ? '1px solid #ddd' : '1px solid #1a1a2e',
            padding: '10px 20px', borderRadius: '8px',
            cursor: waStatus === 'disabled' ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px'
          }}
          title={waStatus === 'disabled' ? 'Disabled in Demo due to security reasons' : 'Send statement on WhatsApp'}
        >
          <Send size={15} /> Send Statement on WhatsApp
        </button>
        {stmtMsg && (
          <p style={{ fontSize: '13px', color: stmtSuccess ? '#27ae60' : '#e74c3c', alignSelf: 'center', margin: 0, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
            onClick={() => setStmtMsg('')}>
            {stmtSuccess ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {stmtMsg}
          </p>
        )}
      </div>
      {/* DUE ALERT — ab opening-balance ko bhi account mein leta hai, taaki
          "pending across 0 order(s)" jaisa confusing case na ho jab poora due
          sirf opening-balance se ho, kisi order se nahi. */}
      {totalDue > 0 && (() => {
        const orderDueCount  = orders.filter(o => o.balance_due > 0).length
        const orderDueAmount = orders.reduce((s, o) => s + Number(o.balance_due || 0), 0)
        const obDue          = Number(customer.opening_balance || 0)
        return (
          <div style={{ ...styles.dueAlert, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> This customer has <strong>₹{totalDue}</strong> pending
            {orderDueCount > 0 && <> — <strong>₹{orderDueAmount}</strong> across <strong>{orderDueCount}</strong> order(s)</>}
            {obDue > 0 && <>{orderDueCount > 0 ? ', ' : ' — '}<strong>₹{obDue}</strong> opening balance</>}.
          </div>
        )
      })()}

      {/* PAYMENT BREAKDOWN */}
      <div style={styles.paymentBreakdown}>
        <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Wallet size={17} /> Payment Breakdown</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {customer.totalAdvance > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #f39c12' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f39c12' }}>₹{customer.totalAdvance}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Advance Payments</div>
            </div>
          )}
          {customer.totalOrderPayments > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #3498db' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3498db' }}>₹{customer.totalOrderPayments}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Order Payments</div>
            </div>
          )}
          {customer.totalUpi > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #0a6ebd' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0a6ebd' }}>₹{customer.totalUpi}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>UPI Payments</div>
            </div>
          )}
          {customer.totalChequeCleared > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #8e44ad' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8e44ad' }}>₹{customer.totalChequeCleared}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Cheques (Cleared)</div>
            </div>
          )}
          {/* NEW: cash income breakdown tile */}
          {customer.totalCashIncome > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #16a085' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a085' }}>₹{customer.totalCashIncome}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Cash Income</div>
            </div>
          )}

          {/* NEW: Commission tile */}
          {customer.totalCommission > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #e65100' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e65100' }}>₹{customer.totalCommission}</div>
              <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}><Banknote size={12} /> Commission Wapas Ki</div>
            </div>
          )}
          {customer.totalDiscount > 0 && (
            <div style={{ ...styles.breakdownItem, borderLeft: '4px solid #e67e22' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e67e22' }}>₹{customer.totalDiscount}</div>
              <div style={{ fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}><Scissors size={12} /> Discount / Round-off</div>
            </div>
          )}
        </div>
      </div>

      {/* COMPLETE PAYMENT HISTORY */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={17} /> Complete Payment History</h3>
        {payments.length === 0 ? (
          <p style={{ color: '#888' }}>No payments recorded yet.</p>
        ) : (
          <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Source / Account</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.filter(o => o.discount_amount > 0).map((o) => (
                <tr key={`disc-${o.id}`} style={{ ...styles.tr, backgroundColor: '#fff8e1' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff3cd'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff8e1'}
                >
                  <td style={styles.td}>
                    <div>{o.created_at?.split(' ')[0] || '—'}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: '#e67e22', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Scissors size={11} /> Discount
                    </span>
                  </td>
                  <td style={styles.td}>
                    {o.discount_note || 'Round-off'}
                    <span style={{ fontSize: '12px', color: '#888' }}> (Order #{o.id})</span>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: '#e67e22' }}>- ₹{o.discount_amount}</strong>
                  </td>
                  <td style={styles.td}>—</td>
                </tr>
              ))}
              {payments.map((p, i) => (
                <tr key={i} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>
                    <div>{p.date || '—'}</div>
                    {p.created_at && <div style={{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {fmtDT(p.created_at)}</div>}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: paymentTypeColor(p.payment_type) }}>
                      {p.payment_type}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {p.source || '—'}
                    {p.cheque_number && <span style={{ fontSize: '12px', color: '#888' }}> #{p.cheque_number}</span>}
                    {p.order_description && <span style={{ fontSize: '12px', color: '#888' }}> ({p.order_description})</span>}
                  </td>
                  <td style={styles.td}>
                    <strong style={{ 
                      color: p.payment_type === 'Commission' 
                        ? '#e74c3c' 
                        : p.status === 'bounced' 
                          ? '#e74c3c' 
                          : '#27ae60' 
                    }}>
                      {p.payment_type === 'Commission' ? '-' : ''}₹{p.amount}
                    </strong>
                  </td>
                  <td style={styles.td}>
                    {p.status ? (
                      <span style={{ ...styles.badge, backgroundColor: chequeStatusBadge(p.status), fontSize: '11px' }}>
                        {p.status}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ALL ORDERS */}
      <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={17} /> All Orders</h3>
      {orders.length === 0 ? (
        <p style={{ color: '#888' }}>No orders yet.</p>
      ) : (
        <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Advance</th>
              <th style={styles.th}>Balance Due</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Follow-up</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, index) => (
              <tr key={o.id} style={styles.tr}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <td style={styles.td}>{index + 1}</td>
                <td style={styles.td}>{o.description || '—'}</td>
                <td style={styles.td}>₹{o.total_amount}</td>
                <td style={styles.td}>₹{o.advance_paid}</td>
                <td style={styles.td}>
                  <span style={{ fontWeight: 'bold', color: o.balance_due > 0 ? '#e74c3c' : '#27ae60' }}>
                    ₹{o.balance_due}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, backgroundColor: statusColor(o.status) }}>
                    {o.status?.replace('_', ' ')}
                  </span>
                </td>
                <td style={styles.td}>
                  {o.follow_up_date
                    ? <span style={{ color: o.follow_up_date <= new Date().toISOString().split('T')[0] ? '#e74c3c' : '#333' }}>
                        {o.follow_up_date}
                      </span>
                    : '—'}
                </td>
                <td style={styles.td}>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8f8f8' }}>
              <td colSpan="2" style={{ ...styles.td, fontWeight: 'bold' }}>Total</td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>₹{totalBilled}</td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>₹{customer.totalAdvance}</td>
              <td style={{ 
                ...styles.td, 
                fontWeight: 'bold', 
                color: totalDue > 0 ? '#e74c3c' : totalDue < 0 ? '#e67e22' : '#27ae60' 
              }}>
                {totalDue < 0 ? `−₹${Math.abs(totalDue)}` : `₹${totalDue}`}
              </td>
              <td colSpan="3"></td>
            </tr>
          </tfoot>
        </table>
        </div>
      )}
      {/* STATEMENT WHATSAPP MODAL */}
      {waStmtModal && (
        <div onClick={() => setWaStmtModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: '8px', color: '#25D366', display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={17} /> Send Statement via WhatsApp</h3>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px' }}>
              Customer: <strong>{customer.firm_name}</strong>
              {totalDue > 0 && <><br/>Balance Due: <strong style={{ color: '#e74c3c' }}>₹{totalDue}</strong> — UPI QR bhi jayega</>}
            </p>
            {totalDue > 0 && (
              <>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>UPI Account for Payment QR</label>
                <select value={waStmtUpi} onChange={e => setWaStmtUpi(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }}>
                  <option value=''>Select UPI Account</option>
                  <option value='demo1@upi'>Demo UPI Account 1</option>
                  <option value='demo2@upi'>Demo UPI Account 2</option>
                  <option value='demo3@upi'>Demo UPI Account 3</option>
                  <option value='demo4@upi'>Demo UPI Account 4</option>
                </select>
              </>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setWaStmtModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSendStatementWA} disabled={waStmtSending || (totalDue > 0 && !waStmtUpi)}
                style={{ flex: 2, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#25D366', color: '#fff', cursor: 'pointer', fontWeight: 'bold', opacity: (waStmtSending || (totalDue > 0 && !waStmtUpi)) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {waStmtSending ? 'Sending...' : <><Send size={14} /> Send Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PHOTO MODAL */}
      {showPhotoModal && customer.photo_path && (
        <div
          onClick={() => setShowPhotoModal(false)}
          style={styles.photoModalOverlay}
        >
          <img
            src={`http://localhost:5000/${customer.photo_path}`}
            alt={customer.firm_name}
            style={styles.photoModalImg}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setShowPhotoModal(false)}
            style={{ ...styles.photoModalClose, display: 'flex', alignItems: 'center' }}
          >
            <X size={28} />
          </button>
        </div>
      )}
    </div>
    </PageLock>
  )
}

function statusColor(status) {
  const colors = { pending: '#f39c12', in_progress: '#3498db', ready: '#27ae60', delivered: '#95a5a6' }
  return colors[status] || '#ccc'
}

const styles = {
  backBtn: { backgroundColor: '#fff', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' },
  profileCard: { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' },
  statsRow: { display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' },
  statBox: { backgroundColor: '#f8f8f8', padding: '16px 24px', borderRadius: '8px', textAlign: 'center', minWidth: '120px' },
  statNum: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e' },
  statLabel: { fontSize: '12px', color: '#888', marginTop: '4px' },
  dueAlert: { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' },
  obBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f5f0ff', borderLeft: '4px solid #8e44ad', padding: '14px 18px', borderRadius: '8px', marginBottom: '16px' },
  obBannerLabel: { fontSize: '13px', fontWeight: 'bold', color: '#8e44ad' },
  obBannerSub: { fontSize: '12px', color: '#888', marginTop: '3px' },
  obBannerAmt: { fontSize: '18px', fontWeight: 'bold', color: '#8e44ad' },
  paymentBreakdown: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  breakdownItem: { backgroundColor: '#f8f8f8', padding: '14px 18px', borderRadius: '8px', minWidth: '140px' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '700px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '24px' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  badge: { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', textTransform: 'capitalize' },
  photoCircle: { width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee', boxSizing: 'border-box' },
  photoPlaceholder: { backgroundColor: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' },
  photoEditBtn: { position: 'absolute', bottom: '-2px', right: '-2px', backgroundColor: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 1 },
  photoModalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' },
  photoModalImg: { maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'default' },
  photoModalClose: { position: 'absolute', top: '20px', right: '30px', backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer' }
}

export default CustomerProfile
