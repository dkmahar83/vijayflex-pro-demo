import { useState, useEffect, Fragment } from 'react'
import { getCustomers, createCustomer, deleteCustomer, updateCustomer } from '../services/api'
import { useNavigate } from 'react-router-dom'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import { PrimaryButton, SecondaryButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'
import { Plus, X, Search, Pencil, Trash2 } from 'lucide-react'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'

function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ firm_name: '', contact_name: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  // Inline row-edit — opens directly under the row that was clicked, not at the top.
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ firm_name: '', contact_name: '', phone: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  useEffect(() => {
    fetchCustomers()
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Message now auto-clears after 4s instead of requiring a manual click to dismiss.
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
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Manage client details and contact information"
        actions={
          showForm ? (
            <SecondaryButton icon={X} onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          ) : (
            <PrimaryButton icon={Plus} onClick={() => setShowForm(true)}>Add Customer</PrimaryButton>
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
          <h3 className="text-white font-bold mb-4">New Customer</h3>
          <form onSubmit={handleAddCustomer} className="flex flex-col sm:flex-row gap-3">
            <input
              className={inputClasses}
              placeholder="Firm / Shop Name *"
              name="firm_name"
              value={form.firm_name}
              onChange={handleFormChange}
            />
            <input
              className={inputClasses}
              placeholder="Contact Person Name"
              name="contact_name"
              value={form.contact_name}
              onChange={handleFormChange}
            />
            <input
              className={inputClasses}
              placeholder="Phone Number"
              name="phone"
              value={form.phone}
              onChange={handleFormChange}
            />
            <LoadingButton
              loading={submitting}
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 shrink-0"
            >
              Save Customer
            </LoadingButton>
          </form>
        </Card>
      )}

      <Card className="!p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputClasses} pl-10`}
            placeholder="Search by firm name, contact or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <SectionLoader label="Loading customers..." />
      ) : customers.length === 0 ? (
        <p className="text-slate-500 text-sm">No customers found.</p>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <Table minWidth="650px">
            <THead>
              <Th className="pl-4">#</Th>
              <Th>Firm Name</Th>
              <Th>Contact Person</Th>
              <Th>Phone</Th>
              <Th>Added On</Th>
              <Th className="pr-4">Actions</Th>
            </THead>
            <TBody>
              {customers.map((c, index) => (
                <Fragment key={c.id}>
                  <Tr>
                    <Td className="pl-4 text-slate-400">{index + 1}</Td>
                    <Td>
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="font-bold text-blue-400 hover:text-blue-300 hover:underline text-left"
                      >
                        {c.firm_name}
                      </button>
                    </Td>
                    <Td className="text-slate-300">{c.contact_name || '—'}</Td>
                    <Td className="text-slate-300">{c.phone || '—'}</Td>
                    <Td className="text-slate-400">{new Date(c.created_at).toLocaleDateString('en-IN')}</Td>
                    <Td className="pr-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => editingId === c.id ? cancelEdit() : startEdit(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 transition-all"
                        >
                          {editingId === c.id ? <><X className="w-3 h-3" /> Cancel</> : <><Pencil className="w-3 h-3" /> Edit</>}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.firm_name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </Td>
                  </Tr>

                  {/* Inline edit form — opens directly under this row */}
                  {editingId === c.id && (
                    <tr>
                      <td colSpan="6" className="p-0 bg-slate-800/30 border-b border-slate-800">
                        <form onSubmit={e => handleEditSubmit(e, c.id)} className="flex flex-col sm:flex-row gap-2.5 items-center p-4">
                          <input
                            className={inputClasses}
                            placeholder="Firm / Shop Name *"
                            name="firm_name"
                            value={editForm.firm_name}
                            onChange={handleEditChange}
                          />
                          <input
                            className={inputClasses}
                            placeholder="Contact Person Name"
                            name="contact_name"
                            value={editForm.contact_name}
                            onChange={handleEditChange}
                          />
                          <input
                            className={inputClasses}
                            placeholder="Phone Number"
                            name="phone"
                            value={editForm.phone}
                            onChange={handleEditChange}
                          />
                          <LoadingButton
                            loading={editSubmitting}
                            type="submit"
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25 shrink-0 whitespace-nowrap"
                          >
                            Save Changes
                          </LoadingButton>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export default Customers
