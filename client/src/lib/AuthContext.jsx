import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          // Auth is configured but user not logged in
          setAuthRequired(true)
          setUser(null)
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data === null) {
          // Dev mode — no auth configured
          setAuthRequired(false)
          setUser(null)
        } else if (data && data.id) {
          // Auth configured and user is logged in
          setUser(data)
          setAuthRequired(true)
        }
      })
      .catch(() => {
        setAuthRequired(false)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    window.location.href = '/auth/logout'
  }

  return (
    <AuthContext.Provider value={{ user, loading, authRequired, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
