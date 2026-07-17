import { useState, useEffect } from 'react'
import { getDashboard, sendBillWhatsApp, getWhatsAppStatus } from '../services/api'
import { useNavigate } from 'react-router-dom'
import SectionLoader from '../components/SectionLoader'
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
  BarChart3,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  MapPin,
  Printer,
} from 'lucide-react'

// Clock ke liye seven-segment font — sirf hero-clock par use hota hai,
// kahin aur typography nahi badalti. Font CDN se load hoti hai (koi local
// file download nahi chahiye, koi bundler-resolve bhi nahi chahiye).
const DSEG7_FONT_ID  = 'vf-dseg7-font'
const DSEG7_FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/dseg7-classic@5.2.5/700.css'
const DSEG7_STACK    = "'DSEG7 Classic', 'Courier New', monospace"

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
  const navigate = useNavigate()

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

  // Clock-font ko document head mein ek baar inject karo (CDN link).
  // Duplicate-safe hai — agar pehle se present hai to dobara nahi daalega.
  useEffect(() => {
    if (!document.getElementById(DSEG7_FONT_ID)) {
      const link = document.createElement('link')
      link.id = DSEG7_FONT_ID
      link.rel = 'stylesheet'
      link.href = DSEG7_FONT_URL
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    getDashboard()
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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

  // Weather + location — browser geolocation, phir 2 free no-key APIs:
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
  if (!data)   return <p style={{ padding: '20px' }}>Could not load dashboard.</p>

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

  return (
    <div style={styles.page}>
      {/* Hover / fade-in animations — sirf yahi component ke liye scoped
          (vf- prefix), baaki app ki styling se koi conflict nahi. */}
      <style>{`
        .vf-nav-card {
          transition: transform .22s cubic-bezier(.4,0,.2,1), box-shadow .22s ease, border-color .22s ease;
        }
        .vf-nav-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 30px rgba(0,0,0,0.28);
          border-color: rgba(255,255,255,0.28);
        }
        .vf-nav-card-active:hover {
          box-shadow: 0 16px 30px rgba(0,0,0,0.16);
          border-color: rgba(233,69,96,0.35);
        }
        @keyframes vfFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vf-fade-in { animation: vfFadeIn .35s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .vf-nav-card, .vf-fade-in { transition: none; animation: none; }
        }
      `}</style>

      {/* ── HERO PANEL — world-time-card style: full-width dominant digital
          clock, edge-to-edge timeline, date, weather+location, aur ek
          branded photo-panel (right side). ── */}
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.heroBrandRow}>
            <Printer size={14} />
            <span>VIJAYFLEX PRO</span>
            <span style={styles.liveDot} />
            <span style={styles.liveText}>LIVE</span>
          </div>

          <div style={styles.heroTimeRow}>
            <span>{istParts.hours}</span>
            <span style={styles.heroColon}>:</span>
            <span>{istParts.minutes}</span>
            <span style={styles.heroColon}>:</span>
            <span>{istParts.seconds}</span>
          </div>

          {/* Day progress bar — 24-ghante ka visual, current time ka marker.
              Reference ke timeline-line ka single-dashboard adaptation, edge-to-edge. */}
          <div style={styles.dayProgressWrap}>
            <div style={styles.dayProgressTrack}>
              <div style={{ ...styles.dayProgressFill, width: `${dayProgressPct}%` }} />
              <div style={{ ...styles.dayProgressDot, left: `${dayProgressPct}%` }} />
            </div>
            <div style={styles.dayProgressLabels}>
              <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
            </div>
          </div>

          <div style={styles.heroDateRow}>
            <div>
              <div style={styles.heroDay}>{dayName}</div>
              <div style={styles.heroDate}>{dateShort}</div>
            </div>

            {weather && wInfo && WeatherIcon && (
              <div style={styles.heroWeather}>
                <WeatherIcon size={17} />
                <span>{Math.round(weather.temperature)}°C</span>
                <span style={{ opacity: 0.6, fontWeight: 400 }}>{wInfo.label}</span>
                {locationName && (
                  <span style={styles.heroLocation}>
                    <MapPin size={12} /> {locationName}
                  </span>
                )}
              </div>
            )}
            {!weather && weatherError && (
              <div style={styles.heroWeatherMuted}>
                <MapPin size={12} /> {weatherError}
              </div>
            )}
          </div>

          {/* NAV CARDS — Summary Stats / Low Stock / Today's Orders / Due Payments.
              Reference ke timezone-cards jaisa premium glass look. Click =
              accordion open + smooth scroll; doosra khula ho to woh band ho jaata hai. */}
          <div style={styles.navGrid}>
            <button
              onClick={() => toggleSection('stats')}
              className={`vf-nav-card ${!collapsed.stats ? 'vf-nav-card-active' : ''}`}
              style={{ ...styles.navCard, ...(!collapsed.stats ? styles.navCardActive : {}) }}
            >
              <div style={styles.navCardTop}>
                <div style={{ ...styles.navCardIconWrap, ...(!collapsed.stats ? styles.navCardIconWrapActive : {}) }}>
                  <BarChart3 size={17} />
                </div>
                {!collapsed.stats ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              <div style={styles.navCardLabel}>Summary Stats</div>
              <div style={styles.navCardSub}>Full business overview</div>
            </button>

            {lowStockCount > 0 && (
              <button
                onClick={() => toggleSection('lowStock')}
                className={`vf-nav-card ${!collapsed.lowStock ? 'vf-nav-card-active' : ''}`}
                style={{ ...styles.navCard, ...(!collapsed.lowStock ? styles.navCardActive : {}) }}
              >
                <div style={styles.navCardTop}>
                  <div style={{ ...styles.navCardIconWrap, ...(!collapsed.lowStock ? styles.navCardIconWrapActive : {}) }}>
                    <Package size={17} />
                  </div>
                  {!collapsed.lowStock ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </div>
                <div style={styles.navCardValue}>{lowStockCount}</div>
                <div style={styles.navCardLabel}>Low Stock Alerts</div>
              </button>
            )}

            <button
              onClick={() => toggleSection('todayOrders')}
              className={`vf-nav-card ${!collapsed.todayOrders ? 'vf-nav-card-active' : ''}`}
              style={{ ...styles.navCard, ...(!collapsed.todayOrders ? styles.navCardActive : {}) }}
            >
              <div style={styles.navCardTop}>
                <div style={{ ...styles.navCardIconWrap, ...(!collapsed.todayOrders ? styles.navCardIconWrapActive : {}) }}>
                  <ClipboardList size={17} />
                </div>
                {!collapsed.todayOrders ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              <div style={styles.navCardValue}>{data.today_orders_list.length}</div>
              <div style={styles.navCardLabel}>Today's Orders</div>
            </button>

            <button
              id="dues-nav-card"
              onClick={() => toggleSection('dues')}
              className={`vf-nav-card ${!collapsed.dues ? 'vf-nav-card-active' : ''}`}
              style={{ ...styles.navCard, ...(!collapsed.dues ? styles.navCardActive : {}) }}
            >
              <div style={styles.navCardTop}>
                <div style={{ ...styles.navCardIconWrap, ...(!collapsed.dues ? styles.navCardIconWrapActive : {}) }}>
                  <Wallet size={17} />
                </div>
                {!collapsed.dues ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </div>
              <div style={styles.navCardValue}>{allDues.length}</div>
              <div style={styles.navCardLabel}>Due Payments</div>
            </button>
          </div>
        </div>

        {/* Branded photo-panel. Real shop-photo daalni ho to yahan
            background/img replace kar dena — abhi placeholder-branding hai. */}
        <div style={styles.heroRight}>
          {/* REAL SHOP PHOTO: yahan <img src="/shop-photo.jpg" style={styles.heroPhotoImg} /> daalo agar chahiye */}
          <div style={styles.heroPhotoIconWrap}>
            <Printer size={30} />
          </div>
          <div style={styles.heroPhotoBrand}>VijayFlex Pro</div>
          <div style={styles.heroPhotoTagline}>Flex &nbsp;•&nbsp; Print &nbsp;•&nbsp; Signage</div>
        </div>
      </div>

      {/* ── SUMMARY STATS CONTENT ── */}
      {!collapsed.stats && (
        <div style={styles.statsRow} id="stats-section" className="vf-fade-in">
          <div style={{ ...styles.card, borderLeft: '4px solid #3498db' }}>
            <div style={{ ...styles.cardIconCircle, backgroundColor: '#eaf4fd', color: '#3498db' }}>
              <ClipboardList size={18} />
            </div>
            <div style={styles.cardNumber}>{data.pending_orders}</div>
            <div style={styles.cardLabel}>Pending Orders</div>
          </div>

          <div
            style={{ ...styles.card, borderLeft: '4px solid #e74c3c', cursor: 'pointer' }}
            onClick={() => openSection('dues')}
          >
            <div style={{ ...styles.cardIconCircle, backgroundColor: '#fdecea', color: '#e74c3c' }}>
              <Wallet size={18} />
            </div>
            <div style={{ ...styles.cardNumber, color: '#e74c3c' }}>₹{data.total_outstanding}</div>
            <div style={styles.cardLabel}>Total Outstanding</div>
          </div>

          <div style={{ ...styles.card, borderLeft: `4px solid ${data.due_reminders.length > 0 ? '#f39c12' : '#27ae60'}` }}>
            <div style={{ ...styles.cardIconCircle, backgroundColor: data.due_reminders.length > 0 ? '#fff4e5' : '#eafaf1', color: data.due_reminders.length > 0 ? '#f39c12' : '#27ae60' }}>
              <Bell size={18} />
            </div>
            <div style={{ ...styles.cardNumber, color: data.due_reminders.length > 0 ? '#e74c3c' : '#27ae60' }}>
              {data.due_reminders.length}
            </div>
            <div style={styles.cardLabel}>Due Reminders Today</div>
          </div>

          <div style={{ ...styles.card, borderLeft: '4px solid #27ae60' }}>
            <div style={{ ...styles.cardIconCircle, backgroundColor: '#eafaf1', color: '#27ae60' }}>
              <CalendarDays size={18} />
            </div>
            <div style={styles.cardNumber}>{data.today_orders_list.length}</div>
            <div style={styles.cardLabel}>Today's Orders</div>
          </div>

          <div
            style={{ ...styles.card, borderLeft: `4px solid ${lowStockCount > 0 ? '#e67e22' : '#27ae60'}`, cursor: 'pointer' }}
            onClick={() => openSection('lowStock')}
          >
            <div style={{ ...styles.cardIconCircle, backgroundColor: lowStockCount > 0 ? '#fdf2e9' : '#eafaf1', color: lowStockCount > 0 ? '#e67e22' : '#27ae60' }}>
              <Package size={18} />
            </div>
            <div style={{ ...styles.cardNumber, color: lowStockCount > 0 ? '#e74c3c' : '#27ae60' }}>
              {lowStockCount}
            </div>
            <div style={styles.cardLabel}>Low Stock Items</div>
          </div>
        </div>
      )}

      {/* ── LOW STOCK ALERTS CONTENT ── */}
      {lowStockCount > 0 && !collapsed.lowStock && (
        <div style={styles.section} id="low-stock-section" className="vf-fade-in">
          <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>Remaining</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_alerts.map((item, i) => (
                <tr key={i} style={styles.tr}
                  onClick={() => navigate('/inventory')}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={styles.td}>{item.category}</td>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{item.item_name}</td>
                  <td style={styles.td}>{item.quantity} {item.unit}</td>
                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                    <span style={{
                      ...styles.badge,
                      backgroundColor: item.status === 'out' ? '#e74c3c' : '#f39c12',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      {item.status === 'out' ? <PackageX size={12} /> : <AlertTriangle size={12} />}
                      {item.status === 'out' ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ── TODAY'S ORDERS CONTENT ── */}
      {!collapsed.todayOrders && (
        <div style={styles.section} id="today-orders-section" className="vf-fade-in">
          {data.today_orders_list.length === 0 ? (
            <p style={{ color: '#888' }}>No orders today yet.</p>
          ) : (
            <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Order ID</th>
                  <th style={styles.th}>Firm</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {data.today_orders_list.map(o => (
                  <tr key={o.id} style={styles.tr}
                    onClick={() => navigate('/orders')}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <td style={styles.td}>#{o.id}</td>
                    <td style={styles.td}>{o.firm_name}</td>
                    <td style={styles.td}>{o.description}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                      <span style={{ ...styles.badge, backgroundColor: statusColor(o.status) }}>
                        {o.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={styles.td}>₹{o.total_amount}</td>
                    <td style={styles.td}>
                      <span style={{ color: o.balance_due > 0 ? '#e74c3c' : '#27ae60', fontWeight: 'bold' }}>
                        ₹{o.balance_due}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* ── DUE PAYMENTS CONTENT ── */}
      {!collapsed.dues && (
        <div style={styles.section} id="dues-section" className="vf-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search by firm name or phone..."
              value={duesSearch}
              onChange={e => setDuesSearch(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', minWidth: '240px', flex: '1 1 240px', maxWidth: '340px' }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'overdue', label: 'Overdue',   icon: AlertTriangle },
                { key: 'today',   label: 'Today',      icon: Bell },
                { key: 'week',    label: 'This Week',  icon: CalendarDays },
                { key: 'all',     label: 'All',        icon: ListFilter }
              ].map(f => {
                const FIcon = f.icon
                return (
                  <button key={f.key}
                    onClick={() => setDueDateFilter(f.key)}
                    style={{
                      padding: '6px 14px', borderRadius: '6px', border: '1px solid #ddd',
                      backgroundColor: dueDateFilter === f.key ? '#1a1a2e' : '#fff',
                      color: dueDateFilter === f.key ? '#fff' : '#555',
                      cursor: 'pointer', fontSize: '13px', fontWeight: dueDateFilter === f.key ? 'bold' : 'normal',
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <FIcon size={13} /> {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          {filteredDues.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#888', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} /> No dues for this filter.
            </div>
          ) : (
            <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Firm</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Orders Due</th>
                  <th style={styles.th}>Opening Balance</th>
                  <th style={styles.th}>Total Due ↓</th>
                  <th style={{ ...styles.th, minWidth: '120px' }}>Follow-up</th>
                  <th style={{ ...styles.th, minWidth: '170px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDues.map((r, i) => {
                  const isOverdue = r.follow_up_date && r.follow_up_date < today
                  const isToday   = r.follow_up_date === today
                  return (
                    <tr key={r.customer_id}
                      style={styles.tr}
                      onClick={() => navigate(`/customers/${r.customer_id}`)}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isOverdue ? '#fff8f8' : '#fff'}
                    >
                      <td style={styles.td}>{i + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{r.firm_name}</td>
                      <td style={styles.td}>{r.phone || '—'}</td>
                      <td style={styles.td}>
                        {r.orders_due > 0
                          ? <>₹{r.orders_due} <span style={{ fontSize: '12px', color: '#888' }}>({r.orders_due_count} order{r.orders_due_count !== 1 ? 's' : ''})</span></>
                          : '—'}
                      </td>
                      <td style={styles.td}>
                        {r.opening_balance > 0 ? `₹${r.opening_balance}` : '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#e74c3c' }}>
                          ₹{r.total_due}
                        </span>
                      </td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                        {r.follow_up_date ? (
                          <span style={{
                            padding: '3px 8px', borderRadius: '10px', fontSize: '12px',
                            backgroundColor: isOverdue ? '#fff0f0' : isToday ? '#fff8e1' : '#f0f8ff',
                            color: isOverdue ? '#e74c3c' : isToday ? '#f39c12' : '#3498db',
                            fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            {isOverdue ? <AlertTriangle size={11} /> : isToday ? <Bell size={11} /> : null}
                            {r.follow_up_date}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                        <div style={styles.actionsCell}>
                          {r.total_due > 0 && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setWaMessage(waStatus === 'disabled'
                                  ? 'WhatsApp is Disabled in Demo due to security reasons.'
                                  : 'Due Payments ab customer-wise hai — single-order WA reminder yahan se abhi nahi bhej sakte. "Send Statement on WhatsApp" (Customer Profile se) use karo.')
                              }}
                              style={{
                                backgroundColor: '#f5f5f5', color: '#aaa', border: '1px solid #ddd',
                                padding: '4px 10px', borderRadius: '4px', cursor: 'not-allowed',
                                fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                flexShrink: 0
                              }}
                              title={waStatus === 'disabled' ? 'Disabled in Demo due to security reasons' : 'Filhaal is naye customer-wise view se single-order reminder possible nahi'}
                            >
                              <Smartphone size={12} /> WA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8f8f8' }}>
                  <td colSpan="5" style={{ ...styles.td, fontWeight: 'bold' }}>
                    Total ({filteredDues.length} customer{filteredDues.length !== 1 ? 's' : ''})
                  </td>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: '#e74c3c', fontSize: '16px' }}>
                    ₹{filteredDues.reduce((s, d) => s + d.total_due, 0)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>
      )}

    {waMessage && (
        <p
          onClick={() => setWaMessage('')}
          style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#1a1a2e', color: '#fff', padding: '10px 20px',
            borderRadius: '8px', cursor: 'pointer', zIndex: 2000, fontSize: '14px' }}
        >
          {waMessage}
        </p>
      )}

      {waSendModal && (
        <div
          onClick={() => setWaSendModal(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '28px',
              width: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '6px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Smartphone size={16} /> Payment Reminder
            </h3>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
              {waSendModal.firm_name} — Order #{waSendModal.order_id}
            </p>
            <p style={{ fontSize: '13px', color: '#e74c3c', marginBottom: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} /> Balance Due: ₹{waSendModal.balance_due}
            </p>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>
              UPI QR bhejna hai? Account select karo:
            </label>
            <select
              value={selectedUpiForWA}
              onChange={e => setSelectedUpiForWA(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px',
                border: '1px solid #ddd', fontSize: '14px', marginBottom: '20px' }}
            >
              <option value="">❌ QR mat bhejo</option>
              {[
                { label: 'Demo UPI Account 1', upiId: 'demo1@upi' },
                { label: 'Demo UPI Account 2', upiId: 'demo2@upi' },
                { label: 'Demo UPI Account 3', upiId: 'demo3@upi' },
                { label: 'Demo UPI Account 4', upiId: 'demo4@upi' }
              ].map(acc => (
                <option key={acc.upiId} value={acc.upiId}>{acc.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setWaSendModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px',
                  border: '1px solid #ddd', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: '14px' }}
              >Cancel</button>
              <button
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
                style={{ flex: 1, padding: '10px', borderRadius: '6px',
                  border: 'none', backgroundColor: '#25D366', color: '#fff',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              ><Send size={14} /> Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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

function statusColor(status) {
  const colors = { pending: '#f39c12', in_progress: '#3498db', ready: '#27ae60', delivered: '#95a5a6' }
  return colors[status] || '#ccc'
}

const styles = {
  // Poora page apni parent-scroll ke andar available height fill kare —
  // neeche khali white/blank patti na bache. Apne actual top-navbar/outer
  // padding ke hisaab se "64px" ko adjust kar lena (0 bhi kar sakte ho
  // agar koi top navbar nahi hai).
  page: { minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' },

  // ── HERO ──
  hero: {
    display: 'flex', gap: '32px', flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #1a1a2e, #23233f)',
    borderRadius: '24px', padding: '40px 44px',
    boxShadow: '0 10px 32px rgba(26,26,46,0.22)',
    marginBottom: '28px',
  },
  heroLeft: { flex: '1 1 460px', display: 'flex', flexDirection: 'column' },
  heroBrandRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', fontWeight: '700', letterSpacing: '1.2px',
    color: 'rgba(255,255,255,0.55)', marginBottom: '22px',
  },
  liveDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#27ae60', marginLeft: '10px' },
  liveText: { color: '#27ae60', letterSpacing: '1px' },
  // Clock — reference jaisa full-width, dominant, seven-segment look.
  // Yehi ek jagah hai jahan typography badli hai (DSEG7 Classic Bold).
  heroTimeRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%',
    fontSize: 'clamp(46px, 9.5vw, 160px)', fontWeight: '700', color: '#fff',
    fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: '26px',
    fontFamily: DSEG7_STACK, letterSpacing: '0.01em',
  },
  heroColon: { color: 'rgba(255,255,255,0.28)', fontWeight: '700' },
  dayProgressWrap: { marginBottom: '20px' },
  dayProgressTrack: {
    position: 'relative', height: '6px', borderRadius: '3px',
    backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: '6px',
  },
  dayProgressFill: {
    position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: '3px',
    background: 'linear-gradient(90deg, #27ae60, #7fd3ff)',
  },
  dayProgressDot: {
    position: 'absolute', top: '50%', width: '12px', height: '12px', borderRadius: '50%',
    backgroundColor: '#fff', transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 0 4px rgba(255,255,255,0.15)',
  },
  dayProgressLabels: {
    display: 'flex', justifyContent: 'space-between', fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
  },
  heroDateRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    flexWrap: 'wrap', gap: '14px', paddingBottom: '24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '22px',
  },
  heroDay:  { fontSize: '19px', fontWeight: '700', color: '#fff' },
  heroDate: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
  heroWeather: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', fontWeight: '600', color: '#fff' },
  heroWeatherMuted: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' },
  heroLocation: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#7fd3ff', fontWeight: '500', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.2)', marginLeft: '2px' },
  navGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
  },
  // Premium glass cards — reference ke timezone-cards jaisa.
  navCard: {
    display: 'flex', flexDirection: 'column', gap: '10px',
    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '18px', padding: '18px 20px', cursor: 'pointer',
    color: 'rgba(255,255,255,0.85)', fontFamily: 'inherit', textAlign: 'left',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
  },
  navCardActive: {
    backgroundColor: 'rgba(255,255,255,0.96)', color: '#1a1a2e', border: '1px solid rgba(255,255,255,0.9)',
  },
  navCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navCardIconWrap: {
    width: '34px', height: '34px', borderRadius: '9px', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff',
  },
  navCardIconWrapActive: { backgroundColor: '#1a1a2e', color: '#fff' },
  navCardValue: { fontSize: '28px', fontWeight: '800', lineHeight: 1 },
  navCardLabel: { fontSize: '13px', fontWeight: '600' },
  navCardSub: { fontSize: '11px', opacity: 0.55, marginTop: '-4px' },
  heroRight: {
    flex: '0 1 240px', minWidth: '200px',
    background: 'linear-gradient(160deg, #e94560, #c81d4f)',
    borderRadius: '20px', padding: '24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', gap: '6px',
  },
  heroPhotoImg: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' },
  heroPhotoIconWrap: {
    width: '56px', height: '56px', borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '8px',
  },
  heroPhotoBrand: { fontSize: '17px', fontWeight: '700', color: '#fff' },
  heroPhotoTagline: { fontSize: '11px', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.5px' },

  // ── STAT CARDS ──
  statsRow:   { display: 'flex', gap: '16px', marginBottom: '30px', flexWrap: 'wrap' },
  card:       { backgroundColor: '#fff', borderRadius: '10px', padding: '20px 22px', minWidth: '170px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', textAlign: 'left' },
  cardIconCircle: { width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' },
  cardNumber: { fontSize: '26px', fontWeight: 'bold', color: '#1a1a2e' },
  cardLabel:  { fontSize: '13px', color: '#888', marginTop: '4px' },

  // ── SECTIONS / TABLES ──
  section:    { marginBottom: '30px' },
  tableScroll: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table:      { width: '100%', minWidth: '600px', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  th:         { padding: '12px 16px', textAlign: 'left', backgroundColor: '#f8f8f8', fontSize: '13px', color: '#555', borderBottom: '1px solid #eee' },
  td:         { padding: '12px 16px', fontSize: '14px', borderBottom: '1px solid #f0f0f0' },
  tr:         { backgroundColor: '#fff', cursor: 'pointer' },
  badge:      { padding: '3px 10px', borderRadius: '12px', color: '#fff', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-block' },
  actionsCell: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap', whiteSpace: 'nowrap' },
}

export default Dashboard