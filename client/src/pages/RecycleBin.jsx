import { useState, useEffect } from 'react'
import api from '../services/api'
import { Trash2, Undo2 } from 'lucide-react'
import SectionLoader from '../components/SectionLoader'

function RecycleBin() {
  const [deletedCustomers, setDeletedCustomers] = useState([])
  const [deletedOrders, setDeletedOrders] = useState([])
  const [message, setMessage] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    fetchDeleted()
  }, [])

  // Message ab khud 4 sec baad gayab ho jaata hai — pehle sirf click-karke
  // hatao tha.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  function fetchDeleted() {
    api.get('/customers/deleted/recent')
      .then(res => setDeletedCustomers(res.data))
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
    api.get('/orders/deleted/recent')
      .then(res => setDeletedOrders(res.data))
      .catch(() => {})
      .finally(() => setLoadingOrders(false))
  }

  function restoreCustomer(id) {
    api.put(`/customers/${id}/restore`)
      .then(() => {
        setMessage('Customer restored!')
        fetchDeleted()
      })
  }

  function restoreOrder(id) {
    api.put(`/orders/${id}/restore`)
      .then(() => {
        setMessage('Order restored!')
        fetchDeleted()
      })
  }

  return (
    <div>
      <h2 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={20} /> Recycle Bin</h2>
      <p style={{ color: '#888', marginBottom: '20px', fontSize: '14px' }}>
        Items deleted in last 30 days. After 30 days they are permanently gone.
      </p>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {/* DELETED CUSTOMERS */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Deleted Customers ({deletedCustomers.length})</h3>
        {loadingCustomers ? (
          <SectionLoader label="Deleted customers load ho rahe hain..." size="small" />
        ) : deletedCustomers.length === 0 ? (
          <p style={styles.empty}>No recently deleted customers.</p>
        ) : (
          <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Firm Name</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Deleted At</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {deletedCustomers.map(c => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.firm_name}</td>
                  <td style={styles.td}>{c.phone || '—'}</td>
                  <td style={styles.td}>{new Date(c.deleted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  <td style={styles.td}>
                    <button onClick={() => restoreCustomer(c.id)} style={{ ...styles.restoreBtn, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Undo2 size={13} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* DELETED ORDERS */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Deleted Orders ({deletedOrders.length})</h3>
        {loadingOrders ? (
          <SectionLoader label="Deleted orders load ho rahe hain..." size="small" />
        ) : deletedOrders.length === 0 ? (
          <p style={styles.empty}>No recently deleted orders.</p>
        ) : (
          <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Order #</th>
                <th style={styles.th}>Firm</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Deleted At</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {deletedOrders.map(o => (
                <tr key={o.id}>
                  <td style={styles.td}>#{o.id}</td>
                  <td style={styles.td}>{o.firm_name}</td>
                  <td style={styles.td}>₹{o.total_amount}</td>
                  <td style={styles.td}>{new Date(o.deleted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                  <td style={styles.td}>
                    <button onClick={() => restoreOrder(o.id)} style={{ ...styles.restoreBtn, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Undo2 size={13} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  section: { marginBottom: '30px' },
  sectionTitle: { marginBottom: '12px', fontSize: '16px' },
  empty: { color: '#888', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '500px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '10px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '10px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  restoreBtn: { backgroundColor: '#fff', color: '#27ae60', border: '1px solid #27ae60', padding: '5px 14px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }
}

export default RecycleBin