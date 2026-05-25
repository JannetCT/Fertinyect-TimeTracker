import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Planner from './pages/Planner'
import Proyectos from './pages/Proyectos'
import Graficas from './pages/Graficas'
import Dashboard from './pages/Dashboard'
import Configuracion from './pages/Configuracion'
import Layout from './components/Layout'
import { leerHoja } from './services/googleSheets'
import './App.css'

function App() {
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
