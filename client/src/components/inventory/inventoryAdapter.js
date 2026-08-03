// ─────────────────────────────────────────────────────────────────────────────
// Adapter layer: groups the 5 flat backend tables (+ dynamic categories) into
// the "card with variants" shape the new Inventory UI renders.
//
// IMPORTANT: every isLow / isCritical threshold below is copied verbatim from
// the original Inventory.jsx (StockBadge / lowStockCount / the Out-of-Stock
// & Low-Stock banners). Nothing here changes when an item counts as low —
// it only changes how that fact is grouped and displayed.
//
// Pure functions only: no API calls, no JSX. Keeps this testable and keeps
// InventoryItemCard.jsx free of any per-category branching.
// ─────────────────────────────────────────────────────────────────────────────

// Same fixed option lists the original Inventory.jsx used — centralized here
// so AddStockModal and the main page share one copy.
export const FLEX_BRANDS = [
  'Normal (180 GSM)', 'Jindal (220 GSM)', 'Black Back', 'Star (300 GSM)',
  'Vinayal', 'One Way Vision', 'Radium', 'Retro Flex', 'Retro Gumming', 'Other'
]
export const FLEX_SIZES = [3, 4, 5, 6, 8, 10]
export const INK_COLORS = ['Cyan', 'Magenta', 'Yellow', 'Black']

