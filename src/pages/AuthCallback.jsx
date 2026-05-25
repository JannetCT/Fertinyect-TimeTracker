import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { leerHoja } from '../services/googleSheets'

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', '?'))
    const token = params.get('access_token')

    if (!token) {
      navigate('/')
      return
    }

    async function verificarUsuario() {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const perfil = await res.json()

        const usuarios = await leerHoja('usuarios', token)
        const usuarioEncontrado = usuarios.find(u => u.email === perfil.email)

        if (!usuarioEncontrado) {
          alert('Tu email no está autorizado. Contacta con Lorenzo.')
          navigate('/')
          return
        }

        const usuario = {
          ...usuarioEncontrado,
          nombre: perfil.name,
          foto: perfil.picture
        }

        sessionStorage.setItem('access_token', token)
        sessionStorage.setItem('usuario', JSON.stringify(usuario))

        navigate('/planner')
      } catch (error) {
        console.error('Error en autenticación:', error)
        navigate('/')
      }
    }

    verificarUsuario()
  }, [])

  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p>Verificando acceso...</p>
    </div>
  )
}
export default AuthCallback