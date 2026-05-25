import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Layout({ usuario, children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>🌿 I+D</h2>
          <p>Fertinyect</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/planner" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📅 Planner
          </NavLink>
          <NavLink to="/proyectos" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📁 Proyectos
          </NavLink>
          <NavLink to="/graficas" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            📊 Gráficas
          </NavLink>
          {usuario.rol === 'admin' && (
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              🎯 Dashboard
            </NavLink>
          )}
          <NavLink to="/configuracion" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            ⚙️ Configuración
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {usuario.foto && <img src={usuario.foto} alt={usuario.nombre} className="avatar" />}
          <div className="user-info">
            <p className="user-name">{usuario.nombre}</p>
            <p className="user-role">{usuario.rol === 'admin' ? 'Director' : 'Investigadora'}</p>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Cerrar sesión">↩</button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout