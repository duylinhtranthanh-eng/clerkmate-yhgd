import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const ToastCtx = createContext<(msg: string) => void>(() => undefined)

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const show = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2400)
  }, [])

  const value = useMemo(() => show, [show])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg && <div className="toast no-print" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}
