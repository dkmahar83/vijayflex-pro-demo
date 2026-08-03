import { useState, useEffect } from 'react'
import {
  getFlexStock, useFlexStock as consumeFlexStock, updateFlexStock, deleteFlexStock,
  getStamps, updateStamp, deleteStamp,
  getChemicals, updateChemical, deleteChemical,
  getFrames, updateFrame, deleteFrame,
  getInkStock, updateInkStock, deleteInkStock,
  getInventoryCategories, deleteInventoryCategory,
  getDynamicItems, updateDynamicItem, deleteDynamicItem,
} from '../services/api'
import PageHeader from '../components/ui/PageHeader'
import { PrimaryButton, SecondaryButton } from '../components/ui/Button'
import {
  LayoutGrid, Image, Stamp, FlaskConical, Printer, Plus, History, FolderPlus, Trash2, Palette, Droplet,
} from 'lucide-react'

import { groupFlex, groupStamps, groupChemicals, groupFrames, groupInk, groupDynamic } from '../components/inventory/inventoryAdapter'
import InventoryItemCard from '../components/inventory/InventoryItemCard'
import VariantModal from '../components/inventory/VariantModal'
import AddStockModal from '../components/inventory/AddStockModal'
import BatchEditModal from '../components/inventory/BatchEditModal'
import NewCategoryModal from '../components/inventory/NewCategoryModal'
import LogHistoryModal from '../components/inventory/LogHistoryModal'

const FIXED_TABS = [
  { key: 'flex', label: 'Flex Rolls', icon: Image },
  { key: 'stamps', label: 'Stamps', icon: Stamp },
  { key: 'chemicals', label: 'Chemicals', icon: FlaskConical },
  { key: 'frames', label: 'Photo Frames', icon: Image },
  { key: 'ink', label: 'Ink & Solvent', icon: Printer },
]
const CATEGORY_ICON = { flex: Image, stamps: Stamp, chemicals: FlaskConical, frames: Image, ink: Printer }

function iconForCard(card) {
  if (card.categoryKind === 'ink') return card.title === 'Solvent' ? Droplet : Palette
  return CATEGORY_ICON[card.categoryKind] // undefined for dynamic categories -> card falls back to its emoji
}

