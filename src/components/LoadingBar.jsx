import { useEffect, useState } from 'react'
import { usePending } from '../lib/loading.js'

// A slim progress bar at the top of the screen while the app is talking to the server.
// It waits ~150 ms before appearing (so quick requests don't flicker) and, if the server is slow,
// shows a "still working" note so people know the page has not frozen.
export default function LoadingBar() {
  const pending = usePending()
  const [visible, setVisible] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (pending > 0) {
      const show = setTimeout(() => setVisible(true), 150)
      const late = setTimeout(() => setSlow(true), 4000)
      return () => {
        clearTimeout(show)
        clearTimeout(late)
      }
    }
    const hide = setTimeout(() => {
      setVisible(false)
      setSlow(false)
    }, 250)
    return () => clearTimeout(hide)
  }, [pending])

  if (!visible) return null
  return (
    <div className="loadbar" role="progressbar" aria-label="Loading" aria-busy="true">
      <span className={`loadbar-fill ${pending === 0 ? 'done' : ''}`} />
      {slow && pending > 0 && (
        <span className="loadbar-note" role="status">
          Still working… the connection looks slow.
        </span>
      )}
    </div>
  )
}
