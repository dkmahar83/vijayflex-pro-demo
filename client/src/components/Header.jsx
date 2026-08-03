import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, QrCode, Plus, Bell, LogOut, ChevronDown, X, ShoppingCart, Users, Loader2, AlertTriangle, Package, UserCheck, CheckCheck } from 'lucide-react'
import { getCustomers, getOrders, getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api'

// Sticky top bar: global search box (real — hits the existing Customers +
// Orders search endpoints), a small live clock, Quick Collect + New Order
// shortcuts that jump to the real pages, a notifications bell, and the user
// menu (Sign Out reuses the same confirm dialog as the sidebar's Logout
// button, owned by AppLayout).
//
// Search covers Customers + Orders today because those are the only two
// endpoints that already support server-side `?search=`. Inventory doesn't
// have a matching endpoint yet — see the note flagged separately.

// Clock ke liye seven-segment font — pehle Dashboard ke andar tha jab clock
// hero-panel mein bohot bada tha; ab clock chota hoke yahan (global header)
// aa gaya hai to font bhi isi ke saath yahan aa gayi. Duplicate-safe inject.
const DSEG7_FONT_ID  = 'vf-dseg7-font'
const DSEG7_FONT_URL = 'https://cdn.jsdelivr.net/npm/@fontsource/dseg7-classic@5.2.5/700.css'

// Notification "type" → icon. Severity (high/medium, backend se aata hai)
// color decide karta hai — dono mila ke ek chhota badge banta hai, Dashboard
// ke ACTIVITY_TYPES jaisa hi pattern.
const NOTIF_TYPES = {
  followup:   { icon: AlertTriangle },
  lowstock:   { icon: Package },
  attendance: { icon: UserCheck },
}

function Header({ user, onRequestLogout }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [now, setNow] = useState(new Date())

  const [showResults, setShowResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState({ customers: [], orders: [] })
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  // Notifications — follow-up dues, low stock, aur 10AM attendance reminder,
  // ek hi bell dropdown mein combined. Har 60s pe silently refresh hota hai
  // taaki badge count live rahe.
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifLoading, setNotifLoading] = useState(true)

  const displayName = user?.name || user?.username || 'User'
  const initial = displayName[0]?.toUpperCase() || 'U'

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
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  function fetchNotifications() {
    getNotifications()
      .then(res => {
        setNotifications(res.data.notifications || [])
        setUnreadCount(res.data.unread_count || 0)
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }

  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 60000)
    return () => clearInterval(timer)
  }, [])

  function toggleNotifications() {
    setShowNotifications(o => {
      const next = !o
      if (next) fetchNotifications() // dropdown kholte hi ek fresh check
      return next
    })
  }

  // Optimistic update — turant UI mein reflect hota hai, background mein
  // backend ko bhi bata dete hain. Fail ho bhi jaaye to next 60s refresh
  // (ya dropdown reopen) apne aap sahi kar dega.
  function handleMarkRead(key) {
    setNotifications(prev => prev.map(n => (n.key === key ? { ...n, read: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
    markNotificationRead(key).catch(() => {})
  }

  function handleMarkAllRead() {
    const unreadKeys = notifications.filter(n => !n.read).map(n => n.key)
    if (unreadKeys.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    markAllNotificationsRead(unreadKeys).catch(() => {})
  }

  function handleNotifClick(n) {
    if (!n.read) handleMarkRead(n.key)
    setShowNotifications(false)
    if (n.link) navigate(n.link)
  }

  // Debounced live search — 300ms ruk kar hi API hit karta hai, taaki har
  // keystroke par request na jaaye. Stale-response-safe: agar user ne aage
  // type kar diya, purani (slow) response ka result ignore ho jaata hai.
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const term = search.trim()

    if (term.length < 2) {
      // setState seedha effect-body mein synchronously call karna eslint
      // (react-hooks/set-state-in-effect) flag karta hai — microtask mein
      // defer kiya (weather-effect mein bhi yahi pattern use kiya tha).
      queueMicrotask(() => {
        setResults({ customers: [], orders: [] })
        setSearching(false)
      })
      return
    }

    queueMicrotask(() => setSearching(true))
    debounceRef.current = setTimeout(() => {
      const myRequestId = ++requestIdRef.current
      Promise.all([
        getCustomers(term),
        getOrders({ search: term, page: 1, limit: 5 }),
      ])
        .then(([customersRes, ordersRes]) => {
          if (myRequestId !== requestIdRef.current) return // stale response, drop it
          setResults({
            customers: (customersRes.data || []).slice(0, 5),
            orders: ordersRes.data?.data || [],
          })
        })
        .catch(() => {
          if (myRequestId !== requestIdRef.current) return
          setResults({ customers: [], orders: [] })
        })
        .finally(() => {
          if (myRequestId === requestIdRef.current) setSearching(false)
        })
    }, 300)

    return () => clearTimeout(debounceRef.current)
  }, [search])

  const hasQuery = search.trim().length >= 2
  const hasResults = results.customers.length > 0 || results.orders.length > 0

  function goToCustomer(id) {
    setShowResults(false)
    setSearch('')
    navigate(`/customers/${id}`)
  }

  function goToOrder() {
    setShowResults(false)
    setSearch('')
    navigate('/orders')
  }

  const istParts = (() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(now)
    const get = t => parts.find(p => p.type === t)?.value || '00'
    return { hours: get('hour'), minutes: get('minute'), seconds: get('second') }
  })()

  return (
    <header className="h-16 shrink-0 bg-slate-900/95 backdrop-blur border-b border-slate-800/80 px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          onKeyDown={e => { if (e.key === 'Escape') { setShowResults(false); e.currentTarget.blur() } }}
          placeholder="Search orders, customers..."
          className="w-full bg-slate-800/80 text-slate-200 placeholder-slate-500 text-sm pl-10 pr-9 py-1.5 rounded-xl border border-slate-700/60 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/80 transition-all"
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setShowResults(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {showResults && hasQuery && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />
            <div className="absolute left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 max-h-[420px] overflow-y-auto">
              {searching && (
                <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                </div>
              )}

              {!searching && !hasResults && (
                <div className="text-xs text-slate-500 px-3 py-3">No matches for "{search.trim()}"</div>
              )}

              {!searching && results.customers.length > 0 && (
                <div className="mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-3 pt-1.5 pb-1">Customers</p>
                  {results.customers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => goToCustomer(c.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-700/60 text-left transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{c.firm_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.contact_name} • {c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searching && results.orders.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 px-3 pt-1.5 pb-1">Orders</p>
                  {results.orders.map(o => (
                    <button
                      key={o.id}
                      onClick={goToOrder}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-700/60 text-left transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-200 truncate">{o.firm_name} — {o.description}</p>
                        <p className="text-[11px] text-slate-500 truncate">#{o.order_number || o.id} • ₹{o.total_amount}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Live clock — bold aur bada, blue hard-blink dot ke saath (real LED jaisa on/off snap) */}
      <div className="hidden md:flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2 shrink-0">
        <style>{`
          @keyframes vf-hard-blink {
            0%, 49%  { opacity: 1; }
            50%, 100% { opacity: 0; }
          }
          .vf-blink-dot {
            animation: vf-hard-blink 1.3s linear infinite;
          }
        `}</style>
        <span className="w-2 h-2 rounded-full bg-blue-500 vf-blink-dot shadow-[0_0_8px_2px_rgba(59,130,246,0.55)]" />
        <span
          className="text-xl font-bold text-white tabular-nums leading-none tracking-wide"
          style={{ fontFamily: "'DSEG7 Classic', 'Courier New', monospace" }}
        >
          {istParts.hours}:{istParts.minutes}:{istParts.seconds}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/upi-qr')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 text-xs font-semibold shadow-sm transition-all"
        >
          <QrCode className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Quick Collect</span>
        </button>

        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Order</span>
        </button>

        <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block" />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={toggleNotifications}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 max-h-[440px] flex flex-col">
                <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2 border-b border-slate-700 mb-1 shrink-0">
                  <p className="text-xs font-bold text-slate-200">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {notifLoading && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 px-3 py-4">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
                    </div>
                  )}

                  {!notifLoading && notifications.length === 0 && (
                    <div className="text-xs text-slate-500 px-3 py-6 text-center">No notifications right now.</div>
                  )}

                  {!notifLoading && notifications.map(n => {
                    const nt = NOTIF_TYPES[n.type] || NOTIF_TYPES.followup
                    const NIcon = nt.icon
                    const tone = n.severity === 'high' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'
                    return (
                      <div
                        key={n.key}
                        onClick={() => handleNotifClick(n)}
                        className="flex items-start gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-slate-700/60 cursor-pointer transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                          <NIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                            <p className={`text-xs font-bold truncate ${n.read ? 'text-slate-400' : 'text-slate-100'}`}>{n.title}</p>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{n.subtitle}</p>
                        </div>
                        {!n.read && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMarkRead(n.key) }}
                            title="Mark as read"
                            className="shrink-0 text-[10px] font-semibold text-blue-400 hover:text-blue-300 mt-0.5"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(o => !o)}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold border border-slate-600">
              {initial}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <>
              {/* click-away layer */}
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-700 mb-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-400">Admin</p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); onRequestLogout() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header