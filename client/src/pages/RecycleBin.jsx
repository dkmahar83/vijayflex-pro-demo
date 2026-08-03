import { useState, useEffect } from 'react'
import api from '../services/api'
import { RefreshCw } from 'lucide-react'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'

function RecycleBin() {
  const [deletedCustomers, setDeletedCustomers] = useState([])
  const [deletedOrders, setDeletedOrders] = useState([])
  const [message, setMessage] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    fetchDeleted()
  }, [])

  // Message auto-clears after 4s instead of requiring a manual click to dismiss.
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
    api.put(`/customers/${id}/restore`).then(() => { setMessage('Customer restored!'); fetchDeleted() })
  }

  function restoreOrder(id) {
    api.put(`/orders/${id}/restore`).then(() => { setMessage('Order restored!'); fetchDeleted() })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle Bin"
        badge="30-Day Auto Retention"
        subtitle="Items deleted in the last 30 days. After that, they're permanently gone."
      />

      {message && (
        <p
          onClick={() => setMessage('')}
          className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl cursor-pointer text-sm"
        >
          {message}
        </p>
      )}

      {/* DELETED CUSTOMERS */}
      <div>
        <h3 className="text-white font-bold mb-3">Deleted Customers <span className="text-slate-500 font-normal text-sm">({deletedCustomers.length})</span></h3>
        {loadingCustomers ? (
          <SectionLoader label="Loading deleted customers..." size="small" />
        ) : deletedCustomers.length === 0 ? (
          <p className="text-slate-500 text-sm">No recently deleted customers.</p>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <Table minWidth="500px">
              <THead>
                <Th className="pl-4">Firm Name</Th><Th>Phone</Th><Th>Deleted At</Th><Th className="pr-4">Action</Th>
              </THead>
              <TBody>
                {deletedCustomers.map(c => (
                  <Tr key={c.id}>
                    <Td className="pl-4 font-bold text-white">{c.firm_name}</Td>
                    <Td className="text-slate-300">{c.phone || '—'}</Td>
                    <Td className="text-slate-400 text-xs">{new Date(c.deleted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Td>
                    <Td className="pr-4">
                      <button
                        onClick={() => restoreCustomer(c.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" /> Restore
                      </button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {/* DELETED ORDERS */}
      <div>
        <h3 className="text-white font-bold mb-3">Deleted Orders <span className="text-slate-500 font-normal text-sm">({deletedOrders.length})</span></h3>
        {loadingOrders ? (
          <SectionLoader label="Loading deleted orders..." size="small" />
        ) : deletedOrders.length === 0 ? (
          <p className="text-slate-500 text-sm">No recently deleted orders.</p>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <Table minWidth="550px">
              <THead>
                <Th className="pl-4">Order #</Th><Th>Firm</Th><Th>Amount</Th><Th>Deleted At</Th><Th className="pr-4">Action</Th>
              </THead>
              <TBody>
                {deletedOrders.map(o => (
                  <Tr key={o.id}>
                    <Td className="pl-4 font-mono font-bold text-blue-400">#{o.id}</Td>
                    <Td className="text-slate-300">{o.firm_name}</Td>
                    <Td className="font-mono text-slate-200">₹{o.total_amount}</Td>
                    <Td className="text-slate-400 text-xs">{new Date(o.deleted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Td>
                    <Td className="pr-4">
                      <button
                        onClick={() => restoreOrder(o.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" /> Restore
                      </button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}

export default RecycleBin