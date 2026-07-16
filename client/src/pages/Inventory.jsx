import { useState, useEffect, useCallback } from 'react'
import {
  getFlexStock, addFlexStock, useFlexStock as consumeFlexStock, updateFlexStock, deleteFlexStock,
  getStamps, addStamp, updateStamp, deleteStamp,
  getChemicals, addChemical, updateChemical, deleteChemical,
  getFrames, addFrame, updateFrame, deleteFrame,
  getInkStock, addInkStock, updateInkStock, deleteInkStock,
  getInventoryCategories, addInventoryCategory, deleteInventoryCategory,
  getDynamicItems, addDynamicItem, updateDynamicItem, deleteDynamicItem
} from '../services/api'
import LoadingButton from '../components/LoadingButton'
import {
  Package, Image, Stamp, FlaskConical, Printer, Pencil, X, Send,
  AlertTriangle, Siren, CheckCircle2, Palette, Droplet, FolderPlus,
  Trash2, Box,
} from 'lucide-react'

const FLEX_BRANDS = [
  'Normal (180 GSM)', 'Jindal (220 GSM)', 'Black Back', 'Star (300 GSM)',
  'Vinayal', 'One Way Vision', 'Radium', 'Retro Flex', 'Retro Gumming', 'Other'
]
const INK_COLOR_MAP = {
  Cyan: '#00bcd4', Magenta: '#e91e93', Yellow: '#f5c518',
  Black: '#333333', Solvent: '#27ae60', Other: '#9b59b6'
}
const FLEX_SIZES = [3, 4, 5, 6, 8, 10]
const INK_COLORS = ['Cyan', 'Magenta', 'Yellow', 'Black']

