import { useState, useEffect, useLayoutEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  QrCode,
  ShoppingCart,
  Users,
  MessageSquare,
  UserCheck,
  Landmark,
  Package,
  BarChart2,
  Trash2,
  Printer,
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Wallet,
  ClipboardList,
} from 'lucide-react'
import BackupManager from './BackupManager'

const groups = [
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Landmark,
    items: [
      { path: '/reports',   label: 'Reports',   icon: BarChart2 },
      { path: '/accounts',  label: 'Accounts',  icon: Wallet    },
      { path: '/employees', label: 'Employees', icon: UserCheck  },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: TrendingUp,
    items: [
      { path: '/daily-sales', label: 'Sales',   icon: TrendingUp },
      { path: '/upi-qr',      label: 'UPI QR',  icon: QrCode     },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & CRM',
    icon: ShoppingCart,
    items: [
      { path: '/orders',    label: 'Orders',    icon: ClipboardList },
      { path: '/customers', label: 'Customers', icon: Users         },
      { path: '/whatsapp',  label: 'WA Setup',  icon: MessageSquare },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: Package,
    items: [
      { path: '/inventory', label: 'Inventory', icon: Package },
      { path: '/bin',       label: 'Bin',       icon: Trash2  },
    ],
  },
]

// Matches the Stitch reference exactly: 256px expanded / 64px collapsed rail.
const RAIL_WIDTH = 64
const FULL_WIDTH = 256

function Navbar({ user, onRequestLogout, onLayoutChange }) {
  const location = useLocation()

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)   // PC: open by default
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)   // Mobile: closed by default (icon rail only)

  const expanded = isMobile ? mobileDrawerOpen : !desktopCollapsed

  const defaultOpen = groups.reduce((acc, g) => {
    acc[g.id] = g.items.some(i => i.path === location.pathname)
    return acc
  }, {})
  const [openGroups, setOpenGroups] = useState(defaultOpen)

  // Track viewport size — debounced. Continuous resize-drag ke dauraan browser
  // bahut saare resize events fire karta hai; har event pe turant setIsMobile
  // karne se baar-baar transition re-trigger hota tha, jo resize ke exact
  // moment mein transient visual glitch (labels overlap/blend) create karta
  // tha. Ab sirf resize thoda ruk jaane ke baad (120ms) state update hoga.
  useEffect(() => {
    let timeoutId
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 768)
      }, 120)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  // Tell App.jsx how much left-margin the main content needs.
  // Mobile drawer floats OVER content (overlay) so margin stays at rail width.
  // useLayoutEffect (na ki useEffect) — ye paint se PEHLE synchronously chalta
  // hai, isliye sidebar-width aur content-margin hamesha ek hi frame mein
  // sync ho jaate hain. useEffect se ek frame ka gap aata tha (sidebar width
  // badal chuki, margin abhi purana) — usi stale-frame ke dauraan resize ke
  // waqt text (jaise "Accounts") gayab/glitch dikhta tha.
  useLayoutEffect(() => {
    const margin = isMobile ? RAIL_WIDTH : (desktopCollapsed ? RAIL_WIDTH : FULL_WIDTH)
    onLayoutChange?.(margin)
  }, [isMobile, desktopCollapsed, onLayoutChange])

  const toggleSidebar = () => {
    if (isMobile) setMobileDrawerOpen(o => !o)
    else setDesktopCollapsed(c => !c)
  }

  const toggleGroup = (id) => {
    if (!expanded) {
      // Collapsed: expand sidebar first, then open this group
      if (isMobile) setMobileDrawerOpen(true)
      else setDesktopCollapsed(false)
      setOpenGroups(prev => ({ ...prev, [id]: true }))
      return
    }
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const isActive = path => location.pathname === path
  const closeMobileDrawer = () => { if (isMobile) setMobileDrawerOpen(false) }

  const navLinkClasses = (active) => `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 relative whitespace-nowrap ${
    active
      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
  }`

  return (
    <>
      {/* Backdrop only when mobile drawer is open (overlay mode) */}
      {isMobile && mobileDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-[299]" onClick={() => setMobileDrawerOpen(false)} />
      )}

      <div
        className="fixed top-0 left-0 bottom-0 bg-slate-900 border-r border-slate-800 flex flex-col z-[300] shadow-2xl overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ width: expanded ? FULL_WIDTH : RAIL_WIDTH }}
      >
        {/* Brand + collapse toggle */}
        <div className={`flex items-center border-b border-slate-800/80 ${
          expanded ? 'gap-3 p-5' : 'flex-col gap-2 py-4 px-2'
        }`}>
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Printer className="w-5 h-5" />
          </div>
          {expanded && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-lg tracking-tight whitespace-nowrap">VijayFlex</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Pro</span>
              </div>
              <p className="text-xs text-slate-400 whitespace-nowrap">Flex &amp; POS Terminal</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg p-1 shrink-0 transition-all"
            aria-label="Toggle sidebar"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Dashboard link */}
        <div className="p-3 pb-0">
          <Link
            to="/"
            className={navLinkClasses(isActive('/')) + (expanded ? '' : ' justify-center px-0')}
            onClick={closeMobileDrawer}
            title="Dashboard"
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${isActive('/') ? 'text-blue-400' : 'text-slate-400'}`} />
            {expanded && <span>Dashboard</span>}
          </Link>
        </div>

        {/* Nav Groups */}
        <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-0.5">
          {groups.map(group => {
            const GroupIcon = group.icon
            const isGroupOpen = expanded && !!openGroups[group.id]
            const hasActive = group.items.some(i => isActive(i.path))

            return (
              <div key={group.id} className="mb-0.5">
                <button
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                  title={group.label}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-transparent text-[11px] font-bold uppercase tracking-wide transition-all ${
                    expanded ? '' : 'justify-center px-0'
                  } ${hasActive ? 'text-slate-300' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <GroupIcon className="w-4 h-4 shrink-0 opacity-70" />
                  {expanded && <span className="flex-1 text-left">{group.label}</span>}
                  {expanded && (isGroupOpen
                    ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    : <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />)}
                </button>

                {isGroupOpen && (
                  <div className="flex flex-col gap-0.5 mb-1">
                    {group.items.map(item => {
                      const ItemIcon = item.icon
                      const active = isActive(item.path)
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={navLinkClasses(active) + ' pl-8 text-[13px] py-2'}
                          onClick={closeMobileDrawer}
                        >
                          <ItemIcon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom: user + actions */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 flex flex-col gap-2">
          <div className={`flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 ${expanded ? '' : 'justify-center'}`}>
            <div className="w-9 h-9 shrink-0 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            {expanded && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name || user?.username}</div>
                <div className="text-[11px] text-slate-400">Admin</div>
              </div>
            )}
          </div>

          {expanded && <BackupManager />}

          <button
            onClick={onRequestLogout}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all ${
              expanded ? '' : 'justify-center'
            }`}
            title="Logout"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && 'Logout'}
          </button>
        </div>
      </div>
    </>
  )
}

export default Navbar