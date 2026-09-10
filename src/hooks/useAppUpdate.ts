import { useCallback, useEffect, useState } from 'react'

/**
 * Registers the service worker and reports when a newer build is waiting.
 *
 * The worker never activates on its own: replacing the app while a learner is
 * mid-note would be hostile, so the new build waits until they tap to reload.
 */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setWaiting(registration.waiting)
        setUpdateReady(true)
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          // A worker that installs while another controls the page is an update,
          // not a first install.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            if (cancelled) return
            setWaiting(installing)
            setUpdateReady(true)
          }
        })
      })
    }

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then(watch)
      .catch(() => undefined)

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    waiting?.postMessage('SKIP_WAITING')
  }, [waiting])

  return { updateReady, applyUpdate }
}
