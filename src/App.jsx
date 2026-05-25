import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Planner from './pages/Planner'
import Proyectos from './pages/Proyectos'
import Graficas from './pages/Graficas'
import Dashboard from './pages/Dashboard'
import Configuracion from './pages/Configuracion'
import Layout from './components/Layout'
import './App.css'

function App() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        {!usuario ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route path="/*" element={
            <Layout usuario={usuario}>
              <Routes>
                <Route path="/" element={<Navigate to="/planner" />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/proyectos" element={<Proyectos />} />
                <Route path="/graficas" element={<Graficas />} />
                {usuario.rol === 'admin' && (
                  <Route path="/dashboard" element={<Dashboard />} />
                )}
                <Route path="/configuracion" element={<Configuracion />} />
              </Routes>
            </Layout>
          } />
        )}
      </Routes>
    </Router>
  )
}

export default App