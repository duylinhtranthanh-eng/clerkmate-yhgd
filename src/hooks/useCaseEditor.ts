import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CaseRecord } from '../types/case'
import { getCase, saveCase } from '../db/repository'
import { evaluateCompleteness } from '../completeness/engine'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Loads one case and autosaves it locally.
 *
 * Local state stays the source of truth while editing so a save round-trip can
 * never clobber a keystroke; the repository is written on a short debounce.
 */
export function useCaseEditor(caseId: string) {
  const [record, setRecord] = useState<CaseRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  /** Bumped when an edit was refused because the record is locked. */
  const [lockedAttempt, setLockedAttempt] = useState(0)

  const timer = useRef<number | null>(null)
  const latest = useRef<CaseRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCase(caseId)
      .then((r) => {
        if (cancelled) return
        if (!r) setNotFound(true)
        setRecord(r)
        latest.current = r
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [caseId])

  const flush = useCallback(async () => {
    const r = latest.current
    if (!r) return
    setSaveState('saving')
    try {
      // requireExisting: if this case was deleted elsewhere, a late flush must
      // not write it back.
      const saved = await saveCase(r, { requireExisting: true })
      if (!saved) {
        latest.current = null
        setNotFound(true)
        return
      }
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 450)
  }, [flush])

  /**
   * Mutate a structural clone; never mutate state in place.
   *
   * A submitted record is locked: the state is enforced here rather than by
   * disabling every field, so no editor can accidentally bypass it.
   */
  const update = useCallback(
    (mutator: (draft: CaseRecord) => void) => {
      let blocked = false
      setRecord((prev) => {
        if (!prev) return prev
        if (prev.submission.locked) {
          blocked = true
          return prev
        }
        const draft = structuredClone(prev)
        mutator(draft)
        latest.current = draft
        return draft
      })
      if (blocked) {
        setLockedAttempt(Date.now())
        return
      }
      schedule()
    },
    [schedule],
  )

  /**
   * Replace the whole record, e.g. after applying parser suggestions.
   *
   * Honours the submission lock exactly as `update` does. It has to: the quick
   * note tab writes through this path, and a lock that holds in seventeen
   * section editors but not in the eighteenth screen is not a lock.
   */
  const replace = useCallback(
    (next: CaseRecord) => {
      let blocked = false
      setRecord((prev) => {
        if (prev?.submission.locked) {
          blocked = true
          return prev
        }
        latest.current = next
        return next
      })
      if (blocked) {
        setLockedAttempt(Date.now())
        return
      }
      schedule()
    },
    [schedule],
  )

  /**
   * Replace the record *including* when it is locked.
   *
   * Reserved for the submission workflow itself — reopening a submitted case
   * and marking a faculty comment as read both have to write to a record that
   * is locked by definition. Nothing that edits clinical content may use this;
   * it is deliberately a separate name so that stays visible at every call site.
   */
  const replaceWorkflow = useCallback(
    (next: CaseRecord) => {
      latest.current = next
      setRecord(next)
      schedule()
    },
    [schedule],
  )

  useEffect(() => {
    const onHide = () => {
      if (timer.current) window.clearTimeout(timer.current)
      void flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) window.clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  const completeness = useMemo(
    () => (record ? evaluateCompleteness(record) : null),
    [record],
  )

  return {
    record,
    loading,
    notFound,
    saveState,
    update,
    replace,
    replaceWorkflow,
    flush,
    completeness,
    lockedAttempt,
  }
}
