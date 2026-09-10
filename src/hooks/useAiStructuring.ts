/**
 * Availability and consent state for AI note structuring.
 *
 * Two gates stand between a learner and an outbound request, and both default
 * to closed:
 *
 *   1. `allowAi` — off until switched on in Settings. While it is off the app
 *      never contacts the endpoint at all, not even to ask whether one exists,
 *      so an untouched install keeps making zero network calls.
 *   2. `privacyAccepted` — the note leaves the device in AI mode, so the
 *      learner confirms once per browser profile that they are working with
 *      fictional or de-identified data.
 */

import { useCallback, useEffect, useState } from 'react'
import { getPref, setPref } from '../db/repository'
import { fetchAiStatus } from '../parsing/aiStructurer'

export const AI_MODE_PREF = 'ai.allowAi'
export const AI_PRIVACY_PREF = 'ai.privacyAcceptedAt'

export interface AiStructuringState {
  /** Settings choice: may the learner pick AI mode at all? */
  allowAi: boolean
  setAllowAi: (next: boolean) => void
  /** Whether a provider is wired up behind the proxy. Unknown until probed. */
  configured: boolean
  checking: boolean
  model: string
  /** Consent for this browser profile. */
  privacyAccepted: boolean
  acceptPrivacy: () => void
  resetPrivacy: () => void
  online: boolean
  /** The AI option is offered only when all of these hold. */
  aiSelectable: boolean
  loading: boolean
}

export function useAiStructuring(): AiStructuringState {
  const [allowAi, setAllowAiState] = useState(false)
  const [privacyAt, setPrivacyAt] = useState('')
  const [configured, setConfigured] = useState(false)
  const [model, setModel] = useState('')
  const [checking, setChecking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([getPref(AI_MODE_PREF, false), getPref(AI_PRIVACY_PREF, '')])
      .then(([mode, accepted]) => {
        if (cancelled) return
        setAllowAiState(mode === true)
        setPrivacyAt(typeof accepted === 'string' ? accepted : '')
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Probe only after the learner has opted in, and only while online.
  useEffect(() => {
    if (!allowAi || !online) return
    const controller = new AbortController()
    setChecking(true)
    fetchAiStatus(controller.signal)
      .then((s) => {
        setConfigured(s.configured)
        setModel(s.model ?? '')
      })
      .finally(() => setChecking(false))
    return () => controller.abort()
  }, [allowAi, online])

  const setAllowAi = useCallback((next: boolean) => {
    setAllowAiState(next)
    if (!next) setConfigured(false)
    void setPref(AI_MODE_PREF, next)
  }, [])

  const acceptPrivacy = useCallback(() => {
    const at = new Date().toISOString()
    setPrivacyAt(at)
    void setPref(AI_PRIVACY_PREF, at)
  }, [])

  const resetPrivacy = useCallback(() => {
    setPrivacyAt('')
    void setPref(AI_PRIVACY_PREF, '')
  }, [])

  return {
    allowAi,
    setAllowAi,
    configured,
    checking,
    model,
    privacyAccepted: privacyAt !== '',
    acceptPrivacy,
    resetPrivacy,
    online,
    aiSelectable: allowAi && configured && online,
    loading,
  }
}
