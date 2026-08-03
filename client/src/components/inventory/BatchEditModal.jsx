import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { SecondaryButton } from '../ui/Button'
import LoadingButton from '../../components/LoadingButton'
import { updateFlexStock, updateStamp, updateChemical, updateFrame, updateInkStock, updateDynamicItem } from '../../services/api'

const inputClasses = 'bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3 py-2 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 w-24 text-center'

function updaterFor(categoryKind) {
  if (categoryKind === 'flex') return (v, newQty) => updateFlexStock(v.id, { ...v.raw, quantity: newQty })
  if (categoryKind === 'stamps') return (v, newQty) => updateStamp(v.id, { ...v.raw, quantity: newQty })
  if (categoryKind === 'chemicals') return (v, newQty) => updateChemical(v.id, { ...v.raw, quantity: newQty })
  if (categoryKind === 'frames') return (v, newQty) => updateFrame(v.id, { ...v.raw, quantity: newQty })
  if (categoryKind === 'ink') return (v, newQty) => updateInkStock(v.id, { ...v.raw, quantity: newQty })
  if (categoryKind.startsWith('dyn-')) {
    const catId = categoryKind.replace('dyn-', '')
    return (v, newQty) => updateDynamicItem(catId, v.id, { ...v.raw, quantity: newQty })
  }
  return null
}

export default function BatchEditModal({ open, onClose, card, categoryKind, onDone, showMsg }) {
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (card) {
      const init = {}
      card.variants.forEach(v => { init[v.id] = String(v.quantity) })
      setValues(init)
    }
  }, [card])

  if (!open || !card) return null

  function handleSubmit(e) {
    e.preventDefault()
    const update = updaterFor(categoryKind)
    if (!update) return
    setSaving(true)
    const changed = card.variants.filter(v => String(values[v.id]) !== String(v.quantity))
    if (changed.length === 0) { setSaving(false); onClose(); return }

    Promise.all(changed.map(v => update(v, Number(values[v.id]))))
      .then(() => {
        showMsg(`${card.title} updated (${changed.length} ${changed.length === 1 ? 'variant' : 'variants'})`)
        setSaving(false)
        onDone()
      })
      .catch(() => {
        showMsg('Error saving some changes', 'error')
        setSaving(false)
      })
  }

  return (
    <Modal open={open} onClose={onClose} width="440px">
      <h3 className="text-white font-bold mb-1">Batch Edit — {card.title}</h3>
      <p className="text-xs text-slate-400 mb-4">Update quantities for every variant at once.</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
          {card.variants.map(v => (
            <div key={v.id} className="flex items-center justify-between gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-200 truncate">{v.label}</div>
                <div className="text-[11px] text-slate-500">{v.unit}</div>
              </div>
              <input
                className={inputClasses}
                type="number"
                value={values[v.id] ?? ''}
                onChange={e => setValues({ ...values, [v.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2.5 pt-2">
          <LoadingButton
            loading={saving} type="submit"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-600/25"
          >
            Save All
          </LoadingButton>
          <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
        </div>
      </form>
    </Modal>
  )
}
