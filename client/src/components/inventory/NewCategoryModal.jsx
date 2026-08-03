import { useState } from 'react'
import Modal from '../ui/Modal'
import { SecondaryButton } from '../ui/Button'
import LoadingButton from '../../components/LoadingButton'
import { FolderPlus } from 'lucide-react'
import { addInventoryCategory } from '../../services/api'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2.5 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed'
const labelClasses = 'text-[11px] font-semibold text-slate-400 block mb-1.5'

const blank = { label: '', icon: '', attr1_label: 'Size', attr2_label: 'Type', unit_default: 'pcs' }

export default function NewCategoryModal({ open, onClose, onCreated, showMsg }) {
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) return showMsg('Category name required', 'error')
    setSaving(true)
    addInventoryCategory(form)
      .then(res => {
        showMsg(`Category created: ${form.label}`)
        setForm(blank)
        onCreated(res.data.id)
      })
      .catch(err => showMsg(err.response?.data?.error || 'Error creating category', 'error'))
      .finally(() => setSaving(false))
  }

  return (
    <Modal open={open} onClose={onClose} width="480px">
      <h3 className="text-white font-bold mb-1.5 flex items-center gap-2"><FolderPlus className="w-4.5 h-4.5" /> New Inventory Category</h3>
      <p className="text-xs text-slate-400 mb-4">
        Create a new category — like Vinyl, Paper, Lamination, etc. You can add items to it afterward without any code changes.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClasses}>Category Name *</label>
          <input className={inputClasses} placeholder="e.g. Vinyl Rolls, Paper, Lamination Sheets"
            value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
        </div>
        <div>
          <label className={labelClasses}>Default Unit</label>
          <select className={inputClasses} value={form.unit_default} onChange={e => setForm({ ...form, unit_default: e.target.value })}>
            <option value="pcs">Pcs</option><option value="roll">Roll</option>
            <option value="litre">Litre</option><option value="kg">KG</option>
            <option value="box">Box</option><option value="bottle">Bottle</option>
            <option value="sheet">Sheet</option>
          </select>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className={labelClasses}>Attribute 1 label (optional)</label>
            <input className={inputClasses} placeholder="e.g. Size" value={form.attr1_label} onChange={e => setForm({ ...form, attr1_label: e.target.value })} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className={labelClasses}>Attribute 2 label (optional)</label>
            <input className={inputClasses} placeholder="e.g. Type" value={form.attr2_label} onChange={e => setForm({ ...form, attr2_label: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2.5 pt-1">
          <LoadingButton
            loading={saving} type="submit"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
          >
            Create Category
          </LoadingButton>
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
        </div>
      </form>
    </Modal>
  )
}
