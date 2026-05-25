import { useState, useEffect } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function useAuth() {
  const [usuario, setUsuario] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const tokenGuardado = sessionStorage.getItem('access_token')
    const usuarioGuardado = sessionStorage.getItem('usuario')
    if (tokenGuardado && usuarioGuardado) {
      setAccessToken(tokenGuardado)
      setUsuario(JSON.parse(usuarioGuardado))
    }
    setCargando(false)
  }, [])

  function login() {
    const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
    const redirectUri = window.location.origin + '/auth/callback'
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(scope)}`
    window.location.href = url
  }

  function logout() {
    sessionStorage.clear()
    setUsuario(null)
    setAccessToken(null)
  }

  return { usuario, accessToken, cargando, login, logout }
}