// ─────────────────────────────────────────────────────────────────────────────
function Inventory() {
  const [activeTab, setActiveTab]   = useState('flex')
  const [message, setMessage]       = useState('')
  const [msgType, setMsgType]       = useState('success')

  // Flex
  const [flexStock, setFlexStock]         = useState([])
  const [showFlexForm, setShowFlexForm]   = useState(false)
  const [flexForm, setFlexForm]           = useState({ brand: '', size_ft: '', quantity: '', notes: '' })
  const [useForm, setUseForm]             = useState({ id: null, quantity: '', notes: '' })
  const [showUseModal, setShowUseModal]   = useState(false)
  const [editFlex, setEditFlex]           = useState(null)

  // Stamps
  const [stamps, setStamps]               = useState([])
  const [showStampForm, setShowStampForm] = useState(false)
  const [stampForm, setStampForm]         = useState({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
  const [editStamp, setEditStamp]         = useState(null)

  // Chemicals
  const [chemicals, setChemicals]         = useState([])
  const [showChemForm, setShowChemForm]   = useState(false)
  const [chemForm, setChemForm]           = useState({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
  const [editChem, setEditChem]           = useState(null)

  // Frames
  const [frames, setFrames]               = useState([])
  const [showFrameForm, setShowFrameForm] = useState(false)
  const [frameForm, setFrameForm]         = useState({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
  const [editFrame, setEditFrame]         = useState(null)

  // Ink
  const [inkStock, setInkStock]           = useState([])
  const [showInkForm, setShowInkForm]     = useState(false)
  const [inkForm, setInkForm]             = useState({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
  const [editInk, setEditInk]             = useState(null)

  // Dynamic categories
  const [categories, setCategories]               = useState([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm]           = useState({ label: '', icon: '📦', attr1_label: 'Size', attr2_label: 'Type', unit_default: 'pcs' })
  const [categorySaving, setCategorySaving]       = useState(false)
  const [flexSaving, setFlexSaving]         = useState(false)
  const [useSaving, setUseSaving]           = useState(false)
  const [stampSaving, setStampSaving]       = useState(false)
  const [chemSaving, setChemSaving]         = useState(false)
  const [frameSaving, setFrameSaving]       = useState(false)
  const [inkSaving, setInkSaving]           = useState(false)

  // ── fetch helpers ──────────────────────────────────────────────────────────
  function fetchAll() {
    getFlexStock().then(r => setFlexStock(r.data)).catch(() => {})
    getStamps().then(r => setStamps(r.data)).catch(() => {})
    getChemicals().then(r => setChemicals(r.data)).catch(() => {})
    getFrames().then(r => setFrames(r.data)).catch(() => {})
    getInkStock().then(r => setInkStock(r.data)).catch(() => {})
  }
  function fetchCategories() {
    getInventoryCategories().then(r => setCategories(r.data)).catch(() => {})
  }
  useEffect(() => { fetchAll(); fetchCategories() }, [])

  // showMsg() already 3.5 sec baad auto-clear karta hai — bas tab badalte
  // hi turant clear bhi karna hai, warna "Flex stock updated" jaisa message
  // Stamps ya Chemicals tab pe bhi dikh sakta tha.
  useEffect(() => {
    queueMicrotask(() => setMessage(''))
  }, [activeTab])


  function showMsg(text, type = 'success') {
    setMessage(text); setMsgType(type)
    setTimeout(() => setMessage(''), 3500)
  }

  // ── NEW CATEGORY ───────────────────────────────────────────────────────────
  function handleCreateCategory(e) {
    e.preventDefault()
    if (!categoryForm.label.trim()) return showMsg('Category name required', 'error')
    setCategorySaving(true)
    addInventoryCategory(categoryForm)
      .then((res) => {
        const newId = res.data.id
        showMsg(`✅ Category created: ${categoryForm.label}`)
        setShowCategoryModal(false)
        setCategoryForm({ label: '', icon: '📦', attr1_label: 'Size', attr2_label: 'Type', unit_default: 'pcs' })
        getInventoryCategories().then(r => {
          setCategories(r.data)
          setActiveTab(`dyn-${newId}`)
        })
      })
      .catch(err => showMsg(err.response?.data?.error || 'Error creating category', 'error'))
      .finally(() => setCategorySaving(false))
  }

  function handleDeleteCategory(catId) {
    deleteInventoryCategory(catId).then(() => {
      showMsg('Category deleted')
      setActiveTab('flex')
      getInventoryCategories().then(r => setCategories(r.data))
    }).catch(() => showMsg('Error deleting category', 'error'))
  }

  // ── FLEX ───────────────────────────────────────────────────────────────────
  function handleAddFlex(e) {
    e.preventDefault()
    if (!flexForm.brand || !flexForm.size_ft || !flexForm.quantity) return showMsg('All fields required', 'error')
    setFlexSaving(true)
    addFlexStock(flexForm).then(() => {
      showMsg('Flex stock added/updated')
      setFlexForm({ brand: '', size_ft: '', quantity: '', notes: '' })
      setShowFlexForm(false)
      getFlexStock().then(r => setFlexStock(r.data))
    }).catch(() => showMsg('Error adding flex stock', 'error'))
      .finally(() => setFlexSaving(false))
  }

  function handleUseFlex(e) {
    e.preventDefault()
    if (!useForm.quantity) return showMsg('Enter quantity to use', 'error')
    setUseSaving(true)
    consumeFlexStock(useForm.id, { quantity: useForm.quantity, notes: useForm.notes })
      .then(() => {
        showMsg('Stock reduced')
        setShowUseModal(false)
        setUseForm({ id: null, quantity: '', notes: '' })
        getFlexStock().then(r => setFlexStock(r.data))
      }).catch(err => showMsg(err.response?.data?.error || 'Error', 'error'))
      .finally(() => setUseSaving(false))
  }

  function handleUpdateFlex(e) {
    e.preventDefault()
    updateFlexStock(editFlex.id, editFlex).then(() => {
      showMsg('Updated'); setEditFlex(null)
      getFlexStock().then(r => setFlexStock(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  const flexByBrand = flexStock.reduce((acc, item) => {
    if (!acc[item.brand]) acc[item.brand] = {}
    acc[item.brand][item.size_ft] = item
    return acc
  }, {})

  // ── STAMPS ─────────────────────────────────────────────────────────────────
  function handleStampRestock(e) {
    e.preventDefault()
    const { stamp_type, size, design_type, quantity_to_add, notes } = stampForm
    if (!stamp_type || !quantity_to_add) return showMsg('Stamp type and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    setStampSaving(true)
    const existing = stamps.find(s =>
      s.stamp_type.trim().toLowerCase() === stamp_type.trim().toLowerCase() &&
      (s.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
      (s.design_type || '').trim().toLowerCase() === (design_type || '').trim().toLowerCase()
    )
    if (existing) {
      updateStamp(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
        .then(() => {
          showMsg(`✅ ${stamp_type} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setStampForm({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
          setShowStampForm(false)
          getStamps().then(r => setStamps(r.data))
        }).catch(() => showMsg('Error updating stamp', 'error'))
        .finally(() => setStampSaving(false))
    } else {
      addStamp({ stamp_type, size, design_type, quantity: qty, notes })
        .then(() => {
          showMsg(`✅ New stamp added: ${stamp_type}`)
          setStampForm({ stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' })
          setShowStampForm(false)
          getStamps().then(r => setStamps(r.data))
        }).catch(() => showMsg('Error adding stamp', 'error'))
        .finally(() => setStampSaving(false))
    }
  }

  function handleStampEdit(e) {
    e.preventDefault()
    updateStamp(editStamp.id, editStamp).then(() => {
      showMsg('Stamp updated'); setEditStamp(null)
      getStamps().then(r => setStamps(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  // ── CHEMICALS ──────────────────────────────────────────────────────────────
  function handleChemRestock(e) {
    e.preventDefault()
    const { chemical_name, quantity_to_add, unit, items_per_box, minimum_stock, notes } = chemForm
    if (!chemical_name || !quantity_to_add) return showMsg('Chemical name and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    setChemSaving(true)
    const existing = chemicals.find(c =>
      c.chemical_name.trim().toLowerCase() === chemical_name.trim().toLowerCase()
    )
    if (existing) {
      const payload = {
        ...existing,
        quantity: existing.quantity + qty,
        notes: notes || existing.notes,
        minimum_stock: minimum_stock || existing.minimum_stock,
        items_per_box: unit === 'box' ? items_per_box : existing.items_per_box
      }
      updateChemical(existing.id, payload).then(() => {
        showMsg(`✅ ${chemical_name} updated: ${existing.quantity} → ${existing.quantity + qty}`)
        setChemForm({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
        setShowChemForm(false)
        getChemicals().then(r => setChemicals(r.data))
      }).catch(() => showMsg('Error updating chemical', 'error'))
        .finally(() => setChemSaving(false))
    } else {
      addChemical({ chemical_name, quantity: qty, unit, items_per_box: unit === 'box' ? items_per_box : null, minimum_stock, notes })
        .then(() => {
          showMsg(`✅ New chemical added: ${chemical_name}`)
          setChemForm({ chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' })
          setShowChemForm(false)
          getChemicals().then(r => setChemicals(r.data))
        }).catch(() => showMsg('Error adding chemical', 'error'))
        .finally(() => setChemSaving(false))
    }
  }


  function handleChemEdit(e) {
    e.preventDefault()
    updateChemical(editChem.id, { ...editChem, items_per_box: editChem.unit === 'box' ? editChem.items_per_box : null })
      .then(() => { showMsg('Chemical updated'); setEditChem(null); getChemicals().then(r => setChemicals(r.data)) })
      .catch(() => showMsg('Error', 'error'))
  }

  function chemQtyDisplay(c) {
    if (c.unit === 'box' && c.items_per_box && c.items_per_box > 0)
      return `${c.quantity} Box (${c.quantity * c.items_per_box} pcs)`
    return `${c.quantity}`
  }

  // ── FRAMES ─────────────────────────────────────────────────────────────────
  function handleFrameRestock(e) {
    e.preventDefault()
    const { frame_type, size, design, quantity_to_add, notes } = frameForm
    if (!frame_type || !quantity_to_add) return showMsg('Frame type and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    setFrameSaving(true)
    const existing = frames.find(f =>
      f.frame_type.trim().toLowerCase() === frame_type.trim().toLowerCase() &&
      (f.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
      (f.design || '').trim().toLowerCase() === (design || '').trim().toLowerCase()
    )
    if (existing) {
      updateFrame(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
        .then(() => {
          showMsg(`✅ ${frame_type} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setFrameForm({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
          setShowFrameForm(false)
          getFrames().then(r => setFrames(r.data))
        }).catch(() => showMsg('Error updating frame', 'error'))
        .finally(() => setFrameSaving(false))
    } else {
      addFrame({ frame_type, size, design, quantity: qty, notes })
        .then(() => {
          showMsg(`✅ New frame added: ${frame_type}`)
          setFrameForm({ frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' })
          setShowFrameForm(false)
          getFrames().then(r => setFrames(r.data))
        }).catch(() => showMsg('Error adding frame', 'error'))
        .finally(() => setFrameSaving(false))
    }
  }

  function handleFrameEdit(e) {
    e.preventDefault()
    updateFrame(editFrame.id, editFrame).then(() => {
      showMsg('Frame updated'); setEditFrame(null)
      getFrames().then(r => setFrames(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  // ── INK & SOLVENT ──────────────────────────────────────────────────────────
  function handleInkRestock(e) {
    e.preventDefault()
    const { item_name, item_type, quantity_to_add, unit, minimum_level, notes } = inkForm
    if (!item_name || !quantity_to_add) return showMsg('Item name and quantity required', 'error')
    const qty = parseFloat(quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')

    setInkSaving(true)
    const existing = inkStock.find(i =>
      i.item_type === item_type && i.item_name.trim().toLowerCase() === item_name.trim().toLowerCase()
    )
    if (existing) {
      updateInkStock(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes, minimum_level: minimum_level || existing.minimum_level })
        .then(() => {
          showMsg(`✅ ${item_name} updated: ${existing.quantity} → ${existing.quantity + qty}`)
          setInkForm({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
          setShowInkForm(false)
          getInkStock().then(r => setInkStock(r.data))
        }).catch(() => showMsg('Error updating ink', 'error'))
        .finally(() => setInkSaving(false))
    } else {
      addInkStock({ item_name, item_type, quantity: qty, unit, minimum_level, notes })
        .then(() => {
          showMsg(`✅ New item added: ${item_name}`)
          setInkForm({ item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' })
          setShowInkForm(false)
          getInkStock().then(r => setInkStock(r.data))
        }).catch(() => showMsg('Error adding ink', 'error'))
        .finally(() => setInkSaving(false))
    }
  }

  function handleInkEdit(e) {
    e.preventDefault()
    updateInkStock(editInk.id, editInk).then(() => {
      showMsg('Updated'); setEditInk(null)
      getInkStock().then(r => setInkStock(r.data))
    }).catch(() => showMsg('Error', 'error'))
  }

  const inkItems    = inkStock.filter(i => i.item_type === 'ink')
  const solventItems = inkStock.filter(i => i.item_type === 'solvent')

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={S.header}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={20} /> Inventory</h2>
      </div>

      {message && (
        <p style={{ ...S.msg, ...(msgType === 'error' ? S.msgErr : {}) }} onClick={() => setMessage('')}>
          {message}
        </p>
      )}

      {/* ── TABS ── */}
      <div style={S.tabRow}>
        {[
          ['flex',      <><Image size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Flex Rolls</>],
          ['stamps',    <><Stamp size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Stamps</>],
          ['chemicals', <><FlaskConical size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Chemicals</>],
          ['frames',    <><Image size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Photo Frames</>],
          ['ink',       <><Printer size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Ink & Solvent</>],
        ].map(([key, label]) => (
          <button key={key}
            style={{ ...S.tab, ...(activeTab === key ? S.activeTab : {}) }}
            onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}

        {/* Dynamic category tabs */}
        {categories.map(cat => (
          <button key={`dyn-${cat.id}`}
            style={{ ...S.tab, ...(activeTab === `dyn-${cat.id}` ? S.activeTab : {}) }}
            onClick={() => setActiveTab(`dyn-${cat.id}`)}>
            {cat.icon} {cat.label}
          </button>
        ))}

        {/* + New Category button */}
        <button
          style={{ ...S.tab, border: '2px dashed #bbb', color: '#666', background: 'transparent' }}
          onClick={() => setShowCategoryModal(true)}>
          + New Category
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FLEX ROLLS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'flex' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            <button style={S.addBtn} onClick={() => setShowFlexForm(!showFlexForm)}>
              {showFlexForm ? 'Cancel' : '+ Add Stock'}
            </button>
          </div>

          {showFlexForm && (
            <div style={S.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Flex Roll</h3>
              <form onSubmit={handleAddFlex}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Brand / Type *</label>
                    <select style={S.input} value={flexForm.brand}
                      onChange={e => setFlexForm({ ...flexForm, brand: e.target.value })}>
                      <option value="">Select Brand</option>
                      {FLEX_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Size (ft) *</label>
                    <select style={S.input} value={flexForm.size_ft}
                      onChange={e => setFlexForm({ ...flexForm, size_ft: e.target.value })}>
                      <option value="">Select Size</option>
                      {FLEX_SIZES.map(s => <option key={s} value={s}>{s} ft</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Rolls to Add *</label>
                    <input style={S.input} type="number" placeholder="0"
                      value={flexForm.quantity}
                      onChange={e => setFlexForm({ ...flexForm, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={S.label}>Notes</label>
                    <input style={S.input} placeholder="e.g. New batch from Delhi"
                      value={flexForm.notes}
                      onChange={e => setFlexForm({ ...flexForm, notes: e.target.value })} />
                  </div>
                </div>
                <LoadingButton loading={flexSaving} style={S.submitBtn} type="submit">Save Stock</LoadingButton>
              </form>
            </div>
          )}

          {editFlex && (
            <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editFlex.brand} {editFlex.size_ft}ft</h3>
              <form onSubmit={handleUpdateFlex}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Quantity (Rolls)</label>
                    <input style={S.input} type="number" value={editFlex.quantity}
                      onChange={e => setEditFlex({ ...editFlex, quantity: e.target.value })} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={S.label}>Notes</label>
                    <input style={S.input} value={editFlex.notes || ''}
                      onChange={e => setEditFlex({ ...editFlex, notes: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={S.submitBtn} type="submit">Save</button>
                  <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditFlex(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {showUseModal && (
            <div style={S.modal}>
              <div style={S.modalBox}>
                <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={17} /> Use Flex Stock</h3>
                <form onSubmit={handleUseFlex}>
                  <label style={S.label}>Rolls Used *</label>
                  <input style={{ ...S.input, marginBottom: '12px' }} type="number" placeholder="e.g. 2"
                    value={useForm.quantity}
                    onChange={e => setUseForm({ ...useForm, quantity: e.target.value })} />
                  <label style={S.label}>Notes</label>
                  <input style={{ ...S.input, marginBottom: '16px' }} placeholder="e.g. Used for Vijay Flex order"
                    value={useForm.notes}
                    onChange={e => setUseForm({ ...useForm, notes: e.target.value })} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <LoadingButton loading={useSaving} style={S.submitBtn} type="submit">Confirm Use</LoadingButton>
                    <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button"
                      onClick={() => { setShowUseModal(false); setUseForm({ id: null, quantity: '', notes: '' }) }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {flexStock.filter(f => f.quantity === 0).length > 0 && (
            <div style={{ ...S.warningBox, backgroundColor: '#fff0f0', borderColor: '#e74c3c', color: '#c0392b', display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: 0, marginBottom: '12px' }}>
              <Siren size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Out of Stock: {flexStock.filter(f => f.quantity === 0).map(f => `${f.brand} ${f.size_ft}ft`).join(', ')}</span>
            </div>
          )}
          {flexStock.filter(f => f.quantity === 1).length > 0 && (
            <div style={{ ...S.warningBox, display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: 0, marginBottom: '12px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Low Stock: {flexStock.filter(f => f.quantity === 1).map(f => `${f.brand} ${f.size_ft}ft (${f.quantity} left)`).join(', ')}</span>
            </div>
          )}

          {Object.keys(flexByBrand).length === 0
            ? <p style={{ color: '#888', padding: '20px' }}>No flex stock added yet.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Brand / Type</th>
                      {FLEX_SIZES.map(s => <th key={s} style={{ ...S.th, textAlign: 'center' }}>{s} ft</th>)}
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(flexByBrand).map(([brand, sizes]) => (
                      <tr key={brand} style={S.tr}>
                        <td style={{ ...S.td, fontWeight: 'bold' }}>{brand}</td>
                        {FLEX_SIZES.map(s => {
                          const item = sizes[s]
                          return (
                            <td key={s} style={{ ...S.td, textAlign: 'center' }}>
                              {item ? (
                                <div>
                                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: item.quantity === 0 ? '#e74c3c' : item.quantity === 1 ? '#f39c12' : '#27ae60' }}>
                                    {item.quantity}
                                  </span>
                                  <div style={{ fontSize: '10px', color: '#aaa' }}>rolls</div>
                                </div>
                              ) : <span style={{ color: '#ddd' }}>—</span>}
                            </td>
                          )
                        })}
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '180px' }}>
                            {Object.values(sizes).map(item => (
                              <div key={item.id} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                                <button style={{ ...S.useBtn, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  onClick={() => { setUseForm({ id: item.id, quantity: '', notes: '' }); setShowUseModal(true) }}>
                                  <Send size={10} /> {item.size_ft}ft
                                </button>
                                <button style={{ backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                  onClick={() => {
                                    if (item.quantity <= 0) return
                                    updateFlexStock(item.id, { ...item, quantity: item.quantity - 1 })
                                      .then(() => getFlexStock().then(r => setFlexStock(r.data)))
                                  }}>−1</button>
                                <button style={{ ...S.editBtn, display: 'inline-flex', alignItems: 'center' }} onClick={() => setEditFlex({ ...item })}><Pencil size={11} /></button>
                                <button style={{ ...S.delBtn, display: 'inline-flex', alignItems: 'center' }} onClick={() => {
                                  if (window.confirm('Delete?')) deleteFlexStock(item.id).then(() => getFlexStock().then(r => setFlexStock(r.data)))
                                }}><X size={11} /></button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STAMPS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stamps' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={S.addBtn} onClick={() => { setShowStampForm(!showStampForm); setEditStamp(null) }}>
              {showStampForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {showStampForm && !editStamp && (
            <div style={S.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Stamp</h3>
              <p style={S.formHint}>If this stamp type already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleStampRestock}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}><label style={S.label}>Stamp Type *</label><input style={S.input} placeholder="e.g. Pre-Inked, Self-Inking" value={stampForm.stamp_type} onChange={e => setStampForm({ ...stampForm, stamp_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Size</label><input style={S.input} placeholder="e.g. 38x14mm" value={stampForm.size} onChange={e => setStampForm({ ...stampForm, size: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Design Type</label><input style={S.input} placeholder="e.g. Round, Square" value={stampForm.design_type} onChange={e => setStampForm({ ...stampForm, design_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity to Add *</label><input style={S.input} type="number" placeholder="0" value={stampForm.quantity_to_add} onChange={e => setStampForm({ ...stampForm, quantity_to_add: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} placeholder="Optional" value={stampForm.notes} onChange={e => setStampForm({ ...stampForm, notes: e.target.value })} /></div>
                </div>
                <LoadingButton loading={stampSaving} style={S.submitBtn} type="submit">Save Stock</LoadingButton>
              </form>
            </div>
          )}

          {editStamp && (
            <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editStamp.stamp_type}</h3>
              <p style={S.formHint}>Use this only to correct details or fix quantity. For restocking, use Add / Restock.</p>
              <form onSubmit={handleStampEdit}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}><label style={S.label}>Stamp Type</label><input style={S.input} value={editStamp.stamp_type} onChange={e => setEditStamp({ ...editStamp, stamp_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Size</label><input style={S.input} value={editStamp.size || ''} onChange={e => setEditStamp({ ...editStamp, size: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Design Type</label><input style={S.input} value={editStamp.design_type || ''} onChange={e => setEditStamp({ ...editStamp, design_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity (actual)</label><input style={S.input} type="number" value={editStamp.quantity} onChange={e => setEditStamp({ ...editStamp, quantity: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} value={editStamp.notes || ''} onChange={e => setEditStamp({ ...editStamp, notes: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={S.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditStamp(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div style={S.tableScroll}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Stamp Type</th><th style={S.th}>Size</th><th style={S.th}>Design</th>
              <th style={S.th}>Quantity</th><th style={S.th}>Notes</th><th style={S.th}>Actions</th>
            </tr></thead>
            <tbody>
              {stamps.length === 0
                ? <tr><td colSpan="6" style={{ ...S.td, textAlign: 'center', color: '#888' }}>No stamps added yet.</td></tr>
                : stamps.map(s => (
                  <tr key={s.id} style={S.tr}>
                    <td style={{ ...S.td, fontWeight: 'bold' }}>{s.stamp_type}</td>
                    <td style={S.td}>{s.size || '—'}</td>
                    <td style={S.td}>{s.design_type || '—'}</td>
                    <td style={S.td}><span style={{ fontWeight: 'bold', color: s.quantity === 0 ? '#e74c3c' : '#27ae60', fontSize: '16px' }}>{s.quantity}</span></td>
                    <td style={{ ...S.td, fontSize: '12px', color: '#888' }}>{s.notes || '—'}</td>
                    <td style={S.td}>
                      <button style={S.reduceBtn} onClick={() => { if (s.quantity <= 0) return; updateStamp(s.id, { ...s, quantity: s.quantity - 1 }).then(() => getStamps().then(r => setStamps(r.data))) }}>−1</button>
                      <button style={{ ...S.editBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditStamp({ ...s }); setShowStampForm(false) }}><Pencil size={11} /></button>
                      <button style={{ ...S.delBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { if (window.confirm('Delete?')) deleteStamp(s.id).then(() => getStamps().then(r => setStamps(r.data))) }}><X size={11} /></button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CHEMICALS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'chemicals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={S.addBtn} onClick={() => { setShowChemForm(!showChemForm); setEditChem(null) }}>
              {showChemForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {showChemForm && !editChem && (
            <div style={S.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Chemical</h3>
              <p style={S.formHint}>If this chemical already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleChemRestock}>
                <div style={S.formRow}>
                  <div style={{ flex: 2 }}><label style={S.label}>Chemical Name *</label><input style={S.input} placeholder="e.g. Bond, Hardener" value={chemForm.chemical_name} onChange={e => setChemForm({ ...chemForm, chemical_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity to Add *</label><input style={S.input} type="number" placeholder="0" value={chemForm.quantity_to_add} onChange={e => setChemForm({ ...chemForm, quantity_to_add: e.target.value })} /></div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Unit</label>
                    <select style={S.input} value={chemForm.unit} onChange={e => setChemForm({ ...chemForm, unit: e.target.value, items_per_box: '' })}>
                      <option value="litre">Litre</option><option value="kg">KG</option><option value="bottle">Bottle</option>
                      <option value="tin">Tin</option><option value="pcs">Pcs</option><option value="box">Box</option>
                    </select>
                  </div>
                  {chemForm.unit === 'box' && (
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Items per Box *</label>
                      <input style={{ ...S.input, borderColor: '#e94560' }} type="number" placeholder="e.g. 25" value={chemForm.items_per_box} onChange={e => setChemForm({ ...chemForm, items_per_box: e.target.value })} />
                      {(chemForm.quantity_to_add && chemForm.items_per_box) && (
                        <div style={{ fontSize: '11px', color: '#27ae60', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={11} /> Total: {chemForm.quantity_to_add * chemForm.items_per_box} pcs</div>
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1 }}><label style={S.label}>Min Stock Alert</label><input style={S.input} type="number" placeholder="0" value={chemForm.minimum_stock} onChange={e => setChemForm({ ...chemForm, minimum_stock: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} placeholder="Optional" value={chemForm.notes} onChange={e => setChemForm({ ...chemForm, notes: e.target.value })} /></div>
                </div>
                <LoadingButton loading={chemSaving} style={S.submitBtn} type="submit">Save Stock</LoadingButton>
              </form>
            </div>
          )}

          {editChem && (
            <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editChem.chemical_name}</h3>
              <p style={S.formHint}>Use this only to correct details or fix quantity.</p>
              <form onSubmit={handleChemEdit}>
                <div style={S.formRow}>
                  <div style={{ flex: 2 }}><label style={S.label}>Chemical Name</label><input style={S.input} value={editChem.chemical_name} onChange={e => setEditChem({ ...editChem, chemical_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity (actual)</label><input style={S.input} type="number" value={editChem.quantity} onChange={e => setEditChem({ ...editChem, quantity: e.target.value })} /></div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Unit</label>
                    <select style={S.input} value={editChem.unit} onChange={e => setEditChem({ ...editChem, unit: e.target.value, items_per_box: '' })}>
                      <option value="litre">Litre</option><option value="kg">KG</option><option value="bottle">Bottle</option>
                      <option value="tin">Tin</option><option value="pcs">Pcs</option><option value="box">Box</option>
                    </select>
                  </div>
                  {editChem.unit === 'box' && (
                    <div style={{ flex: 1 }}><label style={S.label}>Items per Box</label><input style={S.input} type="number" value={editChem.items_per_box || ''} onChange={e => setEditChem({ ...editChem, items_per_box: e.target.value })} /></div>
                  )}
                  <div style={{ flex: 1 }}><label style={S.label}>Min Stock Alert</label><input style={S.input} type="number" value={editChem.minimum_stock} onChange={e => setEditChem({ ...editChem, minimum_stock: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={S.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditChem(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div style={S.tableScroll}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Chemical</th><th style={S.th}>Quantity</th><th style={S.th}>Unit</th>
              <th style={S.th}>Min Level</th><th style={S.th}>Status</th><th style={S.th}>Actions</th>
            </tr></thead>
            <tbody>
              {chemicals.length === 0
                ? <tr><td colSpan="6" style={{ ...S.td, textAlign: 'center', color: '#888' }}>No chemicals added yet.</td></tr>
                : chemicals.map(c => (
                  <tr key={c.id} style={S.tr}>
                    <td style={{ ...S.td, fontWeight: 'bold' }}>{c.chemical_name}</td>
                    <td style={{ ...S.td, fontWeight: 'bold', fontSize: '15px', color: c.quantity <= c.minimum_stock ? '#e74c3c' : '#27ae60' }}>{chemQtyDisplay(c)}</td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{c.unit === 'box' ? <><Box size={12} /> Box</> : c.unit}</span>
                      {c.unit === 'box' && c.items_per_box && <div style={{ fontSize: '11px', color: '#888' }}>{c.items_per_box} pcs/box</div>}
                    </td>
                    <td style={S.td}>{c.minimum_stock}</td>
                    <td style={S.td}>
                      {c.quantity === 0 ? <span style={{ ...S.badge, backgroundColor: '#e74c3c' }}>Out of Stock</span>
                        : c.quantity <= c.minimum_stock ? <span style={{ ...S.badge, backgroundColor: '#f39c12' }}>Low Stock</span>
                        : <span style={{ ...S.badge, backgroundColor: '#27ae60' }}>OK</span>}
                    </td>
                    <td style={S.td}>
                      <button style={S.reduceBtn} onClick={() => { if (c.quantity <= 0) return; updateChemical(c.id, { ...c, quantity: c.quantity - 1 }).then(() => getChemicals().then(r => setChemicals(r.data))) }}>−1</button>
                      <button style={{ ...S.editBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditChem({ ...c }); setShowChemForm(false) }}><Pencil size={11} /></button>
                      <button style={{ ...S.delBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { if (window.confirm('Delete?')) deleteChemical(c.id).then(() => getChemicals().then(r => setChemicals(r.data))) }}><X size={11} /></button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FRAMES TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'frames' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={S.addBtn} onClick={() => { setShowFrameForm(!showFrameForm); setEditFrame(null) }}>
              {showFrameForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {showFrameForm && !editFrame && (
            <div style={S.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Photo Frame</h3>
              <p style={S.formHint}>If this frame type + size + design already exists, quantity will be added.</p>
              <form onSubmit={handleFrameRestock}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}><label style={S.label}>Frame Type *</label><input style={S.input} placeholder="e.g. Wooden, Premium" value={frameForm.frame_type} onChange={e => setFrameForm({ ...frameForm, frame_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Size</label><input style={S.input} placeholder="e.g. 4x6, 5x7" value={frameForm.size} onChange={e => setFrameForm({ ...frameForm, size: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Design</label><input style={S.input} placeholder="e.g. Classic, Floral" value={frameForm.design} onChange={e => setFrameForm({ ...frameForm, design: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity to Add *</label><input style={S.input} type="number" placeholder="0" value={frameForm.quantity_to_add} onChange={e => setFrameForm({ ...frameForm, quantity_to_add: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} placeholder="Optional" value={frameForm.notes} onChange={e => setFrameForm({ ...frameForm, notes: e.target.value })} /></div>
                </div>
                <LoadingButton loading={frameSaving} style={S.submitBtn} type="submit">Save Stock</LoadingButton>
              </form>
            </div>
          )}

          {editFrame && (
            <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editFrame.frame_type}</h3>
              <p style={S.formHint}>Use this only to correct details or fix quantity.</p>
              <form onSubmit={handleFrameEdit}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}><label style={S.label}>Frame Type</label><input style={S.input} value={editFrame.frame_type} onChange={e => setEditFrame({ ...editFrame, frame_type: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Size</label><input style={S.input} value={editFrame.size || ''} onChange={e => setEditFrame({ ...editFrame, size: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Design</label><input style={S.input} value={editFrame.design || ''} onChange={e => setEditFrame({ ...editFrame, design: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity (actual)</label><input style={S.input} type="number" value={editFrame.quantity} onChange={e => setEditFrame({ ...editFrame, quantity: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} value={editFrame.notes || ''} onChange={e => setEditFrame({ ...editFrame, notes: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={S.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditFrame(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {frames.filter(f => f.quantity === 0).length > 0 && (
            <div style={{ ...S.warningBox, backgroundColor: '#fff0f0', borderColor: '#e74c3c', color: '#c0392b', display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: 0, marginBottom: '12px' }}>
              <Siren size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Out of Stock: {frames.filter(f => f.quantity === 0).map(f => `${f.frame_type} ${f.size ? f.size + ' ' : ''}${f.design || ''}`).join(', ')}</span>
            </div>
          )}
          {frames.filter(f => f.quantity < 5 && f.quantity > 0).length > 0 && (
            <div style={{ ...S.warningBox, display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: 0, marginBottom: '12px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Low Stock: {frames.filter(f => f.quantity < 5 && f.quantity > 0).map(f => `${f.frame_type} ${f.size ? f.size + ' ' : ''}${f.design || ''} (${f.quantity} left)`).join(', ')}</span>
            </div>
          )}

          <div style={S.tableScroll}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Frame Type</th><th style={S.th}>Size</th><th style={S.th}>Design</th>
              <th style={S.th}>Quantity</th><th style={S.th}>Actions</th>
            </tr></thead>
            <tbody>
              {frames.length === 0
                ? <tr><td colSpan="5" style={{ ...S.td, textAlign: 'center', color: '#888' }}>No frames added yet.</td></tr>
                : frames.map(f => (
                  <tr key={f.id} style={S.tr}>
                    <td style={{ ...S.td, fontWeight: 'bold' }}>{f.frame_type}</td>
                    <td style={S.td}>{f.size || '—'}</td>
                    <td style={S.td}>{f.design || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 'bold', fontSize: '16px', color: f.quantity === 0 ? '#e74c3c' : '#27ae60' }}>{f.quantity}</td>
                    <td style={S.td}>
                      <button style={S.reduceBtn} onClick={() => { if (f.quantity <= 0) return; updateFrame(f.id, { ...f, quantity: f.quantity - 1 }).then(() => getFrames().then(r => setFrames(r.data))) }}>−1</button>
                      <button style={{ ...S.editBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditFrame({ ...f }); setShowFrameForm(false) }}><Pencil size={11} /></button>
                      <button style={{ ...S.delBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { if (window.confirm('Delete?')) deleteFrame(f.id).then(() => getFrames().then(r => setFrames(r.data))) }}><X size={11} /></button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INK & SOLVENT TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ink' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button style={S.addBtn} onClick={() => { setShowInkForm(!showInkForm); setEditInk(null) }}>
              {showInkForm ? 'Cancel' : '+ Add / Restock'}
            </button>
          </div>

          {showInkForm && !editInk && (
            <div style={S.formBox}>
              <h3 style={{ marginBottom: '16px' }}>Add / Restock Ink & Solvent</h3>
              <p style={S.formHint}>If this item already exists, quantity will be added to existing stock.</p>
              <form onSubmit={handleInkRestock}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Type</label>
                    <select style={S.input} value={inkForm.item_type}
                      onChange={e => { const t = e.target.value; setInkForm({ ...inkForm, item_type: t, item_name: t === 'solvent' ? 'Cleaning Solvent' : '' }) }}>
                      <option value="ink">Ink</option>
                      <option value="solvent">Solvent</option>
                    </select>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={S.label}>Item Name *</label>
                    {inkForm.item_type === 'ink'
                      ? <select style={S.input} value={inkForm.item_name} onChange={e => setInkForm({ ...inkForm, item_name: e.target.value })}>
                          <option value="">Select Color</option>
                          {INK_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      : <input style={S.input} placeholder="e.g. Cleaning Solvent" value={inkForm.item_name} onChange={e => setInkForm({ ...inkForm, item_name: e.target.value })} />
                    }
                  </div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity to Add *</label><input style={S.input} type="number" step="0.1" placeholder="0" value={inkForm.quantity_to_add} onChange={e => setInkForm({ ...inkForm, quantity_to_add: e.target.value })} /></div>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Unit</label>
                    <select style={S.input} value={inkForm.unit} onChange={e => setInkForm({ ...inkForm, unit: e.target.value })}>
                      <option value="litre">Litre</option><option value="ml">ML</option><option value="bottle">Bottle</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}><label style={S.label}>Min Level Alert</label><input style={S.input} type="number" step="0.1" placeholder="0" value={inkForm.minimum_level} onChange={e => setInkForm({ ...inkForm, minimum_level: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Notes</label><input style={S.input} placeholder="Optional" value={inkForm.notes} onChange={e => setInkForm({ ...inkForm, notes: e.target.value })} /></div>
                </div>
                <LoadingButton loading={inkSaving} style={S.submitBtn} type="submit">Save Stock</LoadingButton>
              </form>
            </div>
          )}

          {editInk && (
            <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
              <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editInk.item_name}</h3>
              <p style={S.formHint}>Use this only to correct details or fix quantity.</p>
              <form onSubmit={handleInkEdit}>
                <div style={S.formRow}>
                  <div style={{ flex: 1 }}><label style={S.label}>Type</label><select style={S.input} value={editInk.item_type} onChange={e => setEditInk({ ...editInk, item_type: e.target.value })}><option value="ink">Ink</option><option value="solvent">Solvent</option></select></div>
                  <div style={{ flex: 2 }}><label style={S.label}>Item Name</label><input style={S.input} value={editInk.item_name} onChange={e => setEditInk({ ...editInk, item_name: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Quantity (actual)</label><input style={S.input} type="number" step="0.1" value={editInk.quantity} onChange={e => setEditInk({ ...editInk, quantity: e.target.value })} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Unit</label><select style={S.input} value={editInk.unit} onChange={e => setEditInk({ ...editInk, unit: e.target.value })}><option value="litre">Litre</option><option value="ml">ML</option><option value="bottle">Bottle</option></select></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Min Level Alert</label><input style={S.input} type="number" step="0.1" value={editInk.minimum_level} onChange={e => setEditInk({ ...editInk, minimum_level: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={S.submitBtn} type="submit">Save Changes</button>
                  <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditInk(null)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {inkItems.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '12px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}><Palette size={17} /> Ink Colors</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {inkItems.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: '140px', textAlign: 'center', borderTop: `4px solid ${INK_COLOR_MAP[item.item_name] || '#3498db'}` }}>
                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: item.quantity <= item.minimum_level ? '#e74c3c' : '#1a1a2e' }}>{item.quantity}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{item.unit}</div>
                    <div style={{ fontWeight: 'bold', marginTop: '6px', fontSize: '13px' }}>{item.item_name}</div>
                    {item.quantity <= item.minimum_level && <div style={{ fontSize: '10px', color: '#e74c3c', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}><AlertTriangle size={10} /> Low</div>}
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '10px' }}>
                      <button style={S.reduceBtn} onClick={() => { if (item.quantity <= 0) return; updateInkStock(item.id, { ...item, quantity: item.quantity - 1 }).then(() => getInkStock().then(r => setInkStock(r.data))) }}>−1</button>
                      <button style={{ ...S.editBtn, display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditInk({ ...item }); setShowInkForm(false) }}><Pencil size={11} /></button>
                      <button style={{ ...S.delBtn, display: 'inline-flex', alignItems: 'center' }} onClick={() => { if (window.confirm('Delete?')) deleteInkStock(item.id).then(() => getInkStock().then(r => setInkStock(r.data))) }}><X size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {solventItems.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '12px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}><Droplet size={17} /> Solvent</h3>
              <div style={S.tableScroll}>
              <table style={S.table}>
                <thead><tr><th style={S.th}>Item</th><th style={S.th}>Quantity</th><th style={S.th}>Unit</th><th style={S.th}>Min Level</th><th style={S.th}>Status</th><th style={S.th}>Actions</th></tr></thead>
                <tbody>
                  {solventItems.map(item => (
                    <tr key={item.id} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 'bold' }}>{item.item_name}</td>
                      <td style={{ ...S.td, fontWeight: 'bold', color: item.quantity <= item.minimum_level ? '#e74c3c' : '#27ae60' }}>{item.quantity}</td>
                      <td style={S.td}>{item.unit}</td>
                      <td style={S.td}>{item.minimum_level}</td>
                      <td style={S.td}><span style={{ ...S.badge, backgroundColor: item.quantity <= item.minimum_level ? '#e74c3c' : '#27ae60' }}>{item.quantity <= item.minimum_level ? 'Low' : 'OK'}</span></td>
                      <td style={S.td}>
                        <button style={S.reduceBtn} onClick={() => { if (item.quantity <= 0) return; updateInkStock(item.id, { ...item, quantity: item.quantity - 1 }).then(() => getInkStock().then(r => setInkStock(r.data))) }}>−1</button>
                        <button style={{ ...S.editBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditInk({ ...item }); setShowInkForm(false) }}><Pencil size={11} /></button>
                        <button style={{ ...S.delBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { if (window.confirm('Delete?')) deleteInkStock(item.id).then(() => getInkStock().then(r => setInkStock(r.data))) }}><X size={11} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {inkStock.length === 0 && <p style={{ color: '#888', padding: '20px' }}>No ink or solvent added yet.</p>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DYNAMIC CATEGORY TABS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab.startsWith('dyn-') && (() => {
        const cat = categories.find(c => `dyn-${c.id}` === activeTab)
        if (!cat) return null
        return (
          <DynamicCategoryTab
            key={cat.id}
            category={cat}
            showMsg={showMsg}
            onDeleted={() => handleDeleteCategory(cat.id)}
          />
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          NEW CATEGORY MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showCategoryModal && (
        <div style={S.modal}>
          <div style={{ ...S.modalBox, maxWidth: '460px' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><FolderPlus size={18} /> New Inventory Category</h3>
            <p style={{ ...S.formHint, marginBottom: '16px' }}>
              Ek naya tab banao — jaise Vinyl, Paper, Lamination, etc. Baad mein isme items add kar sakte ho, bina code edit kiye.
            </p>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '12px' }}>
                <label style={S.label}>Category Name *</label>
                <input style={S.input} placeholder="e.g. Vinyl Rolls, Paper, Lamination Sheets"
                  value={categoryForm.label}
                  onChange={e => setCategoryForm({ ...categoryForm, label: e.target.value })} />
              </div>
              <div style={S.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Icon (emoji)</label>
                  <input style={S.input} placeholder="📦"
                    value={categoryForm.icon}
                    onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Default Unit</label>
                  <select style={S.input} value={categoryForm.unit_default}
                    onChange={e => setCategoryForm({ ...categoryForm, unit_default: e.target.value })}>
                    <option value="pcs">Pcs</option><option value="roll">Roll</option>
                    <option value="litre">Litre</option><option value="kg">KG</option>
                    <option value="box">Box</option><option value="bottle">Bottle</option>
                    <option value="sheet">Sheet</option>
                  </select>
                </div>
              </div>
              <div style={S.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Attribute 1 label (optional)</label>
                  <input style={S.input} placeholder="e.g. Size"
                    value={categoryForm.attr1_label}
                    onChange={e => setCategoryForm({ ...categoryForm, attr1_label: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Attribute 2 label (optional)</label>
                  <input style={S.input} placeholder="e.g. Type"
                    value={categoryForm.attr2_label}
                    onChange={e => setCategoryForm({ ...categoryForm, attr2_label: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button style={S.submitBtn} type="submit" disabled={categorySaving}>
                  {categorySaving ? 'Creating…' : 'Create Category'}
                </button>
                <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button"
                  onClick={() => setShowCategoryModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DynamicCategoryTab — fully generic, works for any user-created category
// ─────────────────────────────────────────────────────────────────────────────
function DynamicCategoryTab({ category, showMsg, onDeleted }) {
  const [items, setItems]       = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const blankForm = { item_name: '', attr1: '', attr2: '', quantity_to_add: '', unit: category.unit_default || 'pcs', minimum_stock: '', notes: '' }
  const [form, setForm]         = useState(blankForm)

  const fetchItems = useCallback(() => {
    getDynamicItems(category.id).then(r => setItems(r.data)).catch(() => {})
  }, [category.id])
  useEffect(() => { fetchItems() }, [fetchItems])

  function handleRestock(e) {
    e.preventDefault()
    if (!form.item_name || !form.quantity_to_add) return showMsg('Name and quantity required', 'error')
    const qty = parseFloat(form.quantity_to_add)
    if (isNaN(qty) || qty <= 0) return showMsg('Enter a valid quantity', 'error')
    addDynamicItem(category.id, form)
      .then(() => { showMsg(`✅ ${form.item_name} stock updated`); setForm(blankForm); setShowForm(false); fetchItems() })
      .catch(() => showMsg('Error saving item', 'error'))
  }

  function handleEdit(e) {
    e.preventDefault()
    updateDynamicItem(category.id, editItem.id, editItem)
      .then(() => { showMsg('Updated'); setEditItem(null); fetchItems() })
      .catch(() => showMsg('Error', 'error'))
  }

  function handleDeleteItem(id) {
    if (!window.confirm('Delete this item?')) return
    deleteDynamicItem(category.id, id).then(fetchItems).catch(() => showMsg('Error deleting', 'error'))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <button
          onClick={() => { if (window.confirm(`Delete category "${category.label}"? Iske saare items bhi delete ho jayenge.`)) onDeleted() }}
          style={{ background: '#800000', border: '1px solid #800000', color: '#fff', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <Trash2 size={12} /> Delete this Category
        </button>
        <button style={S.addBtn} onClick={() => { setShowForm(!showForm); setEditItem(null) }}>
          {showForm ? 'Cancel' : '+ Add / Restock'}
        </button>
      </div>

      {showForm && !editItem && (
        <div style={S.formBox}>
          <h3 style={{ marginBottom: '16px' }}>Add / Restock — {category.label}</h3>
          <p style={S.formHint}>If this item already exists, quantity will be added to existing stock.</p>
          <form onSubmit={handleRestock}>
            <div style={S.formRow}>
              <div style={{ flex: 2 }}>
                <label style={S.label}>Item Name *</label>
                <input style={S.input} placeholder={`e.g. ${category.label} item`}
                  value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
              </div>
              {category.attr1_label && (
                <div style={{ flex: 1 }}>
                  <label style={S.label}>{category.attr1_label}</label>
                  <input style={S.input} placeholder={category.attr1_label}
                    value={form.attr1} onChange={e => setForm({ ...form, attr1: e.target.value })} />
                </div>
              )}
              {category.attr2_label && (
                <div style={{ flex: 1 }}>
                  <label style={S.label}>{category.attr2_label}</label>
                  <input style={S.input} placeholder={category.attr2_label}
                    value={form.attr2} onChange={e => setForm({ ...form, attr2: e.target.value })} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label style={S.label}>Quantity to Add *</label>
                <input style={S.input} type="number" placeholder="0"
                  value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Unit</label>
                <select style={S.input} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  <option value="pcs">Pcs</option><option value="roll">Roll</option><option value="litre">Litre</option>
                  <option value="kg">KG</option><option value="box">Box</option><option value="bottle">Bottle</option><option value="sheet">Sheet</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Min Stock Alert</label>
                <input style={S.input} type="number" placeholder="0"
                  value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Notes</label>
                <input style={S.input} placeholder="Optional"
                  value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <button style={S.submitBtn} type="submit">Save Stock</button>
          </form>
        </div>
      )}

      {editItem && (
        <div style={{ ...S.formBox, borderLeft: '4px solid #f39c12' }}>
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={16} /> Edit: {editItem.item_name}</h3>
          <p style={S.formHint}>Use this only to correct details or fix quantity. For restocking, use Add / Restock.</p>
          <form onSubmit={handleEdit}>
            <div style={S.formRow}>
              <div style={{ flex: 2 }}>
                <label style={S.label}>Item Name</label>
                <input style={S.input} value={editItem.item_name} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} />
              </div>
              {category.attr1_label && (
                <div style={{ flex: 1 }}>
                  <label style={S.label}>{category.attr1_label}</label>
                  <input style={S.input} value={editItem.attr1 || ''} onChange={e => setEditItem({ ...editItem, attr1: e.target.value })} />
                </div>
              )}
              {category.attr2_label && (
                <div style={{ flex: 1 }}>
                  <label style={S.label}>{category.attr2_label}</label>
                  <input style={S.input} value={editItem.attr2 || ''} onChange={e => setEditItem({ ...editItem, attr2: e.target.value })} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label style={S.label}>Quantity (actual)</label>
                <input style={S.input} type="number" value={editItem.quantity} onChange={e => setEditItem({ ...editItem, quantity: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Min Stock Alert</label>
                <input style={S.input} type="number" value={editItem.minimum_stock} onChange={e => setEditItem({ ...editItem, minimum_stock: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={S.submitBtn} type="submit">Save Changes</button>
              <button style={{ ...S.submitBtn, backgroundColor: '#888' }} type="button" onClick={() => setEditItem(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={S.tableScroll}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Item</th>
            {category.attr1_label && <th style={S.th}>{category.attr1_label}</th>}
            {category.attr2_label && <th style={S.th}>{category.attr2_label}</th>}
            <th style={S.th}>Quantity</th>
            <th style={S.th}>Status</th>
            <th style={S.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0
            ? <tr><td colSpan="6" style={{ ...S.td, textAlign: 'center', color: '#888' }}>No items added yet. Click "+ Add / Restock" to begin.</td></tr>
            : items.map(it => (
              <tr key={it.id} style={S.tr}>
                <td style={{ ...S.td, fontWeight: 'bold' }}>{it.item_name}</td>
                {category.attr1_label && <td style={S.td}>{it.attr1 || '—'}</td>}
                {category.attr2_label && <td style={S.td}>{it.attr2 || '—'}</td>}
                <td style={{ ...S.td, fontWeight: 'bold', fontSize: '15px', color: it.quantity <= it.minimum_stock ? '#e74c3c' : '#27ae60' }}>
                  {it.quantity} {it.unit}
                </td>
                <td style={S.td}>
                  {it.quantity === 0
                    ? <span style={{ ...S.badge, backgroundColor: '#e74c3c' }}>Out of Stock</span>
                    : it.quantity <= it.minimum_stock
                      ? <span style={{ ...S.badge, backgroundColor: '#f39c12' }}>Low Stock</span>
                      : <span style={{ ...S.badge, backgroundColor: '#27ae60' }}>OK</span>
                  }
                </td>
                <td style={S.td}>
                  <button style={S.reduceBtn}
                    onClick={() => { if (it.quantity <= 0) return; updateDynamicItem(category.id, it.id, { ...it, quantity: it.quantity - 1 }).then(fetchItems) }}>−1</button>
                  <button style={{ ...S.editBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => { setEditItem({ ...it }); setShowForm(false) }}><Pencil size={11} /></button>
                  <button style={{ ...S.delBtn, marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }} onClick={() => handleDeleteItem(it.id)}><X size={11} /></button>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  msg:       { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', cursor: 'pointer' },
  msgErr:    { backgroundColor: '#fff3f3', color: '#c0392b' },
  tabRow:    { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab:       { padding: '10px 18px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' },
  activeTab: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
  addBtn:    { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  formBox:   { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formHint:  { fontSize: '12px', color: '#27ae60', backgroundColor: '#f0faf0', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', border: '1px solid #c8e6c9' },
  formRow:   { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  input:     { width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' },
  label:     { fontSize: '12px', color: '#888', display: 'block', marginBottom: '4px' },
  submitBtn: { backgroundColor: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table:     { width: '100%', minWidth: '600px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  th:        { padding: '10px 14px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td:        { padding: '10px 14px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr:        { backgroundColor: '#fff' },
  badge:     { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '11px' },
  useBtn:    { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  reduceBtn: { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  editBtn:   { backgroundColor: '#fff', color: '#1a1a2e', border: '1px solid #1a1a2e', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  delBtn:    { backgroundColor: '#800000', color: '#fff', border: '1px solid #800000', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
  warningBox:{ backgroundColor: '#fff9e6', border: '1px solid #f39c12', color: '#856404', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' },
  modal:     { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalBox:  { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', minWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
}

export default Inventory
