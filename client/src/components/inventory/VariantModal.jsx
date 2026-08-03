import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { SecondaryButton } from '../ui/Button'
import LoadingButton from '../../components/LoadingButton'
import { Send, Pencil, Trash2 } from 'lucide-react'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

// Which fields each category's edit form shows — copied 1:1 from the
// original per-tab edit forms in Inventory.jsx (including which categories
// do / don't have a notes field, since that wasn't consistent originally).
function EditFields({ categoryKind, dynamicCategory, form, setForm }) {
  switch (categoryKind) {
    case 'flex':
      return (
        <>
          <div>
            <label className={labelClasses}>Quantity (Rolls)</label>
            <input className={inputClasses} type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Notes</label>
            <input className={inputClasses} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </>
      )
    case 'stamps':
      return (
        <>
          <div>
            <label className={labelClasses}>Stamp Type</label>
            <input className={inputClasses} value={form.stamp_type || ''} onChange={e => setForm({ ...form, stamp_type: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClasses}>Size</label>
              <input className={inputClasses} value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={labelClasses}>Design Type</label>
              <input className={inputClasses} value={form.design_type || ''} onChange={e => setForm({ ...form, design_type: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Quantity (actual)</label>
            <input className={inputClasses} type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Notes</label>
            <input className={inputClasses} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </>
      )
    case 'chemicals':
      return (
        <>
          <div>
            <label className={labelClasses}>Chemical Name</label>
            <input className={inputClasses} value={form.chemical_name || ''} onChange={e => setForm({ ...form, chemical_name: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClasses}>Quantity (actual)</label>
              <input className={inputClasses} type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={labelClasses}>Unit</label>
              <select className={inputClasses} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value, items_per_box: '' })}>
                <option value="litre">Litre</option><option value="kg">KG</option><option value="bottle">Bottle</option>
                <option value="tin">Tin</option><option value="pcs">Pcs</option><option value="box">Box</option>
              </select>
            </div>
          </div>
          {form.unit === 'box' && (
            <div>
              <label className={labelClasses}>Items per Box</label>
              <input className={inputClasses} type="number" value={form.items_per_box || ''} onChange={e => setForm({ ...form, items_per_box: e.target.value })} />
            </div>
          )}
          <div>
            <label className={labelClasses}>Min Stock Alert</label>
            <input className={inputClasses} type="number" value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} />
          </div>
        </>
      )
    case 'frames':
      return (
        <>
          <div>
            <label className={labelClasses}>Frame Type</label>
            <input className={inputClasses} value={form.frame_type || ''} onChange={e => setForm({ ...form, frame_type: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClasses}>Size</label>
              <input className={inputClasses} value={form.size || ''} onChange={e => setForm({ ...form, size: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={labelClasses}>Design</label>
              <input className={inputClasses} value={form.design || ''} onChange={e => setForm({ ...form, design: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Quantity (actual)</label>
            <input className={inputClasses} type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Notes</label>
            <input className={inputClasses} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </>
      )
    case 'ink':
      return (
        <>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClasses}>Type</label>
              <select className={inputClasses} value={form.item_type} onChange={e => setForm({ ...form, item_type: e.target.value })}>
                <option value="ink">Ink</option><option value="solvent">Solvent</option>
              </select>
            </div>
            <div className="flex-[2]">
              <label className={labelClasses}>Item Name</label>
              <input className={inputClasses} value={form.item_name || ''} onChange={e => setForm({ ...form, item_name: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClasses}>Quantity (actual)</label>
              <input className={inputClasses} type="number" step="0.1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className={labelClasses}>Unit</label>
              <select className={inputClasses} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="litre">Litre</option><option value="ml">ML</option><option value="bottle">Bottle</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClasses}>Min Level Alert</label>
            <input className={inputClasses} type="number" step="0.1" value={form.minimum_level} onChange={e => setForm({ ...form, minimum_level: e.target.value })} />
          </div>
        </>
      )
    default: // dynamic categories
      return (
        <>
          <div>
            <label className={labelClasses}>Item Name</label>
            <input className={inputClasses} value={form.item_name || ''} onChange={e => setForm({ ...form, item_name: e.target.value })} />
          </div>
          {dynamicCategory?.attr1_label && (
            <div>
              <label className={labelClasses}>{dynamicCategory.attr1_label}</label>
              <input className={inputClasses} value={form.attr1 || ''} onChange={e => setForm({ ...form, attr1: e.target.value })} />
            </div>
          )}
          {dynamicCategory?.attr2_label && (
            <div>
              <label className={labelClasses}>{dynamicCategory.attr2_label}</label>
              <input className={inputClasses} value={form.attr2 || ''} onChange={e => setForm({ ...form, attr2: e.target.value })} />
            </div>
          )}
          <div>
            <label className={labelClasses}>Quantity (actual)</label>
            <input className={inputClasses} type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <label className={labelClasses}>Min Stock Alert</label>
            <input className={inputClasses} type="number" value={form.minimum_stock} onChange={e => setForm({ ...form, minimum_stock: e.target.value })} />
          </div>
        </>
      )
  }
}

export default function VariantModal({ open, onClose, variant, card, categoryKind, dynamicCategory, onUse, onSaveEdit, onDelete, saving }) {
  const [mode, setMode] = useState('use') // 'use' | 'edit'
  const [useAmount, setUseAmount] = useState('')
  const [useNotes, setUseNotes] = useState('')
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    if (variant) {
      setEditForm({ ...variant.raw })
      setUseAmount('')
      setUseNotes('')
      setMode('use')
    }
  }, [variant])

  if (!open || !variant) return null

  function handleUseSubmit(e) {
    e.preventDefault()
    if (!useAmount || Number(useAmount) <= 0) return
    onUse(variant, Number(useAmount), useNotes)
  }

  function handleEditSubmit(e) {
    e.preventDefault()
    onSaveEdit(variant, editForm)
  }

  return (
    <Modal open={open} onClose={onClose} width="440px">
      <h3 className="text-white font-bold mb-1">{card?.title} — {variant.label}</h3>
      <p className="text-xs text-slate-400 mb-4">
        Currently <span className="text-slate-200 font-semibold">{variant.quantity} {variant.unit}</span> in stock.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('use')}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${mode === 'use' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
        >
          <Send className="w-3.5 h-3.5 inline mr-1.5" /> Use Stock
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${mode === 'edit' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
        >
          <Pencil className="w-3.5 h-3.5 inline mr-1.5" /> Edit Details
        </button>
      </div>

      {mode === 'use' && (
        <form onSubmit={handleUseSubmit} className="space-y-3">
          <div>
            <label className={labelClasses}>Amount Used *</label>
            <input className={inputClasses} type="number" step="0.1" placeholder="0" value={useAmount} onChange={e => setUseAmount(e.target.value)} />
          </div>
          <div>
            <label className={labelClasses}>Notes</label>
            <input className={inputClasses} placeholder="Optional" value={useNotes} onChange={e => setUseNotes(e.target.value)} />
          </div>
          <div className="flex gap-2.5 pt-1">
            <LoadingButton
              loading={saving} type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
            >
              Confirm Use
            </LoadingButton>
            <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
          </div>
        </form>
      )}

      {mode === 'edit' && editForm && (
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <EditFields categoryKind={categoryKind} dynamicCategory={dynamicCategory} form={editForm} setForm={setEditForm} />
          <div className="flex items-center justify-between gap-2.5 pt-1">
            <div className="flex gap-2.5">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all">Save Changes</button>
              <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
            </div>
            <button
              type="button"
              onClick={() => onDelete(variant)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
