import { useState, useEffect } from 'react'
import { leerHoja } from '../services/googleSheets'

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

  async function setUsuarioDesdeToken(token) {
    try {
      setCargando(true)
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const perfil = await res.json()
      const usuarios = await leerHoja('usuarios', token)
      const usuarioEncontrado = usuarios.find(u =>
        u.email && perfil.email &&
        u.email.toLowerCase().trim() === perfil.email.toLowerCase().trim()
      )
      if (!usuarioEncontrado) {
        alert('Tu email no está autorizado. Contacta con Lorenzo.')
        setCargando(false)
        return
      }
      const usuarioFinal = {
        ...usuarioEncontrado,
        nombre: perfil.name,
        foto: perfil.picture
      }
      sessionStorage.setItem('access_token', token)
      sessionStorage.setItem('usuario', JSON.stringify(usuarioFinal))
      setAccessToken(token)
      setUsuario(usuarioFinal)
    } catch (error) {
      console.error('Error en autenticación:', error)
    } finally {
      setCargando(false)
    }
  }

  function login() {
    const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid'
    const redirectUri = window.location.origin
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=tokenresponse_type=token&scopeprompt=consent&scope=${encodeURIComponent(scope)}`
    window.location.href = url
  }

  function logout() {
    sessionStorage.clear()
    setUsuario(null)
    setAccessToken(null)
  }

  return { usuario, accessToken, cargando, login, logout, setUsuarioDesdeToken }
}
