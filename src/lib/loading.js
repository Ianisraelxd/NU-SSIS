import { useSyncExternalStore } from 'react'

// Tracks how many requests are in flight so the UI can show one global buffering indicator.
let pending = 0
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

export const loadingStart = () => {
  pending += 1
  emit()
}
export const loadingEnd = () => {
  pending = Math.max(0, pending - 1)
  emit()
}
export const usePending = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => pending,
  )
