import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logo from '../assets/logoblanco.png'

function Layout({ usuario, children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    window.location.href = '/'
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="Fertinyect" style={{ 
            width: '90%', 
            display: 'block', 
            margin: '0 auto 10px',
            mixBlendMode: 'screen'
          }} />
          <p style={{ 
            textAlign: 'center', 
            fontSize: '12px', 
            fontWeight: '700',
            opacity: 0.9, 
            margin: 0,
            lineHeight: '1.4',
            letterSpacing: '0.3px'
          }}>
            Sistema de Gestión<br/>del Tiempo · I+D
          </p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/planner" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📅 Planner
          </NavLink>
          <NavLink to="/proyectos" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📁 Proyectos
          </NavLink>
          <NavLink to="/soporte" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            🛠️ Soporte
          </NavLink>
          <NavLink to="/gantt" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📊 Gantt
          </NavLink>
          <NavLink to="/calendario-equipo" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            🗓 Calendario I+D
          </NavLink>
          <NavLink to="/graficas" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📈 Gráficas
          </NavLink>
          {usuario.rol === 'admin' && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              🎯 Dashboard
            </NavLink>
          )}
          <NavLink to="/movil-campo" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
  🌿 Vista Campo
</NavLink>
          <NavLink to="/configuracion" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            ⚙️ Configuración
          </NavLink>
        </nav>
        <div className="sidebar-footer" style={{ flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            {usuario.foto && <img src={usuario.foto} alt={usuario.nombre} className="avatar" />}
            <div className="user-info">
              <p className="user-name">{usuario.nombre}</p>
              <p className="user-role">{usuario.rol === 'admin' ? 'Director' : 'Investigadora'}</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#dc2626' }}
            onMouseOut={e => { e.currentTarget.style.background = '#1f2937'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = '#374151' }}>
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout
