import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { SecondaryButton } from '../ui/Button'
import LoadingButton from '../../components/LoadingButton'
import { CheckCircle2 } from 'lucide-react'
import {
  addFlexStock,
  addStamp, updateStamp,
  addChemical, updateChemical,
  addFrame, updateFrame,
  addInkStock, updateInkStock,
  addDynamicItem,
} from '../../services/api'
import { FLEX_BRANDS, FLEX_SIZES, INK_COLORS } from './inventoryAdapter'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

const FIXED_CATEGORIES = [
  { key: 'flex', label: 'Flex Rolls' },
  { key: 'stamps', label: 'Stamps' },
  { key: 'chemicals', label: 'Chemicals' },
  { key: 'frames', label: 'Photo Frames' },
  { key: 'ink', label: 'Ink & Solvent' },
]

const blankByKind = {
  flex: { brand: '', size_ft: '', quantity: '', notes: '' },
  stamps: { stamp_type: '', size: '', design_type: '', quantity_to_add: '', notes: '' },
  chemicals: { chemical_name: '', quantity_to_add: '', unit: 'litre', items_per_box: '', minimum_stock: '', notes: '' },
  frames: { frame_type: '', size: '', design: '', quantity_to_add: '', notes: '' },
  ink: { item_name: '', item_type: 'ink', quantity_to_add: '', unit: 'litre', minimum_level: '', notes: '' },
}

