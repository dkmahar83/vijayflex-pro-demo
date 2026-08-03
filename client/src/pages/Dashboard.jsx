import { useState, useEffect } from 'react'
import { getDashboard, sendBillWhatsApp, getWhatsAppStatus } from '../services/api'
import { useNavigate } from 'react-router-dom'
import SectionLoader from '../components/SectionLoader'
import SectionCard from '../components/ui/SectionCard'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { PrimaryButton, SecondaryButton } from '../components/ui/Button'
import { Table, THead, Th, TBody, TFoot, Tr, Td } from '../components/ui/Table'
import {
  Package,
  PackageX,
  AlertTriangle,
  ClipboardList,
  Wallet,
  CalendarDays,
  ListFilter,
  Bell,
  Smartphone,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Send,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  MapPin,
  Printer,
} from 'lucide-react'

const DUE_FILTERS = [
  { key: 'overdue', label: 'Overdue',   icon: AlertTriangle },
  { key: 'today',   label: 'Today',     icon: Bell },
  { key: 'week',    label: 'This Week', icon: CalendarDays },
  { key: 'all',     label: 'All',       icon: ListFilter },
]

const UPI_ACCOUNTS_FOR_WA = [
  { label: 'Demo UPI Account 1', upiId: 'demo1@upi' },
  { label: 'Demo UPI Account 2', upiId: 'demo2@upi' },
  { label: 'Demo UPI Account 3', upiId: 'demo3@upi' },
  { label: 'Demo UPI Account 4', upiId: 'demo4@upi' },
]

function Dashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [dueDateFilter, setDueDateFilter] = useState('all') // 'overdue' | 'today' | 'week' | 'all'
  const [waSendModal, setWaSendModal] = useState(null)
  const [selectedUpiForWA, setSelectedUpiForWA] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waStatus, setWaStatus] = useState('checking')
  const [duesSearch, setDuesSearch] = useState('')
  const [collapsed, setCollapsed] = useState({ stats: true, lowStock: true, todayOrders: true, dues: true })
  // Hero panel — live clock, date, weather+location. Stats/Dues ka
  // collapsed-by-default privacy-behavior as-is hai.
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState(null)
  const [locationName, setLocationName] = useState('')
  const [weatherError, setWeatherError] = useState('')
  const [activityLimit, setActivityLimit] = useState(20)
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false)
  const navigate = useNavigate()

  // Logged-in user ka naam — same localStorage key jo App.jsx login ke time
  // set karta hai. Sirf read kar rahe hain, koi naya auth/API call nahi.
  const greetName = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('flexshop_user') || 'null')
      return u?.name || u?.username || ''
    } catch {
      return ''
    }
  })()

  // Har card kis section-id ko scroll karega jab wo open ho
  const SECTION_IDS = { stats: 'stats-section', lowStock: 'low-stock-section', todayOrders: 'today-orders-section', dues: 'dues-section' }

  // Ek time par sirf EK section open — accordion behavior (reference ke
  // "click card → scroll → expand, doosra band" wale spec ke mutabik).
  function openSection(key) {
    setCollapsed({ stats: true, lowStock: true, todayOrders: true, dues: true, [key]: false })
    setTimeout(() => {
      document.getElementById(SECTION_IDS[key])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  function toggleSection(key) {
    setCollapsed(prev => {
      if (prev[key]) {
        // band tha → isko kholo, baaki sab band karo
        setTimeout(() => {
          document.getElementById(SECTION_IDS[key])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 60)
        return { stats: true, lowStock: true, todayOrders: true, dues: true, [key]: false }
      }
      // khula tha → sirf isko band karo
      return { ...prev, [key]: true }
    })
  }

  useEffect(() => {
    getDashboard(activityLimit)
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recent Activity "Show last 50" / "Show last 20" toggle — refetches the
  // whole dashboard (it's one combined endpoint) but only the activity count
  // actually changes for the person, everything else just re-renders the same.
  function handleToggleActivityLimit() {
    const nextLimit = activityLimit === 20 ? 50 : 20
    setLoadingMoreActivity(true)
    getDashboard(nextLimit)
      .then(res => { setData(res.data); setActivityLimit(nextLimit) })
      .catch(() => {})
      .finally(() => setLoadingMoreActivity(false))
  }

  useEffect(() => {
    getWhatsAppStatus()
      .then(res => setWaStatus(res.data.status))
      .catch(() => {})
  }, [])

  // WA-status message ab khud 4 sec baad gayab ho jaata hai — pehle sirf
  // click-karke hatao tha.
  useEffect(() => {
    if (!waMessage) return
    const timer = setTimeout(() => setWaMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [waMessage])

  // Live clock — 1 second tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Open-Meteo (weather) + BigDataCloud (city naam). Permission deny ho
  // ya API fail ho to silently gracefully skip ho jaata hai.
  useEffect(() => {
    if (!navigator.geolocation) {
      // setState seedha effect-body mein synchronously call karna eslint
      // (react-hooks/set-state-in-effect) flag karta hai — cascading render
      // avoid karne ke liye microtask mein defer kiya, behavior same hai.
      queueMicrotask(() => setWeatherError('Location supported nahi hai.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
          .then(r => r.json())
          .then(json => setWeather(json.current_weather))
          .catch(() => setWeatherError('Weather load nahi hui.'))

        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
          .then(r => r.json())
          .then(json => setLocationName(json.city || json.locality || json.principalSubdivision || ''))
          .catch(() => {})
      },
      () => setWeatherError('Location permission nahi mili.'),
      { timeout: 8000 }
    )
  }, [])

  if (loading) return <SectionLoader label="Dashboard load ho raha hai..." size="large" minHeight="60vh" />
  if (!data)   return <p className="text-slate-400 p-5">Could not load dashboard.</p>

  const today = data.date

  // Filter due payments
  const allDues = data.all_dues || []
  const filteredDues = allDues.filter(d => {
    if (dueDateFilter === 'overdue') return d.follow_up_date && d.follow_up_date < today
    if (dueDateFilter === 'today')   return d.follow_up_date === today
    if (dueDateFilter === 'week') {
      const weekLater = new Date(today)
      weekLater.setDate(weekLater.getDate() + 7)
      return d.follow_up_date && d.follow_up_date <= weekLater.toLocaleDateString('en-CA')
    }
    return true // 'all'
  }).filter(d => {
    if (!duesSearch.trim()) return true
    const q = duesSearch.trim().toLowerCase()
    return (d.firm_name || '').toLowerCase().includes(q) || (d.phone || '').includes(q)
  }).sort((a, b) => b.total_due - a.total_due) // descending by amount

  const wInfo       = weather ? weatherInfo(weather.weathercode) : null
  const WeatherIcon = wInfo ? wInfo.icon : null

  // IST hours/minutes/seconds — digital clock ke liye
  const istParts = (() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now)
    const get = t => parts.find(p => p.type === t)?.value || '00'
    return { hours: get('hour'), minutes: get('minute'), seconds: get('second') }
  })()
  const dayName   = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' })
  const dateShort = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })

  // Din ka kitna hissa beet chuka hai (0–100%) — progress-bar marker ke liye
  const dayProgressPct = (
    (Number(istParts.hours) * 3600 + Number(istParts.minutes) * 60 + Number(istParts.seconds)) / 86400
  ) * 100

  const lowStockCount = data.low_stock_alerts?.length || 0

  const recentActivity = data.recent_activity || []

  return (
    <div className="space-y-7">
      {/* ── HERO PANEL — day-progress timeline, date, weather+location, and
          an accordion of nav-cards that expand the sections below. This
          panel is real existing functionality with no equivalent in the
          Stitch mock, so it's re-skinned to the same slate/blue design
          language rather than removed. ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl p-6 md:p-10">
        {/* Ambient glow — purely decorative, no data implied */}
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-blue-600/20 via-transparent to-sky-400/20 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-400/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> System Live
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-500">
                <Printer className="w-3.5 h-3.5" /> VIJAYFLEX PRO
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
              {greetingWord(istParts.hours)}{greetName ? `, ${greetName}` : ''}.
            </h1>

            <p className="text-sm md:text-base text-slate-400 max-w-xl leading-relaxed">
              {data.pending_orders} pending order{data.pending_orders !== 1 ? 's' : ''}, {allDues.length} customer{allDues.length !== 1 ? 's' : ''} with dues
              {lowStockCount > 0 && <> and <span className="text-amber-400 font-semibold">{lowStockCount} low stock alert{lowStockCount !== 1 ? 's' : ''}</span></>}.
            </p>
          </div>

          {/* Weather card */}
          <div className="shrink-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-4 min-w-[190px]">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Current Weather</div>
            {weather && wInfo && WeatherIcon ? (
              <>
                <div className="flex items-center gap-2 text-white">
                  <WeatherIcon className="w-5 h-5" />
                  <span className="text-xl font-bold">{Math.round(weather.temperature)}°C</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {wInfo.label}{locationName && ` • ${locationName}`}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" /> {weatherError || 'Locating...'}
              </div>
            )}
          </div>
        </div>

        {/* Day + progress row */}
        <div className="relative mt-8 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0">
            <div className="text-sm font-bold text-white">{dayName}</div>
            <div className="text-[11px] text-white/40">{dateShort}</div>
          </div>
          <div className="flex-1">
            <div className="relative h-1.5 rounded-full bg-white/10">
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]"
                style={{ width: `${dayProgressPct}%` }}
              />
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]"
                style={{ left: `${dayProgressPct}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/25 mt-1.5">
              <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS — Pending Orders / Low Stock / Today's Orders / Due Payments.
          Click = accordion open + smooth scroll; doosra khula ho to woh band.
          Same toggleSection/openSection logic as before, only the tile look
          changed (bigger, bolder — Stitch-inspired). ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ClipboardList}
          value="Summary"
          label="Stats"
          sub="Full business overview"
          tone="blue"
          open={!collapsed.stats}
          onClick={() => toggleSection('stats')}
        />

        {lowStockCount > 0 && (
          <KpiCard
            icon={Package}
            value={lowStockCount}
            label="Low Stock Alerts"
            sub="Items need reordering"
            tone="amber"
            open={!collapsed.lowStock}
            onClick={() => toggleSection('lowStock')}
          />
        )}

        <KpiCard
          icon={CalendarDays}
          value={data.today_orders_list.length}
          label="Today's Orders"
          sub="Live order queue"
          tone="emerald"
          open={!collapsed.todayOrders}
          onClick={() => toggleSection('todayOrders')}
        />

        <KpiCard
          icon={Wallet}
          value={allDues.length}
          label="Due Payments"
          sub={`₹XXXXX outstanding`}
          tone="red"
          open={!collapsed.dues}
          onClick={() => toggleSection('dues')}
        />
      </div>

      {/* ── QUICK ACTION + RECENT ACTIVITY — always visible (not behind the
          accordion), matching the Stitch layout. Recent Activity is real data
          from the new `recent_activity` field the backend now returns (built
          from `orders` + `customers` — the only schema already confirmed in
          dashboard.js). Falls back gracefully if that field isn't there yet. ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/orders')}
          className="group relative lg:col-span-1 min-h-[320px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl cursor-pointer flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-brand to-brand-dark"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_60%)] pointer-events-none" />
          <div className="relative w-16 h-16 rounded-full bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center mb-5 shadow-xl group-hover:scale-110 transition-transform duration-300">
            <Printer className="w-8 h-8 text-white" />
          </div>
          <div className="relative text-2xl font-extrabold text-white tracking-tight mb-1.5">VijayFlex Pro</div>
          <div className="relative flex items-center gap-2 text-[11px] font-semibold text-white/80 tracking-widest uppercase mb-6">
            <span>Flex</span><span className="w-1 h-1 rounded-full bg-white/50" />
            <span>Print</span><span className="w-1 h-1 rounded-full bg-white/50" />
            <span>Signage</span>
          </div>
          <span className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 group-hover:bg-white/25 border border-white/30 text-white text-sm font-bold transition-all group-hover:px-6">
            New Order <ChevronRight className="w-4 h-4" />
          </span>
        </div>

        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" /> Recent Activity
            </h3>
            <button onClick={() => navigate('/orders')} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              View All
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500 text-sm">No recent activity yet.</p>
            </div>
          ) : (
            <div className="relative flex-1 space-y-5 overflow-y-auto max-h-[480px] pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="absolute left-[13px] top-1 bottom-1 w-px bg-slate-800" />
              {recentActivity.map((act, i) => {
                const at = ACTIVITY_TYPES[act.type] || ACTIVITY_TYPES.order
                const ActIcon = at.icon
                return (
                  <div
                    key={`${act.type}-${act.created_at}-${i}`}
                    onClick={() => navigate('/orders')}
                    className="relative pl-9 cursor-pointer group"
                  >
                    <span className={`absolute left-0 top-0 w-7 h-7 rounded-full bg-slate-950 border-2 border-slate-900 flex items-center justify-center ${at.badge}`}>
                      <ActIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                          {act.title}
                          {act.order_number && <span className="ml-2 text-[10px] font-mono font-normal text-slate-500 align-middle">{act.order_number}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {act.subtitle}{act.amount != null && ` · ₹${act.amount}`}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">{relativeTime(act.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center shrink-0">
              <button
                onClick={handleToggleActivityLimit}
                disabled={loadingMoreActivity}
                className="text-xs font-semibold text-slate-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {loadingMoreActivity ? 'Loading…' : activityLimit === 20 ? 'Show last 50' : 'Show last 20'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activityLimit === 50 ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── SUMMARY STATS CONTENT ── */}
      {!collapsed.stats && (
        <div id="stats-section" className="vf-fade-in grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Pending Orders"
            value={data.pending_orders}
            icon={ClipboardList}
            tone="blue"
          />

          <StatCard
            label="Total Outstanding"
            value={`₹${data.total_outstanding}`}
            valueClassName="text-red-400"
            icon={Wallet}
            tone="red"
            onClick={() => openSection('dues')}
          />

          <StatCard
            label="Due Reminders Today"
            value={data.due_reminders.length}
            valueClassName={data.due_reminders.length > 0 ? 'text-red-400' : 'text-emerald-400'}
            icon={Bell}
            tone={data.due_reminders.length > 0 ? 'amber' : 'emerald'}
          />

          <StatCard
            label="Today's Orders"
            value={data.today_orders_list.length}
            icon={CalendarDays}
            tone="emerald"
          />

          <StatCard
            label="Low Stock Items"
            value={lowStockCount}
            valueClassName={lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}
            icon={Package}
            tone={lowStockCount > 0 ? 'orange' : 'emerald'}
            onClick={() => openSection('lowStock')}
          />
        </div>
      )}

      {/* ── LOW STOCK ALERTS CONTENT ── */}
      {lowStockCount > 0 && !collapsed.lowStock && (
        <div id="low-stock-section" className="vf-fade-in">
          <SectionCard title="Low Stock Alerts" subtitle="Items that need reordering soon">
            <Table>
              <THead>
                <Th>Category</Th>
                <Th>Item</Th>
                <Th>Remaining</Th>
                <Th>Status</Th>
              </THead>
              <TBody>
                {data.low_stock_alerts.map((item, i) => (
                  <Tr key={i} onClick={() => navigate('/inventory')}>
                    <Td className="text-slate-300">{item.category}</Td>
                    <Td className="font-bold text-white">{item.item_name}</Td>
                    <Td className="text-slate-300">{item.quantity} {item.unit}</Td>
                    <Td>
                      {item.status === 'out' ? (
                        <Badge tone="red" icon={PackageX}>Out of Stock</Badge>
                      ) : (
                        <Badge tone="amber" icon={AlertTriangle}>Low Stock</Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </SectionCard>
        </div>
      )}

      {/* ── TODAY'S ORDERS CONTENT ── */}
      {!collapsed.todayOrders && (
        <div id="today-orders-section" className="vf-fade-in">
          <SectionCard title="Today's Orders" subtitle="Live order queue and payment statuses">
            {data.today_orders_list.length === 0 ? (
              <p className="text-slate-500 text-sm py-2">No orders today yet.</p>
            ) : (
              <Table>
                <THead>
                  <Th>Order ID</Th>
                  <Th>Firm</Th>
                  <Th>Description</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>Balance Due</Th>
                </THead>
                <TBody>
                  {data.today_orders_list.map(o => (
                    <Tr key={o.id} onClick={() => navigate('/orders')}>
                      <Td className="font-mono font-bold text-blue-400">#{o.id}</Td>
                      <Td className="font-semibold text-white">{o.firm_name}</Td>
                      <Td className="text-slate-300">{o.description}</Td>
                      <Td><Badge tone={statusTone(o.status)}>{o.status?.replace('_', ' ')}</Badge></Td>
                      <Td className="font-mono text-slate-200">₹{o.total_amount}</Td>
                      <Td>
                        <span className={`font-mono font-bold ${o.balance_due > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          ₹{o.balance_due}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── DUE PAYMENTS CONTENT ── */}
      {!collapsed.dues && (
        <div id="dues-section" className="vf-fade-in">
          <SectionCard title="Due Payments" subtitle="Clients requiring payment reminders">
            <div className="flex justify-between flex-wrap gap-3 mb-4">
              <input
                type="text"
                placeholder="Search by firm name or phone..."
                value={duesSearch}
                onChange={e => setDuesSearch(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/60 rounded-xl text-sm text-slate-200 placeholder-slate-500 px-3.5 py-2 flex-1 min-w-[220px] max-w-[340px] focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80"
              />
              <div className="flex gap-2 flex-wrap">
                {DUE_FILTERS.map(f => {
                  const FIcon = f.icon
                  const active = dueDateFilter === f.key
                  return (
                    <button
                      key={f.key}
                      onClick={() => setDueDateFilter(f.key)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
                      }`}
                    >
                      <FIcon className="w-3.5 h-3.5" /> {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {filteredDues.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4" /> No dues for this filter.
              </div>
            ) : (
              <Table minWidth="760px">
                <THead>
                  <Th>#</Th>
                  <Th>Firm</Th>
                  <Th>Phone</Th>
                  <Th>Orders Due</Th>
                  <Th>Opening Balance</Th>
                  <Th>Total Due ↓</Th>
                  <Th className="min-w-[120px]">Follow-up</Th>
                  <Th className="min-w-[110px]">Action</Th>
                </THead>
                <TBody>
                  {filteredDues.map((r, i) => {
                    const isOverdue = r.follow_up_date && r.follow_up_date < today
                    const isToday   = r.follow_up_date === today
                    return (
                      <Tr key={r.customer_id} onClick={() => navigate(`/customers/${r.customer_id}`)}>
                        <Td className="text-slate-400">{i + 1}</Td>
                        <Td className="font-bold text-white">{r.firm_name}</Td>
                        <Td className="text-slate-300">{r.phone || '—'}</Td>
                        <Td className="text-slate-300">
                          {r.orders_due > 0
                            ? <>₹{r.orders_due} <span className="text-[11px] text-slate-500">({r.orders_due_count} order{r.orders_due_count !== 1 ? 's' : ''})</span></>
                            : '—'}
                        </Td>
                        <Td className="text-slate-300">
                          {r.opening_balance > 0 ? `₹${r.opening_balance}` : '—'}
                        </Td>
                        <Td>
                          <span className="font-mono font-bold text-base text-red-400">₹{r.total_due}</span>
                        </Td>
                        <Td>
                          {r.follow_up_date ? (
                            <Badge
                              tone={isOverdue ? 'red' : isToday ? 'amber' : 'blue'}
                              icon={isOverdue ? AlertTriangle : isToday ? Bell : undefined}
                            >
                              {r.follow_up_date}
                            </Badge>
                          ) : '—'}
                        </Td>
                        <Td>
                          {r.total_due > 0 && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setWaMessage(waStatus === 'disabled'
                                  ? 'WhatsApp is Disabled in Demo due to security reasons.'
                                  : 'Due Payments ab customer-wise hai — single-order WA reminder yahan se abhi nahi bhej sakte. "Send Statement on WhatsApp" (Customer Profile se) use karo.')
                              }}
                              title={waStatus === 'disabled' ? 'Disabled in Demo due to security reasons' : 'Filhaal is naye customer-wise view se single-order reminder possible nahi'}
                              className="inline-flex items-center gap-1 bg-slate-800 text-slate-500 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] cursor-not-allowed shrink-0"
                            >
                              <Smartphone className="w-3 h-3" /> WA
                            </button>
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </TBody>
                <TFoot>
                  <Tr>
                    <Td colSpan="5" className="font-bold text-white">
                      Total ({filteredDues.length} customer{filteredDues.length !== 1 ? 's' : ''})
                    </Td>
                    <Td className="font-mono font-bold text-base text-red-400">
                      ₹{filteredDues.reduce((s, d) => s + d.total_due, 0)}
                    </Td>
                    <Td colSpan="2"></Td>
                  </Tr>
                </TFoot>
              </Table>
            )}
          </SectionCard>
        </div>
      )}

      {waMessage && (
        <p
          onClick={() => setWaMessage('')}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white px-5 py-2.5 rounded-xl cursor-pointer z-[2000] text-sm shadow-2xl"
        >
          {waMessage}
        </p>
      )}

      <Modal open={!!waSendModal} onClose={() => setWaSendModal(null)} width="380px">
        {waSendModal && (
          <>
            <h3 className="text-white font-bold flex items-center gap-2 mb-1.5">
              <Smartphone className="w-4 h-4" /> Payment Reminder
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              {waSendModal.firm_name} — Order #{waSendModal.order_id}
            </p>
            <p className="text-xs text-red-400 font-bold mb-4 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Balance Due: ₹{waSendModal.balance_due}
            </p>
            <label className="text-xs text-slate-400 block mb-1.5">
              UPI QR bhejna hai? Account select karo:
            </label>
            <select
              value={selectedUpiForWA}
              onChange={e => setSelectedUpiForWA(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm mb-5 focus:outline-none focus:border-blue-500/80"
            >
              <option value="">❌ QR mat bhejo</option>
              {UPI_ACCOUNTS_FOR_WA.map(acc => (
                <option key={acc.upiId} value={acc.upiId}>{acc.label}</option>
              ))}
            </select>
            <div className="flex gap-2.5">
              <SecondaryButton className="flex-1 justify-center py-2.5" onClick={() => setWaSendModal(null)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton
                icon={Send}
                className="flex-1 justify-center py-2.5 !bg-none !bg-[#25D366] hover:!bg-[#20bd5a] !shadow-none"
                onClick={() => {
                  sendBillWhatsApp(waSendModal.order_id, selectedUpiForWA)
                    .then(res => {
                      setWaMessage(res.data.message)
                      setWaSendModal(null)
                    })
                    .catch(err => {
                      setWaMessage('WhatsApp error: ' + (err.response?.data?.error || 'Not connected'))
                      setWaSendModal(null)
                    })
                }}
              >
                Send
              </PrimaryButton>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

// Tone recipe for KpiCard — same colors StatCard/Badge already use elsewhere
// in the app, just kept local since StatCard doesn't export its TONES map.
const KPI_TONES = {
  blue:    { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       value: 'text-white',       bar: 'bg-blue-500/60',    activeBg: 'bg-blue-600/10 border-blue-500/40', ghost: 'text-blue-400/[0.08]' },
  emerald: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', value: 'text-white',    bar: 'bg-emerald-500/60', activeBg: 'bg-emerald-600/10 border-emerald-500/40', ghost: 'text-emerald-400/[0.08]' },
  red:     { badge: 'bg-red-500/10 text-red-400 border-red-500/20',          value: 'text-red-400',     bar: 'bg-red-500/60',     activeBg: 'bg-red-600/10 border-red-500/40', ghost: 'text-red-400/[0.08]' },
  amber:   { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    value: 'text-amber-400',   bar: 'bg-amber-500/60',   activeBg: 'bg-amber-600/10 border-amber-500/40', ghost: 'text-amber-400/[0.08]' },
}

// Headline KPI tile — click toggles the matching accordion section below
// (same openSection/toggleSection behavior the old NavCard had). Chevron
// shows expanded/collapsed state; fixed height + spread content + colored
// ghost icon are the visual upgrade borrowed from the Stitch mock, re-colored
// to the app's existing slate/blue/emerald/amber/red palette.
function KpiCard({ icon: Icon, value, label, sub, tone = 'blue', open, onClick }) {
  const t = KPI_TONES[tone] || KPI_TONES.blue
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden text-left rounded-2xl border p-5 sm:p-6 shadow-lg transition-all duration-300 h-40 sm:h-44 flex flex-col justify-between ${
        open ? t.activeBg : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-xl'
      }`}
    >
      {/* Oversized colored ghost icon, decorative only */}
      <Icon className={`absolute -top-4 -right-4 w-24 h-24 ${t.ghost} pointer-events-none`} />

      <div className="relative flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl border flex items-center justify-center ${t.badge}`}>
          <Icon className="w-4.5 h-4.5" />
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />}
      </div>

      <div className="relative">
        {value !== undefined && <div className={`text-3xl sm:text-4xl font-extrabold font-mono leading-none tracking-tight ${t.value}`}>{value}</div>}
        <div className={`text-sm font-semibold text-slate-200 ${value !== undefined ? 'mt-2' : ''}`}>{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 h-1 ${t.bar} transition-opacity ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}`} />
    </button>
  )
}

// IST hour → "Good morning / afternoon / evening"
function greetingWord(hour) {
  const h = Number(hour)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Open-Meteo weathercode → icon + label (WMO codes)
function weatherInfo(code) {
  if (code === 0) return { icon: Sun, label: 'Clear Sky' }
  if (code === 1 || code === 2) return { icon: Sun, label: 'Partly Cloudy' }
  if (code === 3) return { icon: Cloud, label: 'Overcast' }
  if (code === 45 || code === 48) return { icon: CloudFog, label: 'Foggy' }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: CloudRain, label: 'Rain' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { icon: CloudSnow, label: 'Snow' }
  if ([95, 96, 99].includes(code)) return { icon: CloudLightning, label: 'Thunderstorm' }
  return { icon: Cloud, label: 'Cloudy' }
}

function statusTone(status) {
  const tones = { pending: 'amber', in_progress: 'blue', ready: 'emerald', delivered: 'slate' }
  return tones[status] || 'slate'
}

// Icon + color per Recent Activity event type — backend's `type` field maps
// straight to this. Reuses icons already imported elsewhere in this file
// (no new icon dependencies).
const ACTIVITY_TYPES = {
  order:      { icon: ClipboardList, badge: 'text-blue-400' },
  payment:    { icon: Wallet,        badge: 'text-emerald-400' },
  advance:    { icon: Wallet,        badge: 'text-emerald-400' },
  collection: { icon: Wallet,        badge: 'text-sky-400' },
  cheque:     { icon: CheckCircle2,  badge: 'text-teal-400' },
  whatsapp:   { icon: Smartphone,    badge: 'text-violet-400' },
  inventory:  { icon: Package,       badge: 'text-amber-400' },
  commission: { icon: Wallet,        badge: 'text-orange-400' },
  expense:    { icon: Wallet,        badge: 'text-rose-400' },
}

// Backend now returns a proper ISO instant for created_at (already converted
// server-side — orders/payments/etc. store IST-local text, order_activity_log/
// inventory_log store UTC, and dashboard.js normalizes both before sending).
// So this just needs a plain, direct parse.
function relativeTime(raw) {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.round(diffHr / 24)}d ago`
}

export default Dashboard