function Inventory() {
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [activeTab, setActiveTab] = useState('all')

  const [flexStock, setFlexStock] = useState([])
  const [stamps, setStamps] = useState([])
  const [chemicals, setChemicals] = useState([])
  const [frames, setFrames] = useState([])
  const [inkStock, setInkStock] = useState([])
  const [categories, setCategories] = useState([])
  const [dynamicItems, setDynamicItems] = useState({}) // { [categoryId]: items[] }

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalPreset, setAddModalPreset] = useState({ categoryKind: null, title: null })
  const [variantModal, setVariantModal] = useState({ open: false, variant: null, card: null, categoryKind: null })
  const [actionSaving, setActionSaving] = useState(false)
  const [batchEditCard, setBatchEditCard] = useState(null)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [showLogHistory, setShowLogHistory] = useState(false)

  // ── fetch helpers ──────────────────────────────────────────────────────────
  function fetchAll() {
    getFlexStock().then(r => setFlexStock(r.data)).catch(() => {})
    getStamps().then(r => setStamps(r.data)).catch(() => {})
    getChemicals().then(r => setChemicals(r.data)).catch(() => {})
    getFrames().then(r => setFrames(r.data)).catch(() => {})
    getInkStock().then(r => setInkStock(r.data)).catch(() => {})
  }
  function fetchCategories() {
    getInventoryCategories().then(r => {
      setCategories(r.data)
      r.data.forEach(cat => {
        getDynamicItems(cat.id).then(res => setDynamicItems(prev => ({ ...prev, [cat.id]: res.data }))).catch(() => {})
      })
    }).catch(() => {})
  }
  useEffect(() => { fetchAll(); fetchCategories() }, [])
  // showMsg() already auto-clears after 3.5s — this just clears it immediately
  // on tab change too, so a message from one category doesn't linger into another.
  useEffect(() => { queueMicrotask(() => setMessage('')) }, [activeTab])

  function showMsg(text, type = 'success') {
    setMessage(text); setMsgType(type)
    setTimeout(() => setMessage(''), 3500)
  }

  function refetchForKind(kind) {
    if (kind === 'flex') return getFlexStock().then(r => setFlexStock(r.data))
    if (kind === 'stamps') return getStamps().then(r => setStamps(r.data))
    if (kind === 'chemicals') return getChemicals().then(r => setChemicals(r.data))
    if (kind === 'frames') return getFrames().then(r => setFrames(r.data))
    if (kind === 'ink') return getInkStock().then(r => setInkStock(r.data))
    if (kind && kind.startsWith('dyn-')) {
      const catId = kind.replace('dyn-', '')
      return getDynamicItems(catId).then(r => setDynamicItems(prev => ({ ...prev, [catId]: r.data })))
    }
    return Promise.resolve()
  }
  function updateForKind(kind, raw, patch) {
    if (kind === 'flex') return updateFlexStock(raw.id, { ...raw, ...patch })
    if (kind === 'stamps') return updateStamp(raw.id, { ...raw, ...patch })
    if (kind === 'chemicals') return updateChemical(raw.id, { ...raw, ...patch })
    if (kind === 'frames') return updateFrame(raw.id, { ...raw, ...patch })
    if (kind === 'ink') return updateInkStock(raw.id, { ...raw, ...patch })
    if (kind.startsWith('dyn-')) return updateDynamicItem(kind.replace('dyn-', ''), raw.id, { ...raw, ...patch })
    return Promise.reject(new Error('Unknown category'))
  }
  function deleteForKind(kind, raw) {
    if (kind === 'flex') return deleteFlexStock(raw.id)
    if (kind === 'stamps') return deleteStamp(raw.id)
    if (kind === 'chemicals') return deleteChemical(raw.id)
    if (kind === 'frames') return deleteFrame(raw.id)
    if (kind === 'ink') return deleteInkStock(raw.id)
    if (kind.startsWith('dyn-')) return deleteDynamicItem(kind.replace('dyn-', ''), raw.id)
    return Promise.reject(new Error('Unknown category'))
  }

  // ── derived: cards ─────────────────────────────────────────────────────────
  const allCards = [
    ...groupFlex(flexStock),
    ...groupStamps(stamps),
    ...groupChemicals(chemicals),
    ...groupFrames(frames),
    ...groupInk(inkStock),
    ...categories.flatMap(cat => groupDynamic(cat, dynamicItems[cat.id] || [])),
  ]
  const visibleCards = activeTab === 'all' ? allCards : allCards.filter(c => c.categoryKind === activeTab)

  // Exact same formula as the original page — dynamic categories were never
  // part of this count before, so they still aren't (this is a display
  // total, not a business rule I should be changing).
  const lowStockCount =
    flexStock.filter(f => f.quantity <= 1).length +
    stamps.filter(s => s.quantity === 0).length +
    chemicals.filter(c => c.quantity <= c.minimum_stock).length +
    frames.filter(f => f.quantity < 5).length +
    inkStock.filter(i => i.quantity <= i.minimum_level).length

  // ── Add Stock modal ────────────────────────────────────────────────────────
  function openAddModal(categoryKind = null, title = null) {
    setAddModalPreset({ categoryKind, title })
    setAddModalOpen(true)
  }
  function handleAddDone() {
    setAddModalOpen(false)
    if (addModalPreset.categoryKind) {
      refetchForKind(addModalPreset.categoryKind)
    } else {
      fetchAll()
      fetchCategories()
    }
  }

  // ── Variant modal (use / edit / delete) ───────────────────────────────────
  function openVariantModal(variant, card) {
    setVariantModal({ open: true, variant, card, categoryKind: card.categoryKind })
  }
  function closeVariantModal() {
    setVariantModal({ open: false, variant: null, card: null, categoryKind: null })
  }
  function handleUse(variant, amount, notes) {
    const kind = variantModal.categoryKind
    setActionSaving(true)
    if (kind === 'flex') {
      consumeFlexStock(variant.id, { quantity: amount, notes })
        .then(() => { showMsg('Stock reduced'); closeVariantModal(); refetchForKind(kind) })
        .catch(err => showMsg(err.response?.data?.error || 'Error', 'error'))
        .finally(() => setActionSaving(false))
      return
    }
    if (amount > variant.quantity) {
      setActionSaving(false)
      showMsg('Insufficient stock', 'error')
      return
    }
    updateForKind(kind, variant.raw, { quantity: variant.quantity - amount, notes: notes || variant.raw.notes })
      .then(() => { showMsg('Stock reduced'); closeVariantModal(); refetchForKind(kind) })
      .catch(() => showMsg('Error', 'error'))
      .finally(() => setActionSaving(false))
  }
  function handleSaveEdit(variant, form) {
    const kind = variantModal.categoryKind
    setActionSaving(true)
    updateForKind(kind, form, {})
      .then(() => { showMsg('Updated'); closeVariantModal(); refetchForKind(kind) })
      .catch(() => showMsg('Error', 'error'))
      .finally(() => setActionSaving(false))
  }
  function handleDeleteVariant(variant) {
    if (!window.confirm('Delete this item?')) return
    const kind = variantModal.categoryKind
    deleteForKind(kind, variant.raw)
      .then(() => { showMsg('Deleted'); closeVariantModal(); refetchForKind(kind) })
      .catch(() => showMsg('Error deleting', 'error'))
  }

  // ── Batch edit ─────────────────────────────────────────────────────────────
  function handleBatchDone() {
    if (batchEditCard) refetchForKind(batchEditCard.categoryKind)
    setBatchEditCard(null)
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  function handleCategoryCreated(newId) {
    setShowNewCategoryModal(false)
    fetchCategories()
    setActiveTab(`dyn-${newId}`)
  }
  function handleDeleteCategory(catId) {
    const cat = categories.find(c => c.id === catId)
    if (!window.confirm(`Delete category "${cat?.label || ''}"? All of its items will be deleted too.`)) return
    deleteInventoryCategory(catId).then(() => {
      showMsg('Category deleted')
      setActiveTab('all')
      setDynamicItems(prev => { const next = { ...prev }; delete next[catId]; return next })
      fetchCategories()
    }).catch(() => showMsg('Error deleting category', 'error'))
  }

  const activeDynamicCategory = variantModal.categoryKind?.startsWith('dyn-')
    ? categories.find(c => `dyn-${c.id}` === variantModal.categoryKind)
    : null

  function tabClass(active) {
    return `inline-flex items-center gap-1.5 pb-3 px-1 border-b-2 text-sm font-semibold whitespace-nowrap transition-all ${
      active ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
    }`
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Media Stock"
        badge={lowStockCount > 0 ? `${lowStockCount} Items Low` : null}
        subtitle="Track flex rolls, chemicals, frames, stamps, and print media supplies with real-time consumption analytics."
        actions={
          <>
            <SecondaryButton icon={History} onClick={() => setShowLogHistory(true)}>Log History</SecondaryButton>
            <PrimaryButton icon={Plus} onClick={() => openAddModal()}>Add Stock</PrimaryButton>
          </>
        }
      />

      {message && (
        <p
          onClick={() => setMessage('')}
          className={`px-4 py-3 rounded-xl cursor-pointer text-sm ${
            msgType === 'error'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}
        >
          {message}
        </p>
      )}

      {/* CATEGORY TABS */}
      <div className="flex items-center gap-5 flex-wrap border-b border-slate-800">
        <button onClick={() => setActiveTab('all')} className={tabClass(activeTab === 'all')}>
          <LayoutGrid className="w-4 h-4" /> All Categories
        </button>
        {FIXED_TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={tabClass(activeTab === t.key)}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
        {categories.map(cat => {
          const key = `dyn-${cat.id}`
          const active = activeTab === key
          return (
            <button key={key} onClick={() => setActiveTab(key)} className={tabClass(active)}>
              {cat.icon && <span>{cat.icon}</span>} {cat.label}
              {active && (
                <Trash2
                  className="w-3.5 h-3.5 text-slate-500 hover:text-red-400"
                  onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                />
              )}
            </button>
          )
        })}
        <button
          onClick={() => setShowNewCategoryModal(true)}
          className="ml-auto inline-flex items-center gap-1.5 pb-3 px-1 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-all"
        >
          <FolderPlus className="w-4 h-4" /> New Category
        </button>
      </div>

      {/* CARD GRID */}
      {visibleCards.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">No stock in this category yet. Click "Add Stock" to begin.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleCards.map(card => (
            <InventoryItemCard
              key={card.groupKey}
              card={card}
              icon={iconForCard(card)}
              onVariantClick={openVariantModal}
              onAddVariant={c => openAddModal(c.categoryKind, c.title)}
              onBatchEdit={c => setBatchEditCard(c)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      <AddStockModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        presetCategoryKind={addModalPreset.categoryKind}
        presetTitle={addModalPreset.title}
        categories={categories}
        flexStock={flexStock}
        stamps={stamps}
        chemicals={chemicals}
        frames={frames}
        inkStock={inkStock}
        onDone={handleAddDone}
        showMsg={showMsg}
      />

      <VariantModal
        open={variantModal.open}
        onClose={closeVariantModal}
        variant={variantModal.variant}
        card={variantModal.card}
        categoryKind={variantModal.categoryKind}
        dynamicCategory={activeDynamicCategory}
        onUse={handleUse}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDeleteVariant}
        saving={actionSaving}
      />

      <BatchEditModal
        open={!!batchEditCard}
        onClose={() => setBatchEditCard(null)}
        card={batchEditCard}
        categoryKind={batchEditCard?.categoryKind}
        onDone={handleBatchDone}
        showMsg={showMsg}
      />

      <NewCategoryModal
        open={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        onCreated={handleCategoryCreated}
        showMsg={showMsg}
      />

      <LogHistoryModal open={showLogHistory} onClose={() => setShowLogHistory(false)} />
    </div>
  )
}

export default Inventory
