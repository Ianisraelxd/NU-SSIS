import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const THEME_KEY = 'nu-ssis-theme'
const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) || 'light'
  } catch {
    return 'light'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())
  const [theme, setThemeState] = useState(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const signOutLocally = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(signOutLocally)
    if (!getToken()) return
    api
      .get('/auth/me')
      .then(({ user }) => {
        setUser(user)
        setThemeState(user.theme)
      })
      .catch(signOutLocally)
      .finally(() => setReady(true))
  }, [signOutLocally])

  const login = useCallback(async (role, loginId, password) => {
    const { token, user } = await api.post('/auth/login', { role, loginId, password })
    setToken(token)
    setUser(user)
    setThemeState(user.theme)
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* already signed out */
    }
    signOutLocally()
  }, [signOutLocally])

  const savePreferences = useCallback(async (prefs) => {
    const { user } = await api.put('/settings/preferences', prefs)
    setUser(user)
    setThemeState(user.theme)
    return user
  }, [])

  const value = useMemo(
    () => ({ user, ready, theme, setUser, login, logout, savePreferences }),
    [user, ready, theme, login, logout, savePreferences],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
