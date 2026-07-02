import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DatosProvider } from './contexts/DatosContext'
import Login from './pages/Login'
import Planner from './pages/Planner'
import Proyectos from './pages/Proyectos'
import Soporte from './pages/Soporte'
import Gantt from './pages/Gantt'
import Desviaciones from './pages/Desviaciones'
import Direccion from './pages/Direccion'
import Graficas from './pages/Graficas'
import Dashboard from './pages/Dashboard'
import Configuracion from './pages/Configuracion'
import CalendarioEquipo from './pages/CalendarioEquipo'
import MovilCampo from './pages/MovilCampo'
import Layout from './components/Layout'
import './App.css'

function AppRoutes() {
  const { usuario, accessToken, cargando, setUsuarioDesdeToken } = useAuth()

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const token = params.get('access_token')
      if (token) {
        window.history.replaceState({}, document.title, '/')
        setUsuarioDesdeToken(token)
      }
    }
  }, [])

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
        {!usuario ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route path="/*" element={
            <DatosProvider>
              <Layout usuario={usuario}>
                <Routes>
                  <Route path="/" element={<Navigate to="/planner" />} />
                  <Route path="/planner" element={<Planner />} />
                  <Route path="/proyectos" element={<Proyectos />} />
                  <Route path="/soporte" element={<Soporte />} />
                  <Route path="/gantt" element={<Gantt />} />
                  <Route path="/desviaciones" element={<Desviaciones />} />
                  <Route path="/direccion" element={<Direccion />} />
                  <Route path="/graficas" element={<Graficas />} />
                  <Route path="/calendario-equipo" element={<CalendarioEquipo />} />
                  <Route path="/movil-campo" element={<MovilCampo />} />
                  {usuario.rol === 'admin' && (
                    <Route path="/dashboard" element={<Dashboard />} />
                  )}
                  <Route path="/configuracion" element={<Configuracion />} />
                </Routes>
              </Layout>
            </DatosProvider>
          } />
        )}
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App