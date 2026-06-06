import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/logoblanco.png'
import Notificaciones from './Notificaciones'

const NAV_ITEMS = [
  { to: '/planner', icon: '📅', label: 'Planner' },
  { to: '/proyectos', icon: '📁', label: 'Proyectos' },
  { to: '/soporte', icon: '🛠️', label: 'Soporte' },
  { to: '/gantt', icon: '📊', label: 'Gantt' },
  { to: '/desviaciones', icon: '📉', label: 'Desviaciones' },
  { to: '/calendario-equipo', icon: '🗓', label: 'Calendario' },
  { to: '/graficas', icon: '📈', label: 'Gráficas' },
  { to: '/movil-campo', icon: '🌿', label: 'Campo' },
]

const NAV_ADMIN = { to: '/dashboard', icon: '🎯', label: 'Dashboard' }


const MOBILE_NAV = [
  { to: '/planner', icon: '📅', label: 'Planner' },
  { to: '/proyectos', icon: '📁', label: 'Proyectos' },
  { to: '/soporte', icon: '🛠️', label: 'Soporte' },
  { to: '/calendario-equipo', icon: '🗓', label: 'Calendario' },
  { to: '/movil-campo', icon: '🌿', label: 'Campo' },
]

function Layout({ usuario, children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    window.location.href = '/'
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR ESCRITORIO */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="Fertinyect" style={{ width: '90%', display: 'block', margin: '0 auto 10px', mixBlendMode: 'screen' }} />
          <p style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', opacity: 0.9, margin: 0, lineHeight: '1.4', letterSpacing: '0.3px' }}>
            Sistema de Gestión<br/>del Tiempo · I+D
          </p>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              {icon} {label}
            </NavLink>
          ))}
          {usuario.rol === 'admin' && (
            <NavLink to={NAV_ADMIN.to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              {NAV_ADMIN.icon} {NAV_ADMIN.label}
            </NavLink>
          )}

        </nav>
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            {usuario.foto && <img src={usuario.foto} alt={usuario.nombre} className="avatar" />}
            <div className="user-info">
              <p className="user-name">{usuario.nombre}</p>
              <p className="user-role">{usuario.rol === 'admin' ? 'Director' : 'Investigadora'}</p>
            </div>
          </div>

          {/* CAMPANITA */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 6px' }}>
            <Notificaciones />
          </div>

          <button onClick={handleLogout} style={{ width: '100%', padding: '8px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onMouseOver={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#dc2626' }}
            onMouseOut={e => { e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = '#374151' }}>
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="main-content">
        {children}
      </main>

      {/* NAV INFERIOR MÓVIL */}
      <nav className="mobile-nav">
        {MOBILE_NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive ? 'mobile-nav-item active' : 'mobile-nav-item'}
          >
            <span className="icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Layout
