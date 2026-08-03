  import Card from '../ui/Card'
  import Badge from '../ui/Badge'
  import { SecondaryButton } from '../ui/Button'
  import { AlertTriangle, Siren, CheckCircle2, Plus, ListChecks, Clock } from 'lucide-react'
  import { timeAgo } from './inventoryAdapter'

  const STATUS_BADGE = {
    critical: { tone: 'red', icon: Siren, label: 'Critical' },
    warning: { tone: 'amber', icon: AlertTriangle, label: 'Low Stock' },
    healthy: { tone: 'emerald', icon: CheckCircle2, label: 'Healthy' },
  }

  function VariantChip({ variant, onClick }) {
    const tone = variant.isCritical ? 'critical' : variant.isLow ? 'warning' : 'ok'
    const styles = {
      critical: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
      warning: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15',
      ok: 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800',
    }
    const qtyColor = {
      critical: 'text-red-400',
      warning: 'text-amber-400',
      ok: 'text-white',
    }
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border text-left transition-all min-w-0 ${styles[tone]}`}
      >
        {tone !== 'ok' && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
            <AlertTriangle className={`w-2.5 h-2.5 ${qtyColor[tone]}`} />
          </span>
        )}
        <span className="text-[11px] font-semibold text-slate-400 leading-tight">{variant.label}</span>
        <span className={`text-sm font-bold ${qtyColor[tone]}`}>
          {variant.quantity} <span className="text-[10px] font-normal text-slate-500">{variant.unit}</span>
        </span>
      </button>
    )
  }

  export default function InventoryItemCard({ card, icon: Icon, onVariantClick, onAddVariant, onBatchEdit }) {
    const status = STATUS_BADGE[card.statusType]
    const updated = timeAgo(card.updatedAt)

    return (
      <Card className="flex flex-col gap-4 vf-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 text-lg">
              {Icon ? <Icon className="w-5 h-5 text-blue-400" /> : card.categoryIcon ? <span>{card.categoryIcon}</span> : null}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base leading-tight truncate">{card.title}</h3>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mt-0.5">{card.categoryLabel}</p>
            </div>
          </div>
          {updated && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 shrink-0 whitespace-nowrap">
              <Clock className="w-3 h-3" /> {updated}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge tone={status.tone} icon={status.icon}>{card.statusText}</Badge>
          <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
            {card.varietyCount} {card.varietyCount === 1 ? 'Variant' : 'Varieties'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {card.variants.map(v => (
            <VariantChip key={v.id} variant={v} onClick={() => onVariantClick(v, card)} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/60 mt-auto">
          <SecondaryButton onClick={() => onAddVariant(card)} className="!px-3 !py-1.5 !text-[11px]">
            <Plus className="w-3.5 h-3.5" /> Add
          </SecondaryButton>
          {card.variants.length > 1 && (
            <SecondaryButton onClick={() => onBatchEdit(card)} className="!px-3 !py-1.5 !text-[11px]">
              <ListChecks className="w-3.5 h-3.5" /> Batch Edit
            </SecondaryButton>
          )}
        </div>
      </Card>
    )
  }
