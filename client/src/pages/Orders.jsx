import { useState, useEffect, Fragment } from 'react'
import api, { getOrders, getCustomers, createOrder, updateOrderStatus, getOrderDetail, addPayment, deleteOrder, sendBillWhatsApp, generatePDF, getOrderPhotos, uploadOrderPhoto, deleteOrderPhoto, getSetting, getDenominationDrawer } from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { PrimaryButton, SecondaryButton, IconButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, Tr, Td } from '../components/ui/Table'
import StatusDropdown from '../components/ui/StatusDropdown'
import {
  Ruler,
  X,
  Banknote,
  Smartphone,
  Search,
  Check,
  Pencil,
  ChevronUp,
  ChevronDown,
  FileText,
  Package,
  Wallet,
  Receipt,
  Scissors,
  StickyNote,
  ClipboardList,
  Camera,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
  Send,
  ListFilter,
  Plus,
  Trash2,
} from 'lucide-react'

const UPI_ACCOUNTS = [
  'Demo UPI Account 1',
  'Demo UPI Account 2',
  'Demo UPI Account 3',
  'Demo UPI Account 4'
]

// Reusable Cash / UPI / Cheque mode-picker used for both the advance-payment
// field (New Order form) and the record-payment field (order detail). Same
// small pill-button pattern used for Dashboard's due-filter buttons.
function PaymentModeButtons({ value, onChange, options }) {
  const ICONS = { cash: Banknote, upi: Smartphone, cheque: Receipt }
  const LABELS = { cash: 'Cash', upi: 'UPI', cheque: 'Cheque' }
  return (
    <div className="flex gap-2">
      {options.map(mode => {
        const Icon = ICONS[mode]
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {LABELS[mode]}
          </button>
        )
      })}
    </div>
  )
}

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

