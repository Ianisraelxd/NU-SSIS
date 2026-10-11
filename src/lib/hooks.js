import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Fetch `path` on mount / when it changes. `reload()` refetches without flashing the spinner.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const load = useCallback(
    async (silent) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await api.get(path)
        setState({ data, error: null, loading: false })
      } catch (error) {
        setState((s) => ({ ...s, error, loading: false }))
      }
    },
    [path],
  )

  useEffect(() => {
    let cancelled = false
    api
      .get(path)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
  }, [path])

  return { ...state, reload: () => load(true), retry: () => load(false) }
}

// Value that only updates after the user stops typing for `ms` (for search boxes).
export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

// Re-run `fn` every `ms` while the page is open and visible (used for the live queue).
export function usePolling(fn, ms) {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  useEffect(() => {
    const id = setInterval(() => !document.hidden && latest.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}
