import { useState, useEffect, Fragment } from 'react'
import { getCustomers, createCustomer, deleteCustomer, updateCustomer } from '../services/api'
import { useNavigate } from 'react-router-dom'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'

function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firm_name: '', contact_name: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // Inline row-edit — jahan "Edit" click hua wahi khulta hai, top pe nahi
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ firm_name: '', contact_name: '', phone: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)
  

  useEffect(() => {
    fetchCustomers()
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Message ab khud 4 sec baad gayab ho jaata hai — pehle sirf click-karke
  // hatao tha.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  function fetchCustomers() {
    setLoading(true)
    getCustomers(search)
      .then(res => {
        setCustomers(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAddCustomer(e) {
    e.preventDefault()
    if (!form.firm_name) {
      setMessage('Firm name is required.')
      return
    }
    setSubmitting(true)
    createCustomer(form)
      .then(() => {
        setMessage('Customer added successfully!')
        setForm({ firm_name: '', contact_name: '', phone: '' })
        setShowForm(false)
        fetchCustomers()
      })
      .catch(() => setMessage('Error adding customer.'))
      .finally(() => setSubmitting(false))
  }

  function handleDelete(id, firmName) {
    if (!window.confirm(`Delete "${firmName}"? This cannot be undone.`)) return
    deleteCustomer(id)
      .then(() => {
        setMessage('Customer deleted.')
        fetchCustomers()
      })
      .catch(() => setMessage('Error deleting customer.'))
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({ firm_name: c.firm_name || '', contact_name: c.contact_name || '', phone: c.phone || '' })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value })
  }

  function handleEditSubmit(e, id) {
    e.preventDefault()
    if (!editForm.firm_name) {
      setMessage('Firm name is required.')
      return
    }
    setEditSubmitting(true)
    updateCustomer(id, editForm)
      .then(() => {
        setMessage('Customer updated successfully!')
        setEditingId(null)
        fetchCustomers()
      })
      .catch(() => setMessage('Error updating customer.'))
      .finally(() => setEditSubmitting(false))
  }

  return (
    <div>
      <div style={styles.header}>
        <h2>Customers</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>New Customer</h3>
          <form onSubmit={handleAddCustomer}>
            <div style={styles.formRow}>
              <input
                style={styles.input}
                placeholder="Firm / Shop Name *"
                name="firm_name"
                value={form.firm_name}
                onChange={handleFormChange}
              />
              <input
                style={styles.input}
                placeholder="Contact Person Name"
                name="contact_name"
                value={form.contact_name}
                onChange={handleFormChange}
              />
              <input
                style={styles.input}
                placeholder="Phone Number"
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
              />
            </div>
            <LoadingButton loading={submitting} style={styles.submitBtn} type="submit">
              Save Customer
            </LoadingButton>
          </form>
        </div>
      )}

      <input
        style={styles.searchInput}
        placeholder="Search by firm name, contact or phone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <SectionLoader label="Customers load ho rahe hain..." />
      ) : customers.length === 0 ? (
        <p style={{ color: '#888' }}>No customers found.</p>
      ) : (
        <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Firm Name</th>
              <th style={styles.th}>Contact Person</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>Added On</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, index) => (
              <Fragment key={c.id}>
                <tr
                  style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}>
                    <strong
                      onClick={() => navigate(`/customers/${c.id}`)}
                      style={{ cursor: 'pointer', color: '#3498db' }}
                    >
                      {c.firm_name}
                    </strong>
                  </td>
                  <td style={styles.td}>{c.contact_name || '—'}</td>
                  <td style={styles.td}>{c.phone || '—'}</td>
                  <td style={styles.td}>{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => editingId === c.id ? cancelEdit() : startEdit(c)}
                        style={styles.editBtn}
                      >
                        {editingId === c.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button onClick={() => handleDelete(c.id, c.firm_name)} style={styles.deleteBtn}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Inline edit-form — usi row ke neeche khulta hai, top pe nahi jaata */}
                {editingId === c.id && (
                  <tr>
                    <td colSpan="6" style={{ padding: 0, borderBottom: '1px solid #f0f0f0' }}>
                      <form onSubmit={e => handleEditSubmit(e, c.id)} style={styles.editRow}>
                        <input
                          style={styles.input}
                          placeholder="Firm / Shop Name *"
                          name="firm_name"
                          value={editForm.firm_name}
                          onChange={handleEditChange}
                        />
                        <input
                          style={styles.input}
                          placeholder="Contact Person Name"
                          name="contact_name"
                          value={editForm.contact_name}
                          onChange={handleEditChange}
                        />
                        <input
                          style={styles.input}
                          placeholder="Phone Number"
                          name="phone"
                          value={editForm.phone}
                          onChange={handleEditChange}
                        />
                        <LoadingButton loading={editSubmitting} style={styles.submitBtn} type="submit">
                          Save Changes
                        </LoadingButton>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', flex: '1', minWidth: '200px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  searchInput: { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '650px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff', transition: 'background 0.15s' },
  deleteBtn: { backgroundColor: '#800000', color: '#fff', border: '1px solid #800000', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  editBtn: { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  editRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '14px 16px', backgroundColor: '#f9f9fc' }
}

export default Customers