function Orders() {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingOrder, setEditingOrder] = useState(null)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [orderDetail, setOrderDetail] = useState(null)
  const [editingFollowUp, setEditingFollowUp] = useState(null)
  const [orderPhotos, setOrderPhotos] = useState([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [followUpValue, setFollowUpValue] = useState('')
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    note: '',
    payment_date: '',
    follow_up_date: '',
    payment_mode: 'cash',
    upi_account: '',
    cheque_number: '',
    bank_name: '',
    showDiscount: false,
    discount_amount: '',
    discount_note: ''
  })
  const [waStatus, setWaStatus] = useState('disconnected')
  const [waSendModal, setWaSendModal] = useState(null) // stores order object when modal is open
  const [selectedUpiForWA, setSelectedUpiForWA] = useState('')
  const [advanceDenomination, setAdvanceDenomination] = useState({})
  const [paymentDenomination, setPaymentDenomination] = useState({})
  // Note-wise cash tracking — global setting (same key as the Cash Drawer tab).
  // Defaults to true until fetched, so tracking-ON shops never see the field
  // briefly unlocked before the real setting loads.
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)
  // Live drawer notes — keeps "amount received" from exceeding what's actually in the drawer
  const [availableNotes, setAvailableNotes] = useState(null)
  // Search + filter are a single row now — status filter is picked from a dropdown menu
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [downloadingBillId, setDownloadingBillId] = useState(null)
  const [waSending, setWaSending] = useState(false)
  // New-order customer field — used to be a plain <select>, now a search-as-you-type
  // + filtered dropdown, matching the "Record Other Payment" pattern in Daily Sales.
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  const [form, setForm] = useState({
    customer_id: '',
    description: '',
    advance_paid: '',
    advance_payment_mode: 'cash',
    advance_upi_account: '',
    follow_up_date: '',
    notes: '',
    discount_amount: '',
    discount_note: ''
  })

  const [items, setItems] = useState([
    { item_name: '', length: '', breadth: '', pieces: '', quantity: '', unit_price: '', useSize: false, item_date: new Date().toISOString().split('T')[0] }
  ])

  useEffect(() => {
    import('../services/api').then(({ getWhatsAppStatus }) => {
      getWhatsAppStatus()
        .then(res => setWaStatus(res.data.status))
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    getSetting('note_tracking_enabled')
      .then(res => setNoteTrackingEnabled(res.data.value === null ? true : res.data.value === 'true'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAvailableNotes()
  }, [])

  useEffect(() => {
    fetchOrders()
    getCustomers().then(res => setCustomers(res.data))
  }, [filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Message now auto-clears after 4s — previously required a manual click to
  // dismiss, so a stale "Order created" toast could sit on screen indefinitely.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [message])

  function fetchOrders() {
    setLoading(true)
    const filters = filterStatus ? { status: filterStatus } : {}
    getOrders(filters)
      .then(res => { setOrders(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function refreshAvailableNotes() {
    getDenominationDrawer()
      .then(res => setAvailableNotes(res.data.denominations))
      .catch(() => {})
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'advance_payment_mode' && value !== 'upi') {
        updated.advance_upi_account = ''
      }
      return updated
    })
  }

  function handleItemChange(index, field, value) {
    const updated = [...items]
    updated[index][field] = value
    if (field === 'length' || field === 'breadth' || field === 'pieces') {
      const l = parseFloat(field === 'length' ? value : updated[index].length) || 0
      const b = parseFloat(field === 'breadth' ? value : updated[index].breadth) || 0
      const p = parseFloat(field === 'pieces' ? value : updated[index].pieces) || 1
      updated[index].quantity = (l * b * p).toFixed(2)
    }
    setItems(updated)
  }

  function toggleSizeMode(index) {
    const updated = [...items]
    updated[index].useSize = !updated[index].useSize
    updated[index].length = ''
    updated[index].breadth = ''
    updated[index].pieces = '' 
    if (!updated[index].useSize) updated[index].quantity = ''
    setItems(updated)
  }

  function addItemRow() {
    setItems([...items, { item_name: '', length: '', breadth: '', pieces: '', quantity: '', unit_price: '', useSize: false, item_date: new Date().toISOString().split('T')[0] }])
  }

  function removeItemRow(index) {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function calculateTotal() {
    return items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
    }, 0)
  }

  function openEditForm(order) {
    setEditingOrder(order)
    // The order list query already joins firm_name/contact_name (same as used
    // in the table row), so there's no need to wait for the customers array to
    // load — the display text can be built directly from the order object.
    setCustomerSearchQuery(`${order.firm_name || ''}${order.contact_name ? ` (${order.contact_name})` : ''}`)
    setForm({
      customer_id: order.customer_id,
      description: order.description || '',
      advance_paid: order.advance_paid,
      advance_payment_mode: order.advance_payment_mode || 'cash',
      advance_upi_account: order.advance_upi_account || '',
      follow_up_date: order.follow_up_date || '',
      notes: order.notes || '',
      discount_amount: order.discount_amount || '',
      discount_note: order.discount_note || ''
    })
    api.get(`/orders/${order.id}`)
      .then(res => {
        if (res.data.items && res.data.items.length > 0) {
          setItems(res.data.items.map(i => ({
            item_name: i.item_name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            length: '', breadth: '', useSize: false
          })))
        } else {
          setItems([{ item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false, item_date: new Date().toISOString().split('T')[0] }])
        }
      })
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  function resetForm() {
    setForm({
      customer_id: '', description: '', advance_paid: '',
      advance_payment_mode: 'cash', advance_upi_account: '',
      follow_up_date: '', notes: '',
      discount_amount: '', discount_note: '',
      advance_payment_date: ''
    })
    setItems([{ item_name: '', length: '', breadth: '', quantity: '', unit_price: '', useSize: false }])
    setEditingOrder(null)
    setShowForm(false)
    setAdvanceDenomination({})
    setCustomerSearchQuery('')
    setShowCustomerDropdown(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.customer_id) return setMessage('Please select a customer.')

    const advanceAmt = parseFloat(form.advance_paid) || 0

    if (advanceAmt > 0 && form.advance_payment_mode === 'upi' && !form.advance_upi_account) {
      return setMessage('Please select a UPI account for the advance payment.')
    }

    if (editingOrder) {
      const validItems = items.filter(i => i.item_name && (parseFloat(i.quantity) > 0))
      if (validItems.length === 0) return setMessage('Add at least one valid item.')

      setSubmitting(true)
      api.put(`/orders/${editingOrder.id}/items`, {
        items: validItems.map(i => ({
          item_name: i.item_name,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          length: i.useSize ? parseFloat(i.length) || null : null,
          breadth: i.useSize ? parseFloat(i.breadth) || null : null,
          item_date: i.item_date || null
        }))
      }).then(() => {
        return api.put(`/orders/${editingOrder.id}`, {
          description: form.description,
          notes: form.notes,
          follow_up_date: form.follow_up_date,
          advance_paid: advanceAmt,
          advance_payment_mode: advanceAmt > 0 ? form.advance_payment_mode : null,
          advance_upi_account: advanceAmt > 0 && form.advance_payment_mode === 'upi'
            ? form.advance_upi_account : null,
          discount_amount: parseFloat(form.discount_amount) || 0,
          discount_note: form.discount_note || null
        })
      }).then(() => {
        setMessage('Order updated successfully!')
        resetForm()
        fetchOrders()
      }).catch(() => setMessage('Error updating order.'))
        .finally(() => setSubmitting(false))
      return
    }

    if (!items[0].item_name) return setMessage('Add at least one item.')

    const payload = {
      ...form,
      advance_paid: advanceAmt,
      advance_payment_mode: advanceAmt > 0 ? form.advance_payment_mode : null,
      advance_upi_account: advanceAmt > 0 && form.advance_payment_mode === 'upi'
        ? form.advance_upi_account : null,
      advance_denomination_breakdown: advanceAmt > 0 && form.advance_payment_mode === 'cash' && Object.keys(advanceDenomination).length > 0
        ? advanceDenomination : null,
      advance_payment_date: form.advance_payment_date || null,
      discount_amount: parseFloat(form.discount_amount) || 0,
      discount_note: form.discount_note || null,
      items: items.map(i => ({
        item_name: i.item_name,
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
        length: i.useSize ? parseFloat(i.length) || null : null,
        breadth: i.useSize ? parseFloat(i.breadth) || null : null,
        item_date: i.item_date || null
      }))
    }

    setSubmitting(true)
    createOrder(payload)
      .then(res => {
        setMessage(`✅ ${res.data.order_number} created successfully!`)
        resetForm()
        fetchOrders()
        refreshAvailableNotes()
      })
      .catch(() => setMessage('Error creating order.'))
      .finally(() => setSubmitting(false))
  }

  function handleStatusChange(orderId, newStatus) {
    updateOrderStatus(orderId, newStatus)
      .then(() => fetchOrders())
      .catch(() => setMessage('Error updating status.'))
  }

  function handleDeleteOrder(order) {
    const label = order.order_number
      ? `${order.order_number} — ${order.description || 'this order'}`
      : (order.description || 'This order')
    if (!window.confirm(`"${label}" delete karna chahte ho?\n(30 din tak restore ho sakta hai Bin se)`)) return
    deleteOrder(order.id)
      .then(() => {
        setMessage('Order deleted. Bin se restore ho sakta hai 30 din mein.')
        fetchOrders()
      })
      .catch(() => setMessage('Error deleting order.'))
  }

  function toggleExpand(order) {
    if (expandedOrder === order.id) {
      setExpandedOrder(null)
      setOrderDetail(null)
      setOrderPhotos([])
      return
    }
    setExpandedOrder(order.id)
    getOrderDetail(order.id)
      .then(res => {
        setOrderDetail(res.data)
        fetchOrderPhotos(res.data.id)
      })
      .catch(() => setMessage('Could not load order detail.'))
  }

  function handleAddPayment(e) {
    e.preventDefault()

    const amount      = parseFloat(paymentForm.amount) || 0
    const discountAmt = parseFloat(paymentForm.discount_amount) || 0
    const hasFollowUp = !!paymentForm.follow_up_date

    if (amount <= 0 && discountAmt <= 0 && !hasFollowUp) {
      return setMessage('Amount, discount ya follow-up date mein se kuch to daalo.')
    }

    if (amount > 0 && paymentForm.payment_mode === 'upi' && !paymentForm.upi_account) {
      return setMessage('UPI ke liye account select karo.')
    }

    setPaymentSubmitting(true)
    const discountPromise = discountAmt > 0
      ? api.put(`/orders/${orderDetail.id}`, {
          discount_amount: (parseFloat(orderDetail.discount_amount) || 0) + discountAmt,
          discount_note: paymentForm.discount_note || 'Round-off'
        })
      : Promise.resolve()

    discountPromise
      .then(() => {
        if (amount > 0) {
          return addPayment({
            order_id: orderDetail.id,
            customer_id: orderDetail.customer_id,
            amount,
            note: paymentForm.note,
            payment_mode: paymentForm.payment_mode,
            upi_account: paymentForm.upi_account || null,
            cheque_number: paymentForm.payment_mode === 'cheque' ? (paymentForm.cheque_number || null) : null,
            bank_name: paymentForm.payment_mode === 'cheque' ? (paymentForm.bank_name || null) : null,
            denomination_breakdown: paymentForm.payment_mode === 'cash' && Object.keys(paymentDenomination).length > 0
              ? paymentDenomination : null,
            payment_date: paymentForm.payment_date
              ? paymentForm.payment_date + ' ' + new Date().toLocaleTimeString('en-GB', { hour12: false })
              : new Date().toLocaleString('en-GB', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                }).replace(',', '')
          })
        }
      })
      .then(() => {
        if (hasFollowUp) {
          return api.put(`/orders/${orderDetail.id}`, { follow_up_date: paymentForm.follow_up_date })
        }
      })
      .then(() => {
        setMessage(
          amount > 0
            ? (paymentForm.payment_mode === 'cheque'
                ? 'Cheque recorded! Balance will update once marked cleared in Accounts.'
                : 'Payment recorded!')
            : (discountAmt > 0 ? 'Discount aur follow-up date saved!' : 'Follow-up date saved!')
        )
        setPaymentForm({ amount: '', note: '', payment_date: '', follow_up_date: '', payment_mode: 'cash', upi_account: '', cheque_number: '', bank_name: '', showDiscount: false, discount_amount: '', discount_note: '' })
        setPaymentDenomination({})
        getOrderDetail(orderDetail.id).then(res => {
          setOrderDetail(res.data)
          fetchOrders()
        })
        refreshAvailableNotes()
      })
      .catch(() => setMessage('Error recording payment.'))
      .finally(() => setPaymentSubmitting(false))
  }

  function fetchOrderPhotos(id) {
    getOrderPhotos(id).then(res => setOrderPhotos(res.data)).catch(() => {})
  }

  function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file || !orderDetail) return
    setPhotoUploading(true)
    uploadOrderPhoto(orderDetail.id, file, photoCaption)
      .then(() => {
        setPhotoCaption('')
        fetchOrderPhotos(orderDetail.id)
      })
      .catch(() => setMessage('Photo upload failed.'))
      .finally(() => setPhotoUploading(false))
  }

  function handlePhotoDelete(photoId) {
    if (!window.confirm('Is photo ko delete karna chahte ho?')) return
    deleteOrderPhoto(orderDetail.id, photoId)
      .then(() => fetchOrderPhotos(orderDetail.id))
      .catch(() => setMessage('Delete failed.'))
  }

  function handleFollowUpSave(orderId) {
    api.put(`/orders/${orderId}/follow-up`, {
      follow_up_date: followUpValue
    })
      .then(() => {
        setEditingFollowUp(null)
        fetchOrders()
        if (expandedOrder === orderId) {
          getOrderDetail(orderId).then(res => {
            setOrderDetail(res.data)
            fetchOrderPhotos(res.data.id)
          })
        }
      })
      .catch(() => setMessage('Error updating follow-up date.'))
  }

  const filteredOrders = orders.filter(o => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (o.order_number && o.order_number.toLowerCase().includes(q)) ||
      (o.firm_name && o.firm_name.toLowerCase().includes(q)) ||
      (o.phone && o.phone.toLowerCase().includes(q))
    )
  })

  const filteredCustomers = customers.filter(c => {
    if (!customerSearchQuery.trim()) return true
    const q = customerSearchQuery.toLowerCase()
    return (
      (c.firm_name && c.firm_name.toLowerCase().includes(q)) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    )
  })

  const total    = calculateTotal()
  const advance  = parseFloat(form.advance_paid) || 0
  const discount = parseFloat(form.discount_amount) || 0
  const balance  = total - advance - discount
  // When tracking is on, the cash advance amount is only filled via the
  // Denomination Counter. The field stays open while advance === 0 (so the
  // mode selector can appear), then locks once cash is chosen and an amount exists.
  const advanceAmountLocked = noteTrackingEnabled && advance > 0 && form.advance_payment_mode === 'cash'
  // The record-payment form doesn't have that ordering problem (the mode
  // buttons are always visible), so it can lock immediately.
  const paymentAmountLocked = noteTrackingEnabled && paymentForm.payment_mode === 'cash'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        subtitle="Track flex printing jobs, sizes, balances due, and statuses"
        actions={
          showForm ? (
            <SecondaryButton icon={X} onClick={resetForm}>Cancel</SecondaryButton>
          ) : (
            <PrimaryButton icon={Plus} onClick={() => setShowForm(true)}>New Order</PrimaryButton>
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
          <h3 className="text-white font-bold mb-4">
            {editingOrder
              ? `Edit Order ${editingOrder.order_number ? `#${editingOrder.order_number}` : `#${editingOrder.id}`}`
              : 'New Order'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  className={inputClasses}
                  placeholder="Search customer name... *"
                  value={customerSearchQuery}
                  autoComplete="off"
                  disabled={!!editingOrder}
                  onChange={e => {
                    setCustomerSearchQuery(e.target.value)
                    setShowCustomerDropdown(true)
                    // Editing the text invalidates the previous selection — customer_id stays
                    // empty until a customer is re-selected from the dropdown (same behavior
                    // as the "Record Other Payment" search-select).
                    if (form.customer_id) setForm(f => ({ ...f, customer_id: '' }))
                  }}
                  onFocus={() => !editingOrder && setShowCustomerDropdown(true)}
                />

                {showCustomerDropdown && !editingOrder && (
                  <>
                    <div onClick={() => setShowCustomerDropdown(false)} className="fixed inset-0 z-[90]" />
                    <div className="absolute top-[calc(100%+6px)] left-0 w-full max-h-[260px] overflow-y-auto bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[100]">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-4 py-2.5 text-sm text-slate-500">Koi customer nahi mila</div>
                      ) : (
                        filteredCustomers.map(c => (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => {
                              setForm(f => ({ ...f, customer_id: c.id }))
                              setCustomerSearchQuery(`${c.firm_name}${c.contact_name ? ` (${c.contact_name})` : ''}`)
                              setShowCustomerDropdown(false)
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-700/60 transition-colors"
                          >
                            <span className="font-bold text-slate-200 text-sm">{c.firm_name}</span>
                            {c.contact_name && <span className="text-slate-400 text-sm"> — {c.contact_name}</span>}
                            {c.phone && <div className="text-slate-500 text-xs">{c.phone}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <input
                className={`${inputClasses} flex-1 min-w-0`}
                placeholder="Description (e.g. Dukan ka flex)"
                name="description"
                value={form.description}
                onChange={handleFormChange}
              />
            </div>

            <div>
              <p className="text-xs font-bold text-slate-300 mb-2">
                Line Items {editingOrder && (
                  <span className="text-[11px] text-red-400 font-normal">(editing will recalculate total)</span>
                )}
              </p>
              <div className="space-y-2.5">
                {items.map((item, index) => (
                  <div key={index} className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl">
                    <div className="flex gap-2 mb-2 items-center flex-wrap">
                      <input
                        className={`${inputClasses} flex-[3] min-w-[160px]`}
                        placeholder="Item name (e.g. Flex 180GSM, Pipe 3kg, Labour)"
                        value={item.item_name}
                        onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                      />
                      <input
                        type="date"
                        className={`${inputClasses} max-w-[150px] min-w-[130px] flex-none`}
                        value={item.item_date || ''}
                        onChange={e => handleItemChange(index, 'item_date', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleSizeMode(index)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-all ${
                          item.useSize ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                        }`}
                      >
                        <Ruler className="w-3.5 h-3.5" /> {item.useSize ? 'Size ON' : 'L×B'}
                      </button>
                      <IconButton icon={X} onClick={() => removeItemRow(index)} className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 shrink-0" />
                    </div>

                    <div className="flex gap-2 items-end flex-wrap">
                      {item.useSize ? (
                        <div className="flex-[1_1_100%] min-w-0">
                          {(item.length || item.breadth || item.pieces) && (
                            <div className="text-xs text-slate-400 mb-1.5">
                              {item.length || 0} ft × {item.breadth || 0} ft × {item.pieces || 1} pcs = <strong className="text-emerald-400">{item.quantity || 0} sq.ft</strong>
                            </div>
                          )}
                          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))' }}>
                            <div>
                              <label className={labelClasses}>Length (ft)</label>
                              <input className={inputClasses} type="number" placeholder="e.g. 10"
                                value={item.length} onChange={e => handleItemChange(index, 'length', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelClasses}>Breadth (ft)</label>
                              <input className={inputClasses} type="number" placeholder="e.g. 4"
                                value={item.breadth} onChange={e => handleItemChange(index, 'breadth', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelClasses}>Pcs</label>
                              <input className={inputClasses} type="number" placeholder="1"
                                value={item.pieces} onChange={e => handleItemChange(index, 'pieces', e.target.value)} />
                            </div>
                            <div>
                              <label className={labelClasses}>Sq.ft (auto)</label>
                              <input className={`${inputClasses} bg-emerald-500/10 text-emerald-300`} value={item.quantity} readOnly />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-[0_1_150px] min-w-[90px] max-w-[180px]">
                          <label className={labelClasses}>Quantity / Sq.ft</label>
                          <input className={inputClasses} type="number" placeholder="0"
                            value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                        </div>
                      )}
                      <div className="flex-[0_1_150px] min-w-[90px] max-w-[180px]">
                        <label className={labelClasses}>Rate (₹)</label>
                        <input className={inputClasses} type="number" placeholder="0"
                          value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                      </div>
                      <div className="flex-[0_1_150px] min-w-[90px] max-w-[180px]">
                        <label className={labelClasses}>Subtotal</label>
                        <div className="py-2.5 font-bold text-base text-white">
                          ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <SecondaryButton icon={Plus} className="mt-2.5" onClick={addItemRow} type="button">Add Item</SecondaryButton>
            </div>

            {/* ── Totals + Advance Section ── */}
            <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 max-w-[480px] w-full">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-300">Total Amount:</span>
                <strong className="text-white text-base">₹{total.toFixed(2)}</strong>
              </div>

              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-300">Advance Paid:</span>
                <div>
                  <input
                    className={`${inputClasses} max-w-[150px] flex-none`}
                    placeholder="0" type="number" name="advance_paid"
                    value={form.advance_paid} onChange={handleFormChange}
                    readOnly={advanceAmountLocked}
                  />
                  {advanceAmountLocked && (
                    <div className="text-[11px] text-slate-500 mt-1">Denomination counter se bharo (neeche)</div>
                  )}
                </div>
              </div>

              {advance > 0 && (
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-300">Advance Date:</span>
                  <input
                    type="date"
                    className={`${inputClasses} max-w-[150px] flex-none`}
                    name="advance_payment_date"
                    value={form.advance_payment_date}
                    onChange={handleFormChange}
                  />
                </div>
              )}

              {advance > 0 && (
                <>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-300 flex items-center gap-1">
                      Payment Mode <span className="text-red-400">*</span>
                    </span>
                    <PaymentModeButtons
                      value={form.advance_payment_mode}
                      options={['cash', 'upi']}
                      onChange={mode => setForm(f => ({ ...f, advance_payment_mode: mode, advance_upi_account: mode !== 'upi' ? '' : f.advance_upi_account }))}
                    />
                  </div>

                  {form.advance_payment_mode === 'cash' && noteTrackingEnabled && (
                    <DenominationCounter
                      availableNotes={availableNotes}
                      onApply={(total, counts) => {
                        setForm(f => ({ ...f, advance_paid: String(total) }))
                        setAdvanceDenomination(counts)
                      }}
                    />
                  )}

                  {form.advance_payment_mode === 'upi' && (
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-300 flex items-center gap-1">
                        UPI Account <span className="text-red-400">*</span>
                      </span>
                      <select
                        name="advance_upi_account"
                        value={form.advance_upi_account}
                        onChange={handleFormChange}
                        className={`${inputClasses} max-w-[220px] flex-none`}
                        required
                      >
                        <option value="">Select UPI Account</option>
                        {UPI_ACCOUNTS.map(acc => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-300">Discount / Round-off:</span>
                <div className="flex gap-1.5 items-center">
                  <input
                    className={`${inputClasses} max-w-[110px] flex-none`}
                    placeholder="₹0" type="number" name="discount_amount"
                    value={form.discount_amount} onChange={handleFormChange}
                  />
                  <input
                    className={`${inputClasses} max-w-[160px] flex-none`}
                    placeholder="Note (e.g. round-off)"
                    name="discount_note"
                    value={form.discount_note} onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-300">Balance Due:</span>
                <strong className={balance > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  ₹{balance.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className={labelClasses}>Follow-up Date</label>
                <input className={inputClasses} type="date" name="follow_up_date"
                  value={form.follow_up_date} onChange={handleFormChange} />
              </div>
              <div className="flex-[2] min-w-[220px]">
                <label className={labelClasses}>Notes</label>
                <input className={inputClasses} placeholder="Size, GSM, special notes..."
                  name="notes" value={form.notes} onChange={handleFormChange} />
              </div>
            </div>

            <LoadingButton
              loading={submitting}
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
            >
              {editingOrder ? 'Update Order' : 'Create Order'}
            </LoadingButton>
          </form>
        </Card>
      )}

      {/* Search + Filter bar */}
      <Card className="!p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order No. / Firm Name / Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`${inputClasses} pl-10`}
          />
        </div>
        {searchQuery && (
          <SecondaryButton icon={X} onClick={() => setSearchQuery('')} className="shrink-0">Clear</SecondaryButton>
        )}

        {/* Status filter — dropdown menu, single line ke saath */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowFilterMenu(o => !o)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border capitalize transition-all whitespace-nowrap ${
              filterStatus ? 'bg-blue-600/15 border-blue-500/40 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            {filterStatus === '' ? 'Filter' : filterStatus.replace('_', ' ')}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showFilterMenu && (
            <>
              <div onClick={() => setShowFilterMenu(false)} className="fixed inset-0 z-[90]" />
              <div className="absolute top-[calc(100%+6px)] left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-[100] min-w-[160px] overflow-hidden">
                {['', 'pending', 'in_progress', 'ready', 'delivered'].map(s => (
                  <button
                    key={s}
                    onClick={() => { setFilterStatus(s); setShowFilterMenu(false) }}
                    className={`block w-full text-left px-4 py-2.5 text-sm capitalize transition-colors ${
                      filterStatus === s ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-700/60'
                    }`}
                  >
                    {s === '' ? 'All' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      {loading ? <SectionLoader label="Orders load ho rahe hain..." /> : orders.length === 0 ? (
        <p className="text-slate-500 text-sm">No orders found.</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-slate-500 text-sm">No orders match your search.</p>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <Table minWidth="900px">
            <THead>
              <Th className="pl-4">Order No.</Th>
              <Th>Firm</Th>
              <Th>Description</Th>
              <Th>Total</Th>
              <Th>Balance</Th>
              <Th>Status</Th>
              <Th>Follow-up</Th>
              <Th className="pr-4">Actions</Th>
            </THead>
            <TBody>
              {filteredOrders.map((o) => (
                <Fragment key={o.id}>
                  <Tr key={o.id}>
                    <Td className="pl-4">
                      {o.order_number ? (
                        <span className="inline-block bg-slate-800 border border-slate-700 text-white px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide font-mono">
                          {o.order_number}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">#{o.id}</span>
                      )}
                    </Td>

                    <Td>
                      <p className="font-bold text-white">{o.firm_name}</p>
                      <p className="text-xs text-slate-500">{o.phone}</p>
                    </Td>
                    <Td className="text-slate-300">{o.description || '—'}</Td>
                    <Td className="font-mono text-slate-200">₹{o.total_amount}</Td>
                    <Td>
                      <span className={`font-mono font-bold ${o.balance_due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ₹{o.balance_due}
                      </span>
                    </Td>
                    <Td>
                      <StatusDropdown value={o.status} onChange={val => handleStatusChange(o.id, val)} />
                    </Td>
                    <Td>
                      {editingFollowUp === o.id ? (
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="date"
                            value={followUpValue}
                            onChange={e => setFollowUpValue(e.target.value)}
                            className="bg-slate-800 border border-blue-500 text-slate-200 rounded-lg px-2 py-1 text-xs"
                            autoFocus
                          />
                          <IconButton icon={Check} onClick={() => handleFollowUpSave(o.id)} className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 !p-1.5" />
                          <IconButton icon={X} onClick={() => setEditingFollowUp(null)} className="bg-slate-800 border border-slate-700 !p-1.5" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={`cursor-pointer ${o.follow_up_date && o.follow_up_date <= new Date().toLocaleDateString('en-CA') ? 'text-red-400' : 'text-slate-300'}`}
                            onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                          >
                            {o.follow_up_date || '—'}
                          </span>
                          <IconButton
                            icon={Pencil}
                            onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                            className="!p-1.5 bg-slate-800/60"
                          />
                        </div>
                      )}
                    </Td>
                    <Td className="pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => toggleExpand(o)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 transition-all"
                        >
                          {expandedOrder === o.id ? <><ChevronUp className="w-3 h-3" /> Hide</> : <><ChevronDown className="w-3 h-3" /> Details</>}
                        </button>
                        <button
                          onClick={() => openEditForm(o)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700/80 transition-all"
                        >
                          Edit
                        </button>
                        <LoadingButton
                          loading={downloadingBillId === o.id}
                          loadingText="..."
                          onClick={() => {
                            setDownloadingBillId(o.id)
                            generatePDF(o.id)
                              .then(res => {
                                const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
                                const link = document.createElement('a')
                                link.href = blobUrl
                                link.download = `${o.order_number || `bill-${o.id}`}.pdf`
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000)
                              })
                              .catch(() => setMessage('Error loading bill PDF.'))
                              .finally(() => setDownloadingBillId(null))
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700 text-blue-400 hover:bg-slate-700/80"
                        >
                          <FileText className="w-3 h-3" /> Bill
                        </LoadingButton>
                        <button
                          onClick={() => {
                            if (waStatus === 'disabled') return setMessage('WhatsApp is Disabled in Demo due to security reasons.')
                            if (!o.phone) return setMessage('Customer has no phone number.')
                            setSelectedUpiForWA('')
                            setWaSendModal(o)
                          }}
                          title={waStatus === 'disabled' ? 'Disabled in Demo due to security reasons' : waStatus === 'ready' ? 'Send bill on WhatsApp' : 'WhatsApp not connected'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            waStatus === 'ready'
                              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80 cursor-pointer'
                              : 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" /> WA
                        </button>
                        <IconButton
                          icon={Trash2}
                          onClick={() => handleDeleteOrder(o)}
                          className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 !p-1.5"
                        />
                      </div>
                    </Td>
                  </Tr>

                  {expandedOrder === o.id && orderDetail && (
                    <tr key={`detail-${o.id}`}>
                      <td colSpan="8" className="p-0 bg-slate-950/60 border-b-2 border-slate-800">
                        <div className="p-4 flex flex-col gap-4">

                          {orderDetail.order_number && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                              <span className="text-slate-400 text-xs">Order Number</span>
                              <span className="text-white text-lg font-bold tracking-wide font-mono">{orderDetail.order_number}</span>
                              <span className="ml-auto text-xs text-slate-500">
                                {orderDetail.firm_name} · {orderDetail.created_at
                                  ? new Date(orderDetail.created_at).toLocaleDateString('en-GB').replace(/\//g, '.')
                                  : ''}
                              </span>
                            </div>
                          )}

                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Order Items</h4>
                            <Table minWidth="500px">
                              <THead>
                                <Th>Item</Th>
                                <Th>Qty/Sq.ft</Th>
                                <Th>Rate</Th>
                                <Th>Subtotal</Th>
                              </THead>
                              <TBody>
                                {orderDetail.items && orderDetail.items.map(item => (
                                  <Tr key={item.id}>
                                    <Td className="text-slate-300">{item.item_name}</Td>
                                    <Td className="text-slate-300">{item.quantity}</Td>
                                    <Td className="text-slate-300">₹{item.unit_price}</Td>
                                    <Td className="text-slate-200">₹{item.subtotal}</Td>
                                  </Tr>
                                ))}
                                <tr className="bg-blue-500/5">
                                  <td colSpan="3" className="py-3 pr-4 text-right font-bold text-slate-300">Total:</td>
                                  <td className="py-3 font-bold text-base text-white">₹{orderDetail.total_amount}</td>
                                </tr>
                              </TBody>
                            </Table>
                          </div>

                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Payment History</h4>
                            <Table minWidth="500px">
                              <THead>
                                <Th>#</Th>
                                <Th>Date</Th>
                                <Th>Amount</Th>
                                <Th>Note</Th>
                              </THead>
                              <TBody>
                                {orderDetail.advance_paid > 0 && (
                                  <tr className="bg-amber-500/5">
                                    <td className="py-3 pr-4 text-slate-300">1</td>
                                    <td className="py-3 pr-4 text-slate-300">
                                      {orderDetail.created_at ? (() => {
                                        const d = new Date(orderDetail.advance_payment_date || orderDetail.created_at)
                                        const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                        const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                        return <span>{time}<br /><span className="text-[11px] text-slate-500">{date}</span></span>
                                      })() : '—'}
                                    </td>
                                    <td className="py-3 pr-4 font-bold text-white">₹{orderDetail.advance_paid}</td>
                                    <td className="py-3 pr-4">
                                      <Badge tone="amber">Advance</Badge>
                                      {orderDetail.advance_payment_mode && (
                                        <Badge tone={orderDetail.advance_payment_mode === 'upi' ? 'blue' : 'emerald'} className="ml-1.5">
                                          {orderDetail.advance_payment_mode === 'upi' ? <><Smartphone className="w-2.5 h-2.5" /> UPI</> : <><Banknote className="w-2.5 h-2.5" /> Cash</>}
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                )}
                                {orderDetail.payments && orderDetail.payments.map((p, i) => (
                                  <tr key={p.id} className="border-t border-slate-800/60">
                                    <td className="py-3 pr-4 text-slate-300">{(orderDetail.advance_paid > 0 ? 2 : 1) + i}</td>
                                    <td className="py-3 pr-4 text-slate-300">
                                      {(p.created_at || p.payment_date) ? (() => {
                                        const d = new Date(p.created_at || p.payment_date)
                                        if (isNaN(d)) return p.created_at || p.payment_date
                                        const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                        const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                        return <span>{time}<br /><span className="text-[11px] text-slate-500">{date}</span></span>
                                      })() : '—'}
                                    </td>
                                    <td className="py-3 pr-4 font-bold text-white">₹{p.amount}</td>
                                    <td className="py-3 pr-4 text-slate-300">
                                      {p.note || '—'}
                                      {p.payment_mode && (
                                        <Badge tone={p.payment_mode === 'upi' ? 'blue' : 'emerald'} className="ml-1.5">
                                          {p.payment_mode === 'upi' ? <><Smartphone className="w-2.5 h-2.5" /> {p.upi_account || 'UPI'}</> : <><Banknote className="w-2.5 h-2.5" /> Cash</>}
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {orderDetail.cheques && orderDetail.cheques.map((c) => (
                                  <tr key={`cheque-${c.id}`} className="bg-indigo-500/5 border-t border-slate-800/60">
                                    <td className="py-3 pr-4 text-slate-400"><Receipt className="w-3.5 h-3.5" /></td>
                                    <td className="py-3 pr-4 text-slate-300">
                                      {c.received_date ? new Date(c.received_date).toLocaleDateString('en-GB').replace(/\//g, '.') : '—'}
                                    </td>
                                    <td className="py-3 pr-4 font-bold text-white">₹{c.amount}</td>
                                    <td className="py-3 pr-4 text-slate-300">
                                      {c.notes || 'Cheque Payment'}
                                      {c.cheque_number && <span className="text-[11px] text-slate-500"> #{c.cheque_number}</span>}
                                      {c.bank_name && <span className="text-[11px] text-slate-500"> ({c.bank_name})</span>}
                                      <Badge tone={c.status === 'cleared' ? 'emerald' : c.status === 'bounced' ? 'red' : 'amber'} className="ml-1.5">
                                        <Receipt className="w-2.5 h-2.5" />
                                        {c.status === 'cleared' ? 'Cleared' : c.status === 'bounced' ? 'Bounced' : 'Awaiting Clearance'}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                                {orderDetail.discount_amount > 0 && (
                                  <tr className="bg-orange-500/5 border-t border-slate-800/60">
                                    <td colSpan="2" className="py-3 pr-4 font-bold text-orange-400 flex items-center gap-1.5">
                                      <Scissors className="w-3.5 h-3.5" /> Discount {orderDetail.discount_note ? `(${orderDetail.discount_note})` : '(Round-off)'}
                                    </td>
                                    <td colSpan="2" className="py-3 pr-4 font-bold text-orange-400">- ₹{orderDetail.discount_amount}</td>
                                  </tr>
                                )}
                                <tr className="bg-emerald-500/5 border-t border-slate-800">
                                  <td colSpan="2" className="py-3 pr-4 font-bold text-slate-200">Balance Due</td>
                                  <td colSpan="2" className={`py-3 pr-4 font-bold text-base ${orderDetail.balance_due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    ₹{orderDetail.balance_due}
                                    {orderDetail.follow_up_date && (
                                      <span className="text-xs text-slate-500 ml-2.5 font-normal">Follow-up: {orderDetail.follow_up_date}</span>
                                    )}
                                  </td>
                                </tr>
                              </TBody>
                            </Table>

                            {orderDetail.balance_due > 0 && (
                              <form onSubmit={handleAddPayment} className="mt-3 pt-3 border-t border-slate-800">
                                <h5 className="text-slate-300 text-sm font-semibold mb-2.5">+ Record New Payment</h5>

                                <div className="mb-2.5 flex items-center gap-2.5">
                                  <label className="text-xs text-slate-400">Kuch amount discount karna hai?</label>
                                  <button
                                    type="button"
                                    onClick={() => setPaymentForm(f => ({ ...f, showDiscount: !f.showDiscount, discount_amount: '', discount_note: '' }))}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                      paymentForm.showDiscount ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-300'
                                    }`}
                                  >
                                    <Scissors className="w-3 h-3" /> {paymentForm.showDiscount ? 'Discount ON' : 'Discount OFF'}
                                  </button>
                                </div>

                                {paymentForm.showDiscount && (
                                  <div className="flex gap-2 mb-2.5 items-center bg-orange-500/10 border border-orange-500/20 p-2.5 rounded-xl flex-wrap">
                                    <span className="text-xs text-orange-400 font-bold flex items-center gap-1 whitespace-nowrap"><Scissors className="w-3 h-3" /> Discount:</span>
                                    <input
                                      className={`${inputClasses} max-w-[130px]`}
                                      type="number" placeholder="Amount ₹"
                                      value={paymentForm.discount_amount || ''}
                                      onChange={e => setPaymentForm({ ...paymentForm, discount_amount: e.target.value })}
                                    />
                                    <input
                                      className={`${inputClasses} flex-[2]`}
                                      placeholder="Note (e.g. round-off, 15 rs maafi)"
                                      value={paymentForm.discount_note || ''}
                                      onChange={e => setPaymentForm({ ...paymentForm, discount_note: e.target.value })}
                                    />
                                    <span className="text-xs text-slate-500 whitespace-nowrap">
                                      Remaining: ₹{Math.max(0, orderDetail.balance_due - (parseFloat(paymentForm.discount_amount) || 0) - (parseFloat(paymentForm.amount) || 0))}
                                    </span>
                                  </div>
                                )}

                                <div className="flex gap-2 flex-wrap items-end">
                                  <div>
                                    <input
                                      className={`${inputClasses} max-w-[150px]`}
                                      type="number" placeholder="Amount ₹"
                                      value={paymentForm.amount}
                                      onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                      readOnly={paymentAmountLocked}
                                    />
                                    {paymentAmountLocked && (
                                      <div className="text-[10px] text-slate-500 mt-1">Denomination counter se bharo</div>
                                    )}
                                  </div>
                                  <input
                                    className={`${inputClasses} max-w-[160px]`}
                                    type="date"
                                    value={paymentForm.payment_date}
                                    onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                  />
                                  <input
                                    className={`${inputClasses} flex-[2]`}
                                    placeholder="Note (e.g. final payment)"
                                    value={paymentForm.note}
                                    onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] text-slate-400">Payment Mode</label>
                                    <PaymentModeButtons
                                      value={paymentForm.payment_mode}
                                      options={['cash', 'upi', 'cheque']}
                                      onChange={mode => setPaymentForm(f => ({
                                        ...f, payment_mode: mode,
                                        upi_account: mode === 'upi' ? f.upi_account : '',
                                        cheque_number: mode === 'cheque' ? f.cheque_number : '',
                                        bank_name: mode === 'cheque' ? f.bank_name : ''
                                      }))}
                                    />
                                  </div>

                                  {paymentForm.payment_mode === 'cash' && noteTrackingEnabled && (
                                    <div className="basis-full">
                                      <DenominationCounter
                                        availableNotes={availableNotes}
                                        onApply={(total, counts) => {
                                          setPaymentForm(f => ({ ...f, amount: String(total) }))
                                          setPaymentDenomination(counts)
                                        }}
                                      />
                                    </div>
                                  )}

                                  {paymentForm.payment_mode === 'upi' && (
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[11px] text-slate-400">UPI Account *</label>
                                      <select
                                        className={`${inputClasses} min-w-[200px]`}
                                        value={paymentForm.upi_account}
                                        onChange={e => setPaymentForm({ ...paymentForm, upi_account: e.target.value })}
                                        required
                                      >
                                        <option value="">Select Account</option>
                                        {UPI_ACCOUNTS.map(acc => (
                                          <option key={acc} value={acc}>{acc}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {paymentForm.payment_mode === 'cheque' && (
                                    <>
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[11px] text-slate-400">Cheque Number</label>
                                        <input
                                          className={`${inputClasses} max-w-[140px]`}
                                          placeholder="e.g. 004521"
                                          value={paymentForm.cheque_number}
                                          onChange={e => setPaymentForm({ ...paymentForm, cheque_number: e.target.value })}
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[11px] text-slate-400">Bank Name</label>
                                        <input
                                          className={`${inputClasses} max-w-[160px]`}
                                          placeholder="e.g. SBI, BOI"
                                          value={paymentForm.bank_name}
                                          onChange={e => setPaymentForm({ ...paymentForm, bank_name: e.target.value })}
                                        />
                                      </div>
                                    </>
                                  )}

                                  <div className="flex flex-col gap-1">
                                    <label className="text-[11px] text-slate-400">Next Follow-up</label>
                                    <input
                                      className={`${inputClasses} max-w-[160px]`}
                                      type="date"
                                      value={paymentForm.follow_up_date || ''}
                                      onChange={e => setPaymentForm({ ...paymentForm, follow_up_date: e.target.value })}
                                    />
                                  </div>

                                  <LoadingButton
                                    loading={paymentSubmitting}
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
                                  >
                                    Save Payment
                                  </LoadingButton>
                                </div>
                              </form>
                            )}
                          </div>

                          {orderDetail.notes && (
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Notes</h4>
                              <p className="text-sm text-slate-300">{orderDetail.notes}</p>
                            </div>
                          )}

                          {orderDetail.activityLog && orderDetail.activityLog.length > 0 && (
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Activity Log</h4>
                              {orderDetail.activityLog.map(a => (
                                <div key={a.id} className="text-xs text-slate-300 px-3 py-2 bg-blue-500/5 rounded-lg mb-1.5 border-l-2 border-blue-500/40">
                                  {a.activity}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Order Photos</h4>
                            <div className="flex gap-2.5 items-center mb-4 flex-wrap">
                              <input
                                type="text"
                                placeholder="Caption (optional)"
                                value={photoCaption}
                                onChange={e => setPhotoCaption(e.target.value)}
                                className={`${inputClasses} max-w-[200px]`}
                              />
                              <label className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white cursor-pointer whitespace-nowrap ${photoUploading ? 'opacity-60' : ''}`}>
                                {photoUploading ? 'Uploading...' : <><Paperclip className="w-3.5 h-3.5" /> Add Photo</>}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={handlePhotoUpload}
                                  disabled={photoUploading}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            {orderPhotos.length === 0 ? (
                              <p className="text-slate-500 text-sm">Koi photo nahi — upar se add karo.</p>
                            ) : (
                              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                                {orderPhotos.map(p => (
                                  <div key={p.id} className="relative rounded-xl overflow-hidden border border-slate-800">
                                    <img
                                      src={`http://localhost:5000/${p.photo_path}`}
                                      alt={p.caption || 'Order photo'}
                                      className="w-full h-[100px] object-cover cursor-pointer block"
                                      onClick={() => setLightboxPhoto(p)}
                                    />
                                    {p.caption && (
                                      <div className="text-[11px] text-slate-300 px-1.5 py-1 bg-slate-800">{p.caption}</div>
                                    )}
                                    <button
                                      onClick={() => handlePhotoDelete(p.id)}
                                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-[22px] h-[22px] flex items-center justify-center hover:bg-black/80"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TBody>
          </Table>

          <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Showing {filteredOrders.length} of {orders.length} orders</span>
          </div>
        </Card>
      )}

      {/* WA SEND MODAL */}
      <Modal open={!!waSendModal} onClose={() => setWaSendModal(null)} width="380px">
        {waSendModal && (
          <>
            <h3 className="text-white font-bold flex items-center gap-2 mb-1.5"><Smartphone className="w-4 h-4" /> WhatsApp Bill</h3>
            <p className="text-xs text-slate-400 mb-4">{waSendModal.firm_name} — Bill #{waSendModal.order_number || waSendModal.id}</p>

            {waSendModal.balance_due > 0 ? (
              <>
                <p className="text-xs text-red-400 font-bold mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Balance Due: ₹{waSendModal.balance_due}
                </p>
                <label className="text-xs text-slate-400 block mb-1.5">UPI QR bhejna hai? Account select karo:</label>
                <select
                  value={selectedUpiForWA}
                  onChange={e => setSelectedUpiForWA(e.target.value)}
                  className={`${inputClasses} mb-5`}
                >
                  <option value="">QR mat bhejo</option>
                  {[
                    { label: 'Demo UPI Account 1', upiId: 'demo1@upi' },
                    { label: 'Demo UPI Account 2', upiId: 'demo2@upi' },
                    { label: 'Demo UPI Account 3', upiId: 'demo3@upi' },
                    { label: 'Demo UPI Account 4', upiId: 'demo4@upi' }
                  ].map(acc => (
                    <option key={acc.upiId} value={acc.upiId}>{acc.label}</option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-xs text-emerald-400 font-bold mb-5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid — QR nahi bheja jayega
              </p>
            )}

            <div className="flex gap-2.5">
              <SecondaryButton className="flex-1 justify-center py-2.5" onClick={() => setWaSendModal(null)}>Cancel</SecondaryButton>
              <LoadingButton
                loading={waSending}
                onClick={() => {
                  const o = waSendModal
                  setWaSending(true)
                  sendBillWhatsApp(o.id, selectedUpiForWA)
                    .then(res => { setMessage(res.data.message); setWaSendModal(null) })
                    .catch(err => { setMessage('WhatsApp error: ' + (err.response?.data?.error || 'Not connected')); setWaSendModal(null) })
                    .finally(() => setWaSending(false))
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-bold"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </LoadingButton>
            </div>
          </>
        )}
      </Modal>

      {/* LIGHTBOX */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[1000] cursor-pointer p-4"
        >
          <img
            src={`http://localhost:5000/${lightboxPhoto.photo_path}`}
            alt={lightboxPhoto.caption || 'Order photo'}
            className="max-w-[92%] max-h-[82%] rounded-xl cursor-default"
            onClick={e => e.stopPropagation()}
          />
          {lightboxPhoto.caption && (
            <p className="text-slate-300 text-sm mt-3">{lightboxPhoto.caption}</p>
          )}
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-5 right-7 text-white hover:text-slate-300"
          >
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  )
}

export default Orders
