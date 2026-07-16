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

const RAIL_WIDTH = 64
const FULL_WIDTH = 220

function Navbar({ user, onLogout, onLayoutChange }) {
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
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

  return (
    <>
      {/* Backdrop only when mobile drawer is open (overlay mode) */}
      {isMobile && mobileDrawerOpen && (
        <div style={styles.overlay} onClick={() => setMobileDrawerOpen(false)} />
      )}

      <div style={{ ...styles.sidebar, width: expanded ? FULL_WIDTH : RAIL_WIDTH }}>
        {/* Brand + collapse toggle */}
        <div style={styles.brand}>
          <Printer size={22} color="#e94560" style={{ flexShrink: 0 }} />
          {expanded && <span style={styles.brandText}>VijayFlex Pro</span>}
          <button
            onClick={toggleSidebar}
            style={{ ...styles.collapseBtn, marginLeft: expanded ? 'auto' : 0 }}
            aria-label="Toggle sidebar"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Dashboard link */}
        <div style={styles.dashboardWrap}>
          <Link
            to="/"
            style={{
              ...styles.navLink,
              ...(expanded ? {} : styles.navLinkCollapsed),
              ...(isActive('/') ? styles.navLinkActive : {}),
            }}
            onClick={closeMobileDrawer}
            title="Dashboard"
          >
            <LayoutDashboard size={18} style={styles.linkIcon} />
            {expanded && <span>Dashboard</span>}
            {expanded && isActive('/') && <span style={styles.activeDot} />}
          </Link>
        </div>

        {/* Nav Groups */}
        <style>{`
          .navlinks-scroll { scrollbar-width: none; -ms-overflow-style: none; }
          .navlinks-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <nav className="navlinks-scroll" style={styles.navLinks}>
          {groups.map(group => {
            const GroupIcon = group.icon
            const isGroupOpen = expanded && !!openGroups[group.id]
            const hasActive = group.items.some(i => isActive(i.path))

            return (
              <div key={group.id} style={styles.group}>
                <button
                  style={{
                    ...styles.groupHeader,
                    ...(expanded ? {} : styles.groupHeaderCollapsed),
                    ...(hasActive ? styles.groupHeaderActive : {}),
                  }}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                  title={group.label}
                >
                  <GroupIcon size={16} style={styles.groupIcon} />
                  {expanded && <span style={styles.groupLabel}>{group.label}</span>}
                  {expanded && (isGroupOpen
                    ? <ChevronDown size={13} style={styles.chevron} />
                    : <ChevronRight size={13} style={styles.chevron} />)}
                </button>

                {isGroupOpen && (
                  <div style={styles.groupItems}>
                    {group.items.map(item => {
                      const ItemIcon = item.icon
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          style={{
                            ...styles.navLink,
                            ...styles.childLink,
                            ...(isActive(item.path) ? styles.navLinkActive : {}),
                          }}
                          onClick={closeMobileDrawer}
                        >
                          <ItemIcon size={15} style={styles.linkIcon} />
                          <span>{item.label}</span>
                          {isActive(item.path) && <span style={styles.activeDot} />}
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
        <div style={styles.sidebarBottom}>
          <div style={{ ...styles.userRow, justifyContent: expanded ? 'flex-start' : 'center' }}>
            <div style={styles.userAvatar}>
              {(user?.name || user?.username || 'U')[0].toUpperCase()}
            </div>
            {expanded && (
              <div>
                <div style={styles.userName}>{user?.name || user?.username}</div>
                <div style={styles.userRole}>Admin</div>
              </div>
            )}
          </div>

          {expanded && (
            <div style={styles.bottomActions}>
              <BackupManager />
            </div>
          )}

          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{ ...styles.logoutBtn, justifyContent: expanded ? 'flex-start' : 'center' }}
            title="Logout"
          >
            <LogOut size={16} style={{ marginRight: expanded ? 6 : 0 }} />
            {expanded && 'Logout'}
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div
          onClick={() => setShowLogoutConfirm(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
              width: '340px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <h3 style={{ marginBottom: '10px', color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogOut size={17} /> Logout Karna Hai?
            </h3>
            <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
              Dobara login karna padega session shuru karne ke liye.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout() }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #800000', backgroundColor: '#800000', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 299,
  },
  sidebar: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    backgroundColor: '#1a1a2e',
    display: 'flex', flexDirection: 'column',
    zIndex: 300, boxShadow: '2px 0 12px rgba(0,0,0,0.2)',
    transition: 'width 0.2s ease', overflow: 'hidden',
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '20px 14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  brandText: {
    color: '#fff', fontSize: '17px', fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
  collapseBtn: {
    background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9aa3b0',
    cursor: 'pointer', borderRadius: '6px', padding: '4px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dashboardWrap: { padding: '10px 10px 4px' },
  navLinks: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
    padding: '4px 10px 12px', display: 'flex', flexDirection: 'column', gap: '2px',
  },
  group: { marginBottom: '2px' },
  groupHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 12px', borderRadius: '8px', background: 'none', border: 'none',
    cursor: 'pointer', color: '#6b7280', fontSize: '11px', fontWeight: '700',
    letterSpacing: '0.6px', textTransform: 'uppercase',
  },
  groupHeaderCollapsed: { justifyContent: 'center', padding: '9px 0' },
  groupHeaderActive: { color: '#c0c8d4' },
  groupIcon: { flexShrink: 0, opacity: 0.7 },
  groupLabel: { flex: 1, textAlign: 'left', whiteSpace: 'nowrap' },
  chevron: { flexShrink: 0, opacity: 0.5 },
  groupItems: { display: 'flex', flexDirection: 'column', gap: '1px', marginBottom: '4px' },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
    borderRadius: '8px', color: '#9aa3b0', textDecoration: 'none',
    fontSize: '14px', fontWeight: '500', position: 'relative', whiteSpace: 'nowrap',
  },
  navLinkCollapsed: { justifyContent: 'center', padding: '9px 0' },
  childLink: { paddingLeft: '16px', fontSize: '13.5px' },
  navLinkActive: { backgroundColor: '#2563eb', color: '#fff' },
  linkIcon: { flexShrink: 0, width: '18px' },
  activeDot: {
    position: 'absolute', right: '10px', width: '6px', height: '6px',
    borderRadius: '50%', backgroundColor: '#fff', opacity: 0.7,
  },
  sidebarBottom: {
    padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  userRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  userAvatar: {
    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e94560',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold', fontSize: '15px', flexShrink: 0,
  },
  userName: { color: '#fff', fontSize: '13px', fontWeight: '600' },
  userRole: { color: '#6b7280', fontSize: '11px' },
  bottomActions: { display: 'flex', flexDirection: 'column', gap: '8px' },
  logoutBtn: {
    backgroundColor: 'transparent', border: '1px solid rgba(231,76,60,0.4)',
    color: '#e74c3c', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', display: 'flex', alignItems: 'center',
  },
}

export default Navbar