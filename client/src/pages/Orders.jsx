import { useState, useEffect } from 'react'
import api, { getOrders, getCustomers, createOrder, updateOrderStatus, getOrderDetail, addPayment, deleteOrder, sendBillWhatsApp, generatePDF, getOrderPhotos, uploadOrderPhoto, deleteOrderPhoto, getSetting, getDenominationDrawer } from '../services/api'
import DenominationCounter from '../components/DenominationCounter'
import LoadingButton from '../components/LoadingButton'
import SectionLoader from '../components/SectionLoader'
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
} from 'lucide-react'

const UPI_ACCOUNTS = [
  'Demo UPI Account 1',
  'Demo UPI Account 2',
  'Demo UPI Account 3',
  'Demo UPI Account 4'
]

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
  // Note-wise Cash Tracking — global setting (Galla Hisaab tab wali hi key).
  // Default true jab tak fetch nahi hoti, taaki tracking-ON shops ke liye
  // field galti se ek pal ke liye bhi unlocked na dikhe.
  const [noteTrackingEnabled, setNoteTrackingEnabled] = useState(true)
  // Live drawer notes — "Change Returned" ko available notes se zyada nahi badhne dena
  const [availableNotes, setAvailableNotes] = useState(null)
  // Search+Filter ab single-row hain — status filter ab dropdown-menu se select hota hai
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)
  const [downloadingBillId, setDownloadingBillId] = useState(null)
  const [waSending, setWaSending] = useState(false)
  // Order-create ka customer field — pehle plain <select> tha, ab daily-sales
  // "Record Other Payment" jaisa search-as-you-type + filtered dropdown.
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

  // Message ab khud 4 sec baad gayab ho jaata hai — pehle sirf click-karke
  // hatao tha, isliye purana "Order created" wagaira screen pe atka rehta tha.
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
    // order list-query pehle se firm_name/contact_name JOIN karke deti hai (jaisa
    // table row mein use hota hai), isliye customers array load hone ka wait nahi
    // karna padta — seedha order object se display-text ban jaata hai.
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
  // Cash advance amount ab sirf Denomination Counter se bharega jab tracking
  // ON ho. advance === 0 tak field open rehti hai (mode-selector reveal karne
  // ke liye), uske baad — agar cash hai — lock ho jaati hai.
  const advanceAmountLocked = noteTrackingEnabled && advance > 0 && form.advance_payment_mode === 'cash'
  // Record-payment form mein ye issue nahi hai (mode-buttons hamesha visible
  // hain), isliye seedha lock kar sakte hain.
  const paymentAmountLocked = noteTrackingEnabled && paymentForm.payment_mode === 'cash'

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <div style={styles.header}>
        <h2>Orders</h2>
        <button style={styles.addBtn} onClick={() => showForm ? resetForm() : setShowForm(true)}>
          {showForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {message && (
        <p style={styles.message} onClick={() => setMessage('')}>{message}</p>
      )}

      {showForm && (
        <div style={styles.formBox}>
          <h3 style={{ marginBottom: '16px' }}>
            {editingOrder
              ? `Edit Order ${editingOrder.order_number ? `#${editingOrder.order_number}` : `#${editingOrder.id}`}`
              : 'New Order'}
          </h3>
          <form onSubmit={handleSubmit}>

            <div style={styles.formRow}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  style={{
                    ...styles.input, width: '100%',
                    ...(editingOrder ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {})
                  }}
                  placeholder="Search customer name... *"
                  value={customerSearchQuery}
                  autoComplete="off"
                  disabled={!!editingOrder}
                  onChange={e => {
                    setCustomerSearchQuery(e.target.value)
                    setShowCustomerDropdown(true)
                    // Text badalte hi purani selection invalid ho jaati hai — jab tak
                    // dropdown se dobara select na ho, customer_id khaali rahega
                    // (yehi behavior "Record Other Payment" search-select mein bhi hai).
                    if (form.customer_id) setForm(f => ({ ...f, customer_id: '' }))
                  }}
                  onFocus={() => !editingOrder && setShowCustomerDropdown(true)}
                />

                {showCustomerDropdown && !editingOrder && (
                  <>
                    <div onClick={() => setShowCustomerDropdown(false)} style={styles.filterMenuBackdrop} />
                    <div style={{ ...styles.filterMenu, width: '100%', maxHeight: '260px', overflowY: 'auto' }}>
                      {filteredCustomers.length === 0 ? (
                        <div style={{ padding: '10px 16px', fontSize: '13px', color: '#999' }}>
                          Koi customer nahi mila
                        </div>
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
                            style={{ ...styles.filterMenuItem, textTransform: 'none' }}
                          >
                            <strong>{c.firm_name}</strong>
                            {c.contact_name && <span style={{ color: '#888' }}> — {c.contact_name}</span>}
                            {c.phone && <div style={{ color: '#aaa', fontSize: '11px' }}>{c.phone}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <input
                style={styles.input}
                placeholder="Description (e.g. Dukan ka flex)"
                name="description"
                value={form.description}
                onChange={handleFormChange}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: 'bold' }}>
                Line Items {editingOrder && (
                  <span style={{ fontSize: '11px', color: '#e74c3c' }}>(editing will recalculate total)</span>
                )}
              </p>
              {items.map((item, index) => (
                <div key={index} style={{ marginBottom: '10px', backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap', rowGap: '8px' }}>
                    <input
                      style={{ ...styles.input, flex: 3, minWidth: '160px' }}
                      placeholder="Item name (e.g. Flex 180GSM, Pipe 3kg, Labour)"
                      value={item.item_name}
                      onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                    />
                    <input
                      type="date"
                      style={{ ...styles.input, maxWidth: '150px', minWidth: '130px', flex: 'none' }}
                      value={item.item_date || ''}
                      onChange={e => handleItemChange(index, 'item_date', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSizeMode(index)}
                      style={{
                        ...styles.toggleBtn,
                        backgroundColor: item.useSize ? '#1a1a2e' : '#fff',
                        color: item.useSize ? '#fff' : '#333',
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <Ruler size={13} /> {item.useSize ? 'Size ON' : 'L×B'}
                    </button>
                    <button type="button" onClick={() => removeItemRow(index)} style={{ ...styles.removeBtn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={14} /></button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', rowGap: '10px', width: '100%' }}>
                    {item.useSize ? (
                      // Pehle Length/×/Breadth/×/Pcs/=/Sq.ft — 7 alag flex-items the, jinka
                      // total minWidth-demand narrow screen pe container se zyada ho jaata
                      // tha aur flex-wrap reliably wrap nahi kar pata tha (page horizontal-
                      // overflow karta tha). Ab ek CSS Grid (auto-fit) mein — ye guaranteed
                      // wrap karta hai, chahe screen kitni bhi narrow ho. × aur = signs ab
                      // ek chhoti formula-preview line mein hain (bonus: live calculation
                      // dikhta rehta hai).
                      <div style={{ flex: '1 1 100%', minWidth: 0 }}>
                        {(item.length || item.breadth || item.pieces) && (
                          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                            {item.length || 0} ft × {item.breadth || 0} ft × {item.pieces || 1} pcs = <strong style={{ color: '#27ae60' }}>{item.quantity || 0} sq.ft</strong>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '8px' }}>
                          <div>
                            <label style={styles.label}>Length (ft)</label>
                            <input style={{ ...styles.input, minWidth: 0, width: '100%' }} type="number" placeholder="e.g. 10"
                              value={item.length} onChange={e => handleItemChange(index, 'length', e.target.value)} />
                          </div>
                          <div>
                            <label style={styles.label}>Breadth (ft)</label>
                            <input style={{ ...styles.input, minWidth: 0, width: '100%' }} type="number" placeholder="e.g. 4"
                              value={item.breadth} onChange={e => handleItemChange(index, 'breadth', e.target.value)} />
                          </div>
                          <div>
                            <label style={styles.label}>Pcs</label>
                            <input style={{ ...styles.input, minWidth: 0, width: '100%' }} type="number" placeholder="1"
                              value={item.pieces} onChange={e => handleItemChange(index, 'pieces', e.target.value)} />
                          </div>
                          <div>
                            <label style={styles.label}>Sq.ft (auto)</label>
                            <input style={{ ...styles.input, minWidth: 0, width: '100%', backgroundColor: '#e8f5e9' }} value={item.quantity} readOnly />
                          </div>
                        </div>
                      </div>
                    ) : (
                      // flex:1 pehle wide-screen par teeno columns ko poori row-width
                      // equally baant deta tha — input apni chhoti intrinsic-width hi
                      // leta tha (width:100% missing), isliye Subtotal door chala jaata
                      // tha bade khaali gap ke saath. Ab flex-grow band, maxWidth-capped
                      // — compact rehta hai chahe screen kitni bhi wide ho.
                      <div style={{ flex: '0 1 150px', minWidth: '90px', maxWidth: '180px' }}>
                        <label style={styles.label}>Quantity / Sq.ft</label>
                        <input style={{ ...styles.input, minWidth: '0', width: '100%' }} type="number" placeholder="0"
                          value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                      </div>
                    )}
                    <div style={{ flex: '0 1 150px', minWidth: '90px', maxWidth: '180px' }}>
                      <label style={styles.label}>Rate (₹)</label>
                      <input style={{ ...styles.input, minWidth: '0', width: '100%' }} type="number" placeholder="0"
                        value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} />
                    </div>
                    <div style={{ flex: '0 1 150px', minWidth: '90px', maxWidth: '180px' }}>
                      <label style={styles.label}>Subtotal</label>
                      <div style={{ padding: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                        ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addItemRow} style={styles.addItemBtn}>+ Add Item</button>
            </div>

            {/* ── Totals + Advance Section ── */}
            <div style={styles.totalsBox}>
              <div style={styles.totalRow}>
                <span>Total Amount:</span>
                <strong>₹{total.toFixed(2)}</strong>
              </div>

              <div style={styles.totalRow}>
                <span>Advance Paid:</span>
                <div>
                  <input
                    style={{
                      ...styles.input, width: '150px', flex: 'none',
                      ...(advanceAmountLocked ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {})
                    }}
                    placeholder="0" type="number" name="advance_paid"
                    value={form.advance_paid} onChange={handleFormChange}
                    readOnly={advanceAmountLocked}
                  />
                  {advanceAmountLocked && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      Denomination counter se bharo (neeche)
                    </div>
                  )}
                </div>
              </div>

              {advance > 0 && (
                <div style={styles.totalRow}>
                  <span>Advance Date:</span>
                  <input
                    type="date"
                    style={{ ...styles.input, width: '150px', flex: 'none' }}
                    name="advance_payment_date"
                    value={form.advance_payment_date}
                    onChange={handleFormChange}
                  />
                </div>
              )}

              {advance > 0 && (
                <>
                  <div style={styles.totalRow}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Payment Mode
                      <span style={styles.requiredDot}>*</span>
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, advance_payment_mode: 'cash', advance_upi_account: '' }))}
                        style={{
                          ...styles.modeBtn,
                          ...(form.advance_payment_mode === 'cash' ? styles.modeBtnActive : {}),
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <Banknote size={14} /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, advance_payment_mode: 'upi' }))}
                        style={{
                          ...styles.modeBtn,
                          ...(form.advance_payment_mode === 'upi' ? styles.modeBtnActive : {}),
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <Smartphone size={14} /> UPI
                      </button>
                    </div>
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
                    <div style={styles.totalRow}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        UPI Account
                        <span style={styles.requiredDot}>*</span>
                      </span>
                      <select
                        name="advance_upi_account"
                        value={form.advance_upi_account}
                        onChange={handleFormChange}
                        style={{ ...styles.input, width: '220px', flex: 'none' }}
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

              <div style={styles.totalRow}>
                <span>Discount / Round-off:</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    style={{ ...styles.input, width: '110px', flex: 'none' }}
                    placeholder="₹0" type="number" name="discount_amount"
                    value={form.discount_amount} onChange={handleFormChange}
                  />
                  <input
                    style={{ ...styles.input, width: '160px', flex: 'none' }}
                    placeholder="Note (e.g. round-off)"
                    name="discount_note"
                    value={form.discount_note} onChange={handleFormChange}
                  />
                </div>
              </div>

              <div style={styles.totalRow}>
                <span>Balance Due:</span>
                <strong style={{ color: balance > 0 ? '#e74c3c' : '#27ae60' }}>
                  ₹{balance.toFixed(2)}
                </strong>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Follow-up Date</label>
                <input style={styles.input} type="date" name="follow_up_date"
                  value={form.follow_up_date} onChange={handleFormChange} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={styles.label}>Notes</label>
                <input style={styles.input} placeholder="Size, GSM, special notes..."
                  name="notes" value={form.notes} onChange={handleFormChange} />
              </div>
            </div>

            <LoadingButton loading={submitting} style={styles.submitBtn} type="submit">
              {editingOrder ? 'Update Order' : 'Create Order'}
            </LoadingButton>
          </form>
        </div>
      )}
      <div style={styles.searchRow}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
          <input
            type="text"
            placeholder="Search by Order No. / Firm Name / Phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...styles.searchInput, width: '100%', paddingLeft: '36px' }}
          />
        </div>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ ...styles.clearSearchBtn, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <X size={13} /> Clear
          </button>
        )}

        {/* Status filter — ab dropdown mein, search ke saath hi single line */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFilterMenu(o => !o)}
            style={{
              ...styles.filterDropdownBtn,
              ...(filterStatus ? styles.filterDropdownBtnActive : {})
            }}
          >
            <ListFilter size={14} />
            {filterStatus === '' ? 'Filter' : filterStatus.replace('_', ' ')}
            <ChevronDown size={13} />
          </button>

          {showFilterMenu && (
            <>
              <div onClick={() => setShowFilterMenu(false)} style={styles.filterMenuBackdrop} />
              <div style={styles.filterMenu}>
                {['', 'pending', 'in_progress', 'ready', 'delivered'].map(s => (
                  <button
                    key={s}
                    onClick={() => { setFilterStatus(s); setShowFilterMenu(false) }}
                    style={{
                      ...styles.filterMenuItem,
                      ...(filterStatus === s ? styles.filterMenuItemActive : {})
                    }}
                  >
                    {s === '' ? 'All' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

          {loading ? <SectionLoader label="Orders load ho rahe hain..." /> : orders.length === 0 ? (
          <p style={{ color: '#888' }}>No orders found.</p>
        ) : filteredOrders.length === 0 ? (
          <p style={{ color: '#888' }}>No orders match your search.</p>
        ) : (
        <div style={styles.tableScroll}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Order No.</th>
              <th style={styles.th}>Firm</th>
              <th style={styles.th}>Description</th>
              <th style={styles.th}>Total</th>
              <th style={styles.th}>Balance</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Follow-up</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <>
                <tr key={o.id} style={styles.tr}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  {/* ── ORDER NUMBER CELL ── */}
                  <td style={styles.td}>
                    {o.order_number ? (
                      <span style={styles.orderNumberBadge}>{o.order_number}</span>
                    ) : (
                      <span style={{ color: '#bbb', fontSize: '12px' }}>#{o.id}</span>
                    )}
                  </td>

                  <td style={styles.td}>
                    <strong>{o.firm_name}</strong><br />
                    <span style={{ fontSize: '12px', color: '#888' }}>{o.phone}</span>
                  </td>
                  <td style={styles.td}>{o.description || '—'}</td>
                  <td style={styles.td}>₹{o.total_amount}</td>
                  <td style={styles.td}>
                    <span style={{ color: o.balance_due > 0 ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>
                      ₹{o.balance_due}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={o.status}
                      onChange={e => handleStatusChange(o.id, e.target.value)}
                      style={{ ...styles.statusSelect, backgroundColor: statusColor(o.status) }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    {editingFollowUp === o.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="date"
                          value={followUpValue}
                          onChange={e => setFollowUpValue(e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #3498db', fontSize: '13px' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleFollowUpSave(o.id)}
                          style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingFollowUp(null)}
                          style={{ backgroundColor: '#fff', color: '#888', border: '1px solid #ddd', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{ color: o.follow_up_date && o.follow_up_date <= new Date().toLocaleDateString('en-CA') ? '#e74c3c' : '#333', cursor: 'pointer' }}
                          onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                        >
                          {o.follow_up_date || '—'}
                        </span>
                        <button
                          onClick={() => { setEditingFollowUp(o.id); setFollowUpValue(o.follow_up_date || '') }}
                          style={{ backgroundColor: '#f0f0f0', border: '1px solid #ddd', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#555', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    <button onClick={() => toggleExpand(o)} style={{ ...styles.detailBtn, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {expandedOrder === o.id ? <><ChevronUp size={12} /> Hide</> : <><ChevronDown size={12} /> Details</>}
                    </button>
                    <button onClick={() => openEditForm(o)} style={{ ...styles.editBtn, marginLeft: '6px' }}>
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
                      style={{
                        backgroundColor: '#fff',
                        color: '#1a1a2e',
                        border: '1px solid #1a1a2e',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginLeft: '6px'
                      }}
                    >
                      <FileText size={12} /> Bill
                    </LoadingButton>
                    <button
                      onClick={() => {
                        if (!o.phone) return setMessage('Customer has no phone number.')
                        setSelectedUpiForWA('')
                        setWaSendModal(o)
                      }}
                      style={{
                        backgroundColor: waStatus === 'ready' ? '#fff' : '#f5f5f5',
                        color: waStatus === 'ready' ? '#1a1a2e' : '#aaa',
                        border: waStatus === 'ready' ? '1px solid #1a1a2e' : '1px solid #ddd',
                        padding: '5px 12px',
                        borderRadius: '4px',
                        cursor: waStatus === 'ready' ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        marginLeft: '6px',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                      title={waStatus === 'ready' ? 'Send bill on WhatsApp' : 'WhatsApp not connected'}
                    >
                      <Smartphone size={12} /> WA
                    </button>
                    <button onClick={() => handleDeleteOrder(o)} style={{ ...styles.deleteBtn, marginLeft: '6px' }}>
                      Delete
                    </button>
                  </td>
                </tr>

                {expandedOrder === o.id && orderDetail && (
                  <tr key={`detail-${o.id}`}>
                    <td colSpan="8" style={styles.detailCell}>
                      <div style={styles.detailBox}>

                        {/* ── ORDER NUMBER HEADER in detail ── */}
                        {orderDetail.order_number && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 16px', backgroundColor: '#1a1a2e',
                            borderRadius: '8px', marginBottom: '4px'
                          }}>
                            <span style={{ color: '#aaa', fontSize: '13px' }}>Order Number</span>
                            <span style={{
                              color: '#fff', fontSize: '18px', fontWeight: 'bold',
                              letterSpacing: '1px', fontFamily: 'monospace'
                            }}>
                              {orderDetail.order_number}
                            </span>
                            <span style={{
                              marginLeft: 'auto', fontSize: '12px', color: '#aaa'
                            }}>
                              {orderDetail.firm_name} · {orderDetail.created_at
                                ? new Date(orderDetail.created_at).toLocaleDateString('en-GB').replace(/\//g, '.')
                                : ''}
                            </span>
                          </div>
                        )}

                        <div style={styles.detailSection}>
                          <h4 style={{ ...styles.detailTitle, display: 'flex', alignItems: 'center', gap: '6px' }}><Package size={15} /> Order Items</h4>
                          <div style={styles.tableScroll}>
                          <table style={styles.innerTable}>
                            <thead>
                              <tr>
                                <th style={styles.innerTh}>Item</th>
                                <th style={styles.innerTh}>Qty/Sq.ft</th>
                                <th style={styles.innerTh}>Rate</th>
                                <th style={styles.innerTh}>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.items && orderDetail.items.map(item => (
                                <tr key={item.id}>
                                  <td style={styles.innerTd}>{item.item_name}</td>
                                  <td style={styles.innerTd}>{item.quantity}</td>
                                  <td style={styles.innerTd}>₹{item.unit_price}</td>
                                  <td style={styles.innerTd}>₹{item.subtotal}</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f0f7ff' }}>
                                <td colSpan="3" style={{ ...styles.innerTd, fontWeight: 'bold', textAlign: 'right' }}>Total:</td>
                                <td style={{ ...styles.innerTd, fontWeight: 'bold', fontSize: '16px', color: '#1a1a2e' }}>
                                  ₹{orderDetail.total_amount}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          </div>
                        </div>

                        <div style={styles.detailSection}>
                          <h4 style={{ ...styles.detailTitle, display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={15} /> Payment History</h4>
                          <div style={styles.tableScroll}>
                          <table style={styles.innerTable}>
                            <thead>
                              <tr>
                                <th style={styles.innerTh}>#</th>
                                <th style={styles.innerTh}>Date</th>
                                <th style={styles.innerTh}>Amount</th>
                                <th style={styles.innerTh}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetail.advance_paid > 0 && (
                                <tr style={{ backgroundColor: '#fff9e6' }}>
                                  <td style={styles.innerTd}>1</td>
                                  <td style={styles.innerTd}>
                                    {orderDetail.created_at ? (() => {
                                      const d = new Date(orderDetail.advance_payment_date || orderDetail.created_at)
                                      const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                      const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                      return <span>{time}<br /><span style={{ fontSize: '11px', color: '#888' }}>{date}</span></span>
                                    })() : '—'}
                                  </td>
                                  <td style={styles.innerTd}><strong>₹{orderDetail.advance_paid}</strong></td>
                                  <td style={styles.innerTd}>
                                    <span style={styles.advanceBadge}>Advance</span>
                                    {orderDetail.advance_payment_mode && (
                                      <span style={{
                                        ...styles.advanceBadge,
                                        marginLeft: '6px',
                                        backgroundColor: orderDetail.advance_payment_mode === 'upi' ? '#e3f2fd' : '#e8f5e9',
                                        color: orderDetail.advance_payment_mode === 'upi' ? '#1565c0' : '#2e7d32'
                                      }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        {orderDetail.advance_payment_mode === 'upi' ? <><Smartphone size={11} /> UPI</> : <><Banknote size={11} /> Cash</>}
                                      </span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )}
                              {orderDetail.payments && orderDetail.payments.map((p, i) => (
                                <tr key={p.id}>
                                  <td style={styles.innerTd}>{(orderDetail.advance_paid > 0 ? 2 : 1) + i}</td>
                                  <td style={styles.innerTd}>
                                    {(p.created_at || p.payment_date) ? (() => {
                                      const d = new Date(p.created_at || p.payment_date)
                                      if (isNaN(d)) return p.created_at || p.payment_date
                                      const date = d.toLocaleDateString('en-GB').replace(/\//g, '.')
                                      const time = d.toLocaleTimeString('en-GB', { hour12: false })
                                      return <span>{time}<br /><span style={{ fontSize: '11px', color: '#888' }}>{date}</span></span>
                                    })() : '—'}
                                  </td>
                                  <td style={styles.innerTd}><strong>₹{p.amount}</strong></td>
                                  <td style={styles.innerTd}>
                                    {p.note || '—'}
                                    {p.payment_mode && (
                                      <span style={{
                                        ...styles.advanceBadge,
                                        marginLeft: '6px',
                                        backgroundColor: p.payment_mode === 'upi' ? '#e3f2fd' : '#e8f5e9',
                                        color: p.payment_mode === 'upi' ? '#1565c0' : '#2e7d32'
                                      }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          {p.payment_mode === 'upi'
                                            ? <><Smartphone size={11} /> {p.upi_account || 'UPI'}</>
                                            : <><Banknote size={11} /> Cash</>}
                                        </span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {orderDetail.cheques && orderDetail.cheques.map((c) => (
                                <tr key={`cheque-${c.id}`} style={{ backgroundColor: '#f5f0ff' }}>
                                  <td style={styles.innerTd}><Receipt size={14} /></td>
                                  <td style={styles.innerTd}>
                                    {c.received_date
                                      ? new Date(c.received_date).toLocaleDateString('en-GB').replace(/\//g, '.')
                                      : '—'}
                                  </td>
                                  <td style={styles.innerTd}><strong>₹{c.amount}</strong></td>
                                  <td style={styles.innerTd}>
                                    {c.notes || 'Cheque Payment'}
                                    {c.cheque_number && <span style={{ fontSize: '11px', color: '#888' }}> #{c.cheque_number}</span>}
                                    {c.bank_name && <span style={{ fontSize: '11px', color: '#888' }}> ({c.bank_name})</span>}
                                    <span style={{
                                      ...styles.advanceBadge,
                                      marginLeft: '6px',
                                      backgroundColor:
                                        c.status === 'cleared' ? '#e8f5e9'
                                        : c.status === 'bounced' ? '#fdecea'
                                        : '#fff3cd',
                                      color:
                                        c.status === 'cleared' ? '#2e7d32'
                                        : c.status === 'bounced' ? '#c0392b'
                                        : '#856404'
                                    }}>
                                      <Receipt size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                                      {c.status === 'cleared' ? 'Cleared'
                                        : c.status === 'bounced' ? 'Bounced'
                                        : 'Awaiting Clearance'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {orderDetail.discount_amount > 0 && (
                                <tr style={{ backgroundColor: '#fff8e1' }}>
                                  <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold', color: '#e67e22', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Scissors size={13} /> Discount {orderDetail.discount_note ? `(${orderDetail.discount_note})` : '(Round-off)'}
                                  </td>
                                  <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold', color: '#e67e22' }}>
                                    - ₹{orderDetail.discount_amount}
                                  </td>
                                </tr>
                              )}
                              <tr style={{ backgroundColor: '#f0fff4' }}>
                                <td colSpan="2" style={{ ...styles.innerTd, fontWeight: 'bold' }}>Balance Due</td>
                                <td colSpan="2" style={{
                                  ...styles.innerTd, fontWeight: 'bold', fontSize: '16px',
                                  color: orderDetail.balance_due > 0 ? '#e74c3c' : '#27ae60'
                                }}>
                                  ₹{orderDetail.balance_due}
                                  {orderDetail.follow_up_date && (
                                    <span style={{ fontSize: '12px', color: '#888', marginLeft: '10px' }}>
                                      Follow-up: {orderDetail.follow_up_date}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          </div>

                          {orderDetail.balance_due > 0 && (
                            <form onSubmit={handleAddPayment} style={styles.paymentForm}>
                              <h5 style={{ marginBottom: '8px', color: '#555' }}>+ Record New Payment</h5>

                              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontSize: '13px', color: '#888' }}>
                                  Kuch amount discount karna hai?
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setPaymentForm(f => ({ ...f, showDiscount: !f.showDiscount, discount_amount: '', discount_note: '' }))}
                                  style={{
                                    padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                    backgroundColor: paymentForm.showDiscount ? '#e67e22' : '#f0f0f0',
                                    color: paymentForm.showDiscount ? '#fff' : '#333',
                                    border: '1px solid #ddd',
                                    display: 'inline-flex', alignItems: 'center', gap: '5px'
                                  }}
                                >
                                  <Scissors size={12} /> {paymentForm.showDiscount ? 'Discount ON' : 'Discount OFF'}
                                </button>
                              </div>

                              {paymentForm.showDiscount && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', backgroundColor: '#fff8e1', padding: '10px', borderRadius: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#e67e22', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Scissors size={12} /> Discount:</span>
                                  <input
                                    style={{ ...styles.input, maxWidth: '130px' }}
                                    type="number" placeholder="Amount ₹"
                                    value={paymentForm.discount_amount || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, discount_amount: e.target.value })}
                                  />
                                  <input
                                    style={{ ...styles.input, flex: 2 }}
                                    placeholder="Note (e.g. round-off, 15 rs maafi)"
                                    value={paymentForm.discount_note || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, discount_note: e.target.value })}
                                  />
                                  <span style={{ fontSize: '13px', color: '#888', whiteSpace: 'nowrap' }}>
                                    Remaining: ₹{Math.max(0, orderDetail.balance_due - (parseFloat(paymentForm.discount_amount) || 0) - (parseFloat(paymentForm.amount) || 0))}
                                  </span>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <input
                                    style={{
                                      ...styles.input, maxWidth: '150px',
                                      ...(paymentAmountLocked ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : {})
                                    }}
                                    type="number" placeholder="Amount ₹"
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    readOnly={paymentAmountLocked}
                                  />
                                  {paymentAmountLocked && (
                                    <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                      Denomination counter se bharo
                                    </div>
                                  )}
                                </div>
                                <input
                                  style={{ ...styles.input, maxWidth: '160px' }}
                                  type="date"
                                  value={paymentForm.payment_date}
                                  onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                                />
                                <input
                                  style={{ ...styles.input, flex: 2 }}
                                  placeholder="Note (e.g. final payment)"
                                  value={paymentForm.note}
                                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '11px', color: '#888' }}>Payment Mode</label>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentForm(f => ({ ...f, payment_mode: 'cash', upi_account: '', cheque_number: '', bank_name: '' }))}
                                      style={{
                                        padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd',
                                        backgroundColor: paymentForm.payment_mode === 'cash' ? '#27ae60' : '#fff',
                                        color: paymentForm.payment_mode === 'cash' ? '#fff' : '#333',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                                      }}
                                    ><Banknote size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cash</button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentForm(f => ({ ...f, payment_mode: 'upi', cheque_number: '', bank_name: '' }))}
                                      style={{
                                        padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd',
                                        backgroundColor: paymentForm.payment_mode === 'upi' ? '#1565c0' : '#fff',
                                        color: paymentForm.payment_mode === 'upi' ? '#fff' : '#333',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                                      }}
                                    ><Smartphone size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />UPI</button>
                                    <button
                                      type="button"
                                      onClick={() => setPaymentForm(f => ({ ...f, payment_mode: 'cheque', upi_account: '' }))}
                                      style={{
                                        padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd',
                                        backgroundColor: paymentForm.payment_mode === 'cheque' ? '#8e44ad' : '#fff',
                                        color: paymentForm.payment_mode === 'cheque' ? '#fff' : '#333',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                                      }}
                                    ><Receipt size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Cheque</button>
                                  </div>
                                </div>

                                {paymentForm.payment_mode === 'cash' && noteTrackingEnabled && (
                                  <div style={{ flexBasis: '100%' }}>
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
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '11px', color: '#888' }}>UPI Account *</label>
                                    <select
                                      style={{ ...styles.input, minWidth: '200px' }}
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
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <label style={{ fontSize: '11px', color: '#888' }}>Cheque Number</label>
                                      <input
                                        style={{ ...styles.input, maxWidth: '140px' }}
                                        placeholder="e.g. 004521"
                                        value={paymentForm.cheque_number}
                                        onChange={e => setPaymentForm({ ...paymentForm, cheque_number: e.target.value })}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <label style={{ fontSize: '11px', color: '#888' }}>Bank Name</label>
                                      <input
                                        style={{ ...styles.input, maxWidth: '160px' }}
                                        placeholder="e.g. SBI, BOI"
                                        value={paymentForm.bank_name}
                                        onChange={e => setPaymentForm({ ...paymentForm, bank_name: e.target.value })}
                                      />
                                    </div>
                                  </>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '11px', color: '#888' }}>Next Follow-up</label>
                                  <input
                                    style={{ ...styles.input, maxWidth: '160px' }}
                                    type="date"
                                    value={paymentForm.follow_up_date || ''}
                                    onChange={e => setPaymentForm({ ...paymentForm, follow_up_date: e.target.value })}
                                  />
                                </div>

                                <LoadingButton loading={paymentSubmitting} type="submit" style={styles.submitBtn}>Save Payment</LoadingButton>
                              </div>
                            </form>
                          )}
                        </div>

                        {orderDetail.notes && (
                          <div style={styles.detailSection}>
                            <h4 style={{ ...styles.detailTitle, display: 'flex', alignItems: 'center', gap: '6px' }}><StickyNote size={15} /> Notes</h4>
                            <p style={{ fontSize: '14px', color: '#555' }}>{orderDetail.notes}</p>
                          </div>
                        )}

                        {/* ACTIVITY LOG */}
                        {orderDetail.activityLog && orderDetail.activityLog.length > 0 && (
                          <div style={styles.detailSection}>
                            <h4 style={{ ...styles.detailTitle, display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={15} /> Activity Log</h4>
                            {orderDetail.activityLog.map(a => (
                              <div key={a.id} style={{
                                fontSize: '12px', color: '#555',
                                padding: '8px 12px', backgroundColor: '#f0f7ff',
                                borderRadius: '6px', marginBottom: '6px',
                                borderLeft: '3px solid #3498db'
                              }}>
                                {a.activity}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ORDER PHOTOS */}
                        <div style={styles.detailSection}>
                          <h4 style={{ ...styles.detailTitle, display: 'flex', alignItems: 'center', gap: '6px' }}><Camera size={15} /> Order Photos</h4>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="Caption (optional)"
                              value={photoCaption}
                              onChange={e => setPhotoCaption(e.target.value)}
                              style={{ ...styles.input, maxWidth: '200px' }}
                            />
                            <label style={{
                              backgroundColor: '#1a1a2e', color: '#fff', padding: '8px 16px',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                              opacity: photoUploading ? 0.6 : 1, whiteSpace: 'nowrap'
                            }}>
                              {photoUploading ? 'Uploading...' : <><Paperclip size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Add Photo</>}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoUpload}
                                disabled={photoUploading}
                                style={{ display: 'none' }}
                              />
                            </label>
                          </div>
                          {orderPhotos.length === 0 ? (
                            <p style={{ color: '#aaa', fontSize: '13px' }}>Koi photo nahi — upar se add karo.</p>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                              {orderPhotos.map(p => (
                                <div key={p.id} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                                  <img
                                    src={`http://localhost:5000/${p.photo_path}`}
                                    alt={p.caption || 'Order photo'}
                                    style={{ width: '100%', height: '100px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                                    onClick={() => setLightboxPhoto(p)}
                                  />
                                  {p.caption && (
                                    <div style={{ fontSize: '11px', color: '#555', padding: '4px 6px', backgroundColor: '#f9f9f9' }}>
                                      {p.caption}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handlePhotoDelete(p.id)}
                                    style={{
                                      position: 'absolute', top: '4px', right: '4px',
                                      backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
                                      border: 'none', borderRadius: '50%', width: '22px', height: '22px',
                                      fontSize: '12px', cursor: 'pointer', lineHeight: 1,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                  ><X size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* WA SEND MODAL */}
      {waSendModal && (
        <div
          onClick={() => setWaSendModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '28px', width: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '6px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> WhatsApp Bill</h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
              {waSendModal.firm_name} — Bill #{waSendModal.order_number || waSendModal.id}
            </p>

            {waSendModal.balance_due > 0 ? (
              <>
                <p style={{ fontSize: '13px', color: '#e74c3c', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> Balance Due: ₹{waSendModal.balance_due}
                </p>
                <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
                  UPI QR bhejna hai? Account select karo:
                </label>
                <select
                  value={selectedUpiForWA}
                  onChange={e => setSelectedUpiForWA(e.target.value)}
                  style={{ ...styles.input, marginBottom: '20px' }}
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
              <p style={{ fontSize: '13px', color: '#27ae60', marginBottom: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} /> Fully Paid — QR nahi bheja jayega
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setWaSendModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
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
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', backgroundColor: '#25D366', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
              >
                <Send size={14} /> Send
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}
        >
          <img
            src={`http://localhost:5000/${lightboxPhoto.photo_path}`}
            alt={lightboxPhoto.caption || 'Order photo'}
            style={{ maxWidth: '92%', maxHeight: '82%', borderRadius: '8px', cursor: 'default' }}
            onClick={e => e.stopPropagation()}
          />
          {lightboxPhoto.caption && (
            <p style={{ color: '#ddd', fontSize: '14px', marginTop: '12px' }}>{lightboxPhoto.caption}</p>
          )}
          <button
            onClick={() => setLightboxPhoto(null)}
            style={{ position: 'absolute', top: '20px', right: '28px', background: 'transparent', border: 'none', color: '#fff', fontSize: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          ><X size={28} /></button>
        </div>
      )}
    </div>
  )
}

function statusColor(status) {
  const colors = { pending: '#f39c12', in_progress: '#3498db', ready: '#27ae60', delivered: '#95a5a6' }
  return colors[status] || '#ccc'
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  addBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  message: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  formBox: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', boxSizing: 'border-box', maxWidth: '100%', overflowX: 'hidden' },
  formRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', flex: '1', minWidth: '120px', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  toggleBtn: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  removeBtn: { width: '32px', height: '32px', backgroundColor: '#fee', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  deleteBtn: { backgroundColor: '#800000', color: '#fff', border: '1px solid #800000', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  addItemBtn: { backgroundColor: '#f0f0f0', border: '1px solid #ddd', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '4px' },
  totalsBox: { backgroundColor: '#f8f8f8', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '460px', width: '100%', boxSizing: 'border-box' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', flexWrap: 'wrap', gap: '8px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  searchRow: { display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '340px', maxWidth: '100%', boxSizing: 'border-box' },
  clearSearchBtn: { backgroundColor: '#fff', border: '1px solid #ddd', color: '#888', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  filterDropdownBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', color: '#555', cursor: 'pointer', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize', whiteSpace: 'nowrap' },
  filterDropdownBtnActive: { border: '1px solid #1a1a2e', color: '#1a1a2e' },
  filterMenuBackdrop: { position: 'fixed', inset: 0, zIndex: 90 },
  filterMenu: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #eee', zIndex: 100, minWidth: '160px', overflow: 'hidden' },
  filterMenuItem: { display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', color: '#333', textTransform: 'capitalize' },
  filterMenuItemActive: { backgroundColor: '#1a1a2e', color: '#fff', fontWeight: 'bold' },
  table: { width: '100%', minWidth: '900px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  th: { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td: { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr: { backgroundColor: '#fff' },
  statusSelect: { border: 'none', padding: '5px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  detailBtn: { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  detailCell: { padding: '0', backgroundColor: '#f0f7ff', borderBottom: '2px solid #ddd' },
  detailBox: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  detailSection: { backgroundColor: '#fff', padding: '16px', borderRadius: '8px' },
  detailTitle: { marginBottom: '10px', fontSize: '14px', color: '#333' },
  innerTable: { width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '13px' },
  innerTh: { padding: '8px 12px', backgroundColor: '#f8f8f8', textAlign: 'left', borderBottom: '1px solid #eee', color: '#666' },
  innerTd: { padding: '8px 12px', borderBottom: '1px solid #f0f0f0' },
  advanceBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' },
  paymentForm: { marginTop: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px' },
  modeBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  modeBtnActive: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  requiredDot: { color: '#e74c3c', fontSize: '16px', lineHeight: 1 },
  // ── NEW: order number badge style ──
  orderNumberBadge: {
    display: 'inline-block',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    fontFamily: 'monospace'
  }
}

export default Orders