export default function AddStockModal({
  open, onClose, presetCategoryKind, presetTitle,
  categories, flexStock, stamps, chemicals, frames, inkStock,
  onDone, showMsg,
}) {
  const [categoryKind, setCategoryKind] = useState(presetCategoryKind || 'flex')
  const [form, setForm] = useState(blankByKind[presetCategoryKind] ? { ...blankByKind[presetCategoryKind] } : { ...blankByKind.flex })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const kind = presetCategoryKind || 'flex'
    setCategoryKind(kind)
    const base = blankByKind[kind] ? { ...blankByKind[kind] } : { item_name: '', attr1: '', attr2: '', quantity_to_add: '', unit: 'pcs', minimum_stock: '', notes: '' }
    if (presetTitle) {
      if (kind === 'flex') base.brand = presetTitle
      else if (kind === 'stamps') base.stamp_type = presetTitle
      else if (kind === 'chemicals') base.chemical_name = presetTitle
      else if (kind === 'frames') base.frame_type = presetTitle
      else if (kind === 'ink') base.item_name = presetTitle
      else base.item_name = presetTitle
    }
    setForm(base)
  }, [open, presetCategoryKind, presetTitle])

  if (!open) return null

  const dynamicCategory = categoryKind.startsWith('dyn-')
    ? categories.find(c => `dyn-${c.id}` === categoryKind)
    : null

  function switchCategory(kind) {
    setCategoryKind(kind)
    if (blankByKind[kind]) {
      setForm({ ...blankByKind[kind] })
    } else {
      const cat = categories.find(c => `dyn-${c.id}` === kind)
      setForm({ item_name: '', attr1: '', attr2: '', quantity_to_add: '', unit: cat?.unit_default || 'pcs', minimum_stock: '', notes: '' })
    }
  }

  function finish(msg) {
    showMsg(msg)
    setSaving(false)
    onDone()
  }
  function fail(err, fallback) {
    showMsg(err?.response?.data?.error || fallback, 'error')
    setSaving(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    if (categoryKind === 'flex') {
      const { brand, size_ft, quantity } = form
      if (!brand || !size_ft || !quantity) { setSaving(false); return showMsg('All fields required', 'error') }
      addFlexStock(form).then(() => finish('Flex stock added/updated')).catch(err => fail(err, 'Error adding flex stock'))
      return
    }

    if (categoryKind === 'stamps') {
      const { stamp_type, size, design_type, quantity_to_add, notes } = form
      if (!stamp_type || !quantity_to_add) { setSaving(false); return showMsg('Stamp type and quantity required', 'error') }
      const qty = parseFloat(quantity_to_add)
      if (isNaN(qty) || qty <= 0) { setSaving(false); return showMsg('Enter a valid quantity', 'error') }
      const existing = stamps.find(s =>
        s.stamp_type.trim().toLowerCase() === stamp_type.trim().toLowerCase() &&
        (s.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
        (s.design_type || '').trim().toLowerCase() === (design_type || '').trim().toLowerCase()
      )
      if (existing) {
        updateStamp(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
          .then(() => finish(`${stamp_type} updated: ${existing.quantity} → ${existing.quantity + qty}`))
          .catch(err => fail(err, 'Error updating stamp'))
      } else {
        addStamp({ stamp_type, size, design_type, quantity: qty, notes })
          .then(() => finish(`New stamp added: ${stamp_type}`))
          .catch(err => fail(err, 'Error adding stamp'))
      }
      return
    }

    if (categoryKind === 'chemicals') {
      const { chemical_name, quantity_to_add, unit, items_per_box, minimum_stock, notes } = form
      if (!chemical_name || !quantity_to_add) { setSaving(false); return showMsg('Chemical name and quantity required', 'error') }
      const qty = parseFloat(quantity_to_add)
      if (isNaN(qty) || qty <= 0) { setSaving(false); return showMsg('Enter a valid quantity', 'error') }
      const existing = chemicals.find(c => c.chemical_name.trim().toLowerCase() === chemical_name.trim().toLowerCase())
      if (existing) {
        const payload = {
          ...existing,
          quantity: existing.quantity + qty,
          notes: notes || existing.notes,
          minimum_stock: minimum_stock || existing.minimum_stock,
          items_per_box: unit === 'box' ? items_per_box : existing.items_per_box,
        }
        updateChemical(existing.id, payload)
          .then(() => finish(`${chemical_name} updated: ${existing.quantity} → ${existing.quantity + qty}`))
          .catch(err => fail(err, 'Error updating chemical'))
      } else {
        addChemical({ chemical_name, quantity: qty, unit, items_per_box: unit === 'box' ? items_per_box : null, minimum_stock, notes })
          .then(() => finish(`New chemical added: ${chemical_name}`))
          .catch(err => fail(err, 'Error adding chemical'))
      }
      return
    }

    if (categoryKind === 'frames') {
      const { frame_type, size, design, quantity_to_add, notes } = form
      if (!frame_type || !quantity_to_add) { setSaving(false); return showMsg('Frame type and quantity required', 'error') }
      const qty = parseFloat(quantity_to_add)
      if (isNaN(qty) || qty <= 0) { setSaving(false); return showMsg('Enter a valid quantity', 'error') }
      const existing = frames.find(f =>
        f.frame_type.trim().toLowerCase() === frame_type.trim().toLowerCase() &&
        (f.size || '').trim().toLowerCase() === (size || '').trim().toLowerCase() &&
        (f.design || '').trim().toLowerCase() === (design || '').trim().toLowerCase()
      )
      if (existing) {
        updateFrame(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes })
          .then(() => finish(`${frame_type} updated: ${existing.quantity} → ${existing.quantity + qty}`))
          .catch(err => fail(err, 'Error updating frame'))
      } else {
        addFrame({ frame_type, size, design, quantity: qty, notes })
          .then(() => finish(`New frame added: ${frame_type}`))
          .catch(err => fail(err, 'Error adding frame'))
      }
      return
    }

    if (categoryKind === 'ink') {
      const { item_name, item_type, quantity_to_add, unit, minimum_level, notes } = form
      if (!item_name || !quantity_to_add) { setSaving(false); return showMsg('Item name and quantity required', 'error') }
      const qty = parseFloat(quantity_to_add)
      if (isNaN(qty) || qty <= 0) { setSaving(false); return showMsg('Enter a valid quantity', 'error') }
      const existing = inkStock.find(i => i.item_type === item_type && i.item_name.trim().toLowerCase() === item_name.trim().toLowerCase())
      if (existing) {
        updateInkStock(existing.id, { ...existing, quantity: existing.quantity + qty, notes: notes || existing.notes, minimum_level: minimum_level || existing.minimum_level })
          .then(() => finish(`${item_name} updated: ${existing.quantity} → ${existing.quantity + qty}`))
          .catch(err => fail(err, 'Error updating ink/solvent'))
      } else {
        addInkStock({ item_name, item_type, quantity: qty, unit, minimum_level, notes })
          .then(() => finish(`New item added: ${item_name}`))
          .catch(err => fail(err, 'Error adding ink/solvent'))
      }
      return
    }

    // dynamic category — backend already merges by item_name+attr1+attr2
    if (dynamicCategory) {
      if (!form.item_name || !form.quantity_to_add) { setSaving(false); return showMsg('Name and quantity required', 'error') }
      const qty = parseFloat(form.quantity_to_add)
      if (isNaN(qty) || qty <= 0) { setSaving(false); return showMsg('Enter a valid quantity', 'error') }
      addDynamicItem(dynamicCategory.id, form)
        .then(() => finish(`${form.item_name} stock updated`))
        .catch(err => fail(err, 'Error saving item'))
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="560px">
      <h3 className="text-white font-bold mb-4">Add / Restock Stock</h3>

      {!presetCategoryKind && (
        <div className="mb-4">
          <label className={labelClasses}>Category *</label>
          <select className={inputClasses} value={categoryKind} onChange={e => switchCategory(e.target.value)}>
            {FIXED_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            {categories.map(c => <option key={`dyn-${c.id}`} value={`dyn-${c.id}`}>{c.icon} {c.label}</option>)}
          </select>
        </div>
      )}

      <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl mb-3 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> If a matching item already exists, quantity will be added to existing stock.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {categoryKind === 'flex' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className={labelClasses}>Brand / Type *</label>
              <select className={inputClasses} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}>
                <option value="">Select Brand</option>
                {FLEX_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Size (ft) *</label>
              <select className={inputClasses} value={form.size_ft} onChange={e => setForm({ ...form, size_ft: e.target.value })}>
                <option value="">Select Size</option>
                {FLEX_SIZES.map(s => <option key={s} value={s}>{s} ft</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Rolls to Add *</label>
              <input className={inputClasses} type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className={labelClasses}>Notes</label>
              <input className={inputClasses} placeholder="e.g. New batch from Delhi" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}

        {categoryKind === 'stamps' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]"><label className={labelClasses}>Stamp Type *</label><input className={inputClasses} placeholder="e.g. Pre-Inked, Self-Inking" value={form.stamp_type} onChange={e => setForm({ ...form, stamp_type: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Size</label><input className={inputClasses} placeholder="e.g. 38x14mm" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Design Type</label><input className={inputClasses} placeholder="e.g. Round, Square" value={form.design_type} onChange={e => setForm({ ...form, design_type: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Quantity to Add *</label><input className={inputClasses} type="number" placeholder="0" value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}

        {categoryKind === 'chemicals' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-[2] min-w-[180px]"><label className={labelClasses}>Chemical Name *</label><input className={inputClasses} placeholder="e.g. Bond, Hardener" value={form.chemical_name} onChange={e => setForm({ ...form, chemical_name: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Quantity to Add *</label><input className={inputClasses} type="number" placeholder="0" value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Unit</label>
              <select className={inputClasses} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value, items_per_box: '' })}>
                <option value="litre">Litre</option><option value="kg">KG</option><option value="bottle">Bottle</option>
                <option value="tin">Tin</option><option value="pcs">Pcs</option><option value="box">Box</option>
              </select>
            </div>
            {form.unit === 'box' && (
              <div className="flex-1 min-w-[140px]">
                <label className={labelClasses}>Items per Box *</label>
                <input className={`${inputClasses} !border-blue-500/60`} type="number" placeholder="e.g. 25" value={form.items_per_box} onChange={e => setForm({ ...form, items_per_box: e.target.value })} />
                {(form.quantity_to_add && form.items_per_box) && (
                  <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Total: {form.quantity_to_add * form.items_per_box} pcs</div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Min Stock Alert</label><input className={inputClasses} type="number" placeholder="0" value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}

        {categoryKind === 'frames' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Frame Type *</label><input className={inputClasses} placeholder="e.g. Wooden, Premium" value={form.frame_type} onChange={e => setForm({ ...form, frame_type: e.target.value })} /></div>
            <div className="flex-1 min-w-[100px]"><label className={labelClasses}>Size</label><input className={inputClasses} placeholder="e.g. 4x6, 5x7" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} /></div>
            <div className="flex-1 min-w-[100px]"><label className={labelClasses}>Design</label><input className={inputClasses} placeholder="e.g. Classic, Floral" value={form.design} onChange={e => setForm({ ...form, design: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Quantity to Add *</label><input className={inputClasses} type="number" placeholder="0" value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}

        {categoryKind === 'ink' && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[100px]">
              <label className={labelClasses}>Type</label>
              <select className={inputClasses} value={form.item_type}
                onChange={e => { const t = e.target.value; setForm({ ...form, item_type: t, item_name: t === 'solvent' ? 'Cleaning Solvent' : '' }) }}>
                <option value="ink">Ink</option>
                <option value="solvent">Solvent</option>
              </select>
            </div>
            <div className="flex-[2] min-w-[150px]">
              <label className={labelClasses}>Item Name *</label>
              {form.item_type === 'ink' ? (
                <select className={inputClasses} value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })}>
                  <option value="">Select Color</option>
                  {INK_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input className={inputClasses} placeholder="e.g. Cleaning Solvent" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
              )}
            </div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Quantity to Add *</label><input className={inputClasses} type="number" step="0.1" placeholder="0" value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} /></div>
            <div className="flex-1 min-w-[110px]">
              <label className={labelClasses}>Unit</label>
              <select className={inputClasses} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="litre">Litre</option><option value="ml">ML</option><option value="bottle">Bottle</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Min Level Alert</label><input className={inputClasses} type="number" step="0.1" placeholder="0" value={form.minimum_level} onChange={e => setForm({ ...form, minimum_level: e.target.value })} /></div>
            <div className="flex-1 min-w-[120px]"><label className={labelClasses}>Notes</label><input className={inputClasses} placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        )}

        {dynamicCategory && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-[2] min-w-[180px]">
              <label className={labelClasses}>Item Name *</label>
              <input className={inputClasses} placeholder={`e.g. ${dynamicCategory.label} item`} value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
            </div>
            {dynamicCategory.attr1_label && (
              <div className="flex-1 min-w-[120px]">
                <label className={labelClasses}>{dynamicCategory.attr1_label}</label>
                <input className={inputClasses} placeholder={dynamicCategory.attr1_label} value={form.attr1} onChange={e => setForm({ ...form, attr1: e.target.value })} />
              </div>
            )}
            {dynamicCategory.attr2_label && (
              <div className="flex-1 min-w-[120px]">
                <label className={labelClasses}>{dynamicCategory.attr2_label}</label>
                <input className={inputClasses} placeholder={dynamicCategory.attr2_label} value={form.attr2} onChange={e => setForm({ ...form, attr2: e.target.value })} />
              </div>
            )}
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Quantity to Add *</label>
              <input className={inputClasses} type="number" placeholder="0" value={form.quantity_to_add} onChange={e => setForm({ ...form, quantity_to_add: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className={labelClasses}>Unit</label>
              <select className={inputClasses} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="pcs">Pcs</option><option value="roll">Roll</option><option value="litre">Litre</option>
                <option value="kg">KG</option><option value="box">Box</option><option value="bottle">Bottle</option><option value="sheet">Sheet</option>
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Min Stock Alert</label>
              <input className={inputClasses} type="number" placeholder="0" value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className={labelClasses}>Notes</label>
              <input className={inputClasses} placeholder="Optional" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <LoadingButton
            loading={saving} type="submit"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
          >
            Save Stock
          </LoadingButton>
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
        </div>
      </form>
    </Modal>
  )
}