export function timeAgo(dateString) {
  if (!dateString) return null
  const then = new Date(dateString.replace(' ', 'T') + (dateString.includes('Z') ? '' : 'Z'))
  const now = new Date()
  const diffMs = now - then
  if (isNaN(diffMs)) return null
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function latestUpdatedAt(rows) {
  return rows.reduce((latest, r) => {
    if (!r.updated_at) return latest
    if (!latest || new Date(r.updated_at) > new Date(latest)) return r.updated_at
    return latest
  }, null)
}

// Rolls every variant's isLow/isCritical up into one status for the card,
// plus a short real-data-only status line (no fabricated percentages).
function cardStatus(variants, unitLabel) {
  const anyCritical = variants.some(v => v.isCritical)
  const anyLow = variants.some(v => v.isLow)
  const lowOrCriticalCount = variants.filter(v => v.isLow || v.isCritical).length

  if (anyCritical || anyLow) {
    return {
      statusType: anyCritical ? 'critical' : 'warning',
      statusText: `${lowOrCriticalCount} of ${variants.length} ${lowOrCriticalCount === 1 ? 'size needs' : 'sizes need'} restock`,
    }
  }
  const total = variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
  return { statusType: 'healthy', statusText: `Total stock: ${total} ${unitLabel}` }
}

function buildCard({ groupKey, categoryKind, categoryLabel, title, variants, unitLabel, categoryIcon }) {
  const { statusType, statusText } = cardStatus(variants, unitLabel)
  return {
    groupKey,
    categoryKind,
    categoryLabel,
    categoryIcon,
    title,
    variants,
    varietyCount: variants.length,
    statusType,
    statusText,
    updatedAt: latestUpdatedAt(variants.map(v => v.raw)),
  }
}

// ── FLEX ROLLS ─────────────────────────────────────────────────────────────
// Group by brand. Variant = each size_ft row. isCritical at 0, isLow at 1 —
// exactly the thresholds StockBadge/the flex Out-of-Stock/Low-Stock banners
// already use.
export function groupFlex(flexStock) {
  const byBrand = {}
  for (const row of flexStock) {
    if (!byBrand[row.brand]) byBrand[row.brand] = []
    byBrand[row.brand].push(row)
  }
  return Object.entries(byBrand).map(([brand, rows]) => {
    const variants = rows
      .sort((a, b) => Number(a.size_ft) - Number(b.size_ft))
      .map(row => ({
        id: row.id,
        label: `${row.size_ft} ft`,
        quantity: row.quantity,
        unit: row.unit || 'roll',
        isCritical: row.quantity === 0,
        isLow: row.quantity === 1,
        raw: row,
      }))
    return buildCard({
      groupKey: `flex-${brand}`,
      categoryKind: 'flex',
      categoryLabel: 'Flex Rolls',
      title: brand,
      variants,
      unitLabel: 'rolls',
    })
  })
}

// ── STAMPS ─────────────────────────────────────────────────────────────────
// Group by stamp_type. Variant = each size+design combo. Original only ever
// treats qty===0 as low (no separate "low" tier for stamps) — preserved.
export function groupStamps(stamps) {
  const byType = {}
  for (const row of stamps) {
    if (!byType[row.stamp_type]) byType[row.stamp_type] = []
    byType[row.stamp_type].push(row)
  }
  return Object.entries(byType).map(([stampType, rows]) => {
    const variants = rows.map(row => ({
      id: row.id,
      label: [row.size, row.design_type].filter(Boolean).join(' / ') || 'Standard',
      quantity: row.quantity,
      unit: 'pcs',
      isCritical: row.quantity === 0,
      isLow: false,
      raw: row,
    }))
    return buildCard({
      groupKey: `stamps-${stampType}`,
      categoryKind: 'stamps',
      categoryLabel: 'Stamps',
      title: stampType,
      variants,
      unitLabel: 'pcs',
    })
  })
}

// ── CHEMICALS ──────────────────────────────────────────────────────────────
// Each chemical is its own card with exactly one variant chip (no natural
// sub-size). isLow uses the same `quantity <= minimum_stock` rule as
// StockBadge; isCritical is qty===0 same as everywhere else.
export function groupChemicals(chemicals) {
  return chemicals.map(row => {
    const displayQty = row.unit === 'box' && row.items_per_box
      ? `${row.quantity} box (${row.quantity * row.items_per_box} pcs)`
      : `${row.quantity}`
    const variants = [{
      id: row.id,
      label: displayQty,
      quantity: row.quantity,
      unit: row.unit,
      isCritical: row.quantity === 0,
      isLow: row.quantity > 0 && row.quantity <= row.minimum_stock,
      raw: row,
    }]
    return buildCard({
      groupKey: `chem-${row.id}`,
      categoryKind: 'chemicals',
      categoryLabel: 'Chemicals',
      title: row.chemical_name,
      variants,
      unitLabel: row.unit,
    })
  })
}

// ── PHOTO FRAMES ───────────────────────────────────────────────────────────
// Group by frame_type. Variant = size+design combo. isCritical at 0,
// isLow at <5 (matches the original "Low Stock: quantity<5 && >0" banner).
export function groupFrames(frames) {
  const byType = {}
  for (const row of frames) {
    if (!byType[row.frame_type]) byType[row.frame_type] = []
    byType[row.frame_type].push(row)
  }
  return Object.entries(byType).map(([frameType, rows]) => {
    const variants = rows.map(row => ({
      id: row.id,
      label: [row.size, row.design].filter(Boolean).join(' ') || 'Standard',
      quantity: row.quantity,
      unit: 'pcs',
      isCritical: row.quantity === 0,
      isLow: row.quantity > 0 && row.quantity < 5,
      raw: row,
    }))
    return buildCard({
      groupKey: `frames-${frameType}`,
      categoryKind: 'frames',
      categoryLabel: 'Photo Frames',
      title: frameType,
      variants,
      unitLabel: 'pcs',
    })
  })
}

// ── INK & SOLVENT ──────────────────────────────────────────────────────────
// Two cards: "Ink Colors" (variant per color) and "Solvent" (variant per
// solvent item). Same `quantity <= minimum_level` threshold as StockBadge.
export function groupInk(inkStock) {
  const inkRows = inkStock.filter(i => i.item_type === 'ink')
  const solventRows = inkStock.filter(i => i.item_type === 'solvent')
  const cards = []

  if (inkRows.length > 0) {
    cards.push(buildCard({
      groupKey: 'ink-colors',
      categoryKind: 'ink',
      categoryLabel: 'Ink & Solvent',
      title: 'Ink Colors',
      variants: inkRows.map(row => ({
        id: row.id,
        label: row.item_name,
        quantity: row.quantity,
        unit: row.unit,
        isCritical: row.quantity === 0,
        isLow: row.quantity > 0 && row.quantity <= row.minimum_level,
        raw: row,
      })),
      unitLabel: inkRows[0]?.unit || 'litre',
    }))
  }
  if (solventRows.length > 0) {
    cards.push(buildCard({
      groupKey: 'ink-solvent',
      categoryKind: 'ink',
      categoryLabel: 'Ink & Solvent',
      title: 'Solvent',
      variants: solventRows.map(row => ({
        id: row.id,
        label: row.item_name,
        quantity: row.quantity,
        unit: row.unit,
        isCritical: row.quantity === 0,
        isLow: row.quantity > 0 && row.quantity <= row.minimum_level,
        raw: row,
      })),
      unitLabel: solventRows[0]?.unit || 'litre',
    }))
  }
  return cards
}

// ── DYNAMIC (USER-CREATED) CATEGORIES ─────────────────────────────────────
// Group by item_name within the category. Variant = attr1+attr2 combo.
// Same `quantity <= minimum_stock` threshold as StockBadge/the table used.
export function groupDynamic(category, items) {
  const byName = {}
  for (const row of items) {
    if (!byName[row.item_name]) byName[row.item_name] = []
    byName[row.item_name].push(row)
  }
  return Object.entries(byName).map(([itemName, rows]) => {
    const variants = rows.map(row => ({
      id: row.id,
      label: [row.attr1, row.attr2].filter(Boolean).join(' / ') || 'Standard',
      quantity: row.quantity,
      unit: row.unit,
      isCritical: row.quantity === 0,
      isLow: row.quantity > 0 && row.quantity <= row.minimum_stock,
      raw: row,
    }))
    return buildCard({
      groupKey: `dyn-${category.id}-${itemName}`,
      categoryKind: `dyn-${category.id}`,
      categoryLabel: category.label,
      title: itemName,
      variants,
      unitLabel: rows[0]?.unit || category.unit_default || 'pcs',
      categoryIcon: category.icon,
    })
  })
}
