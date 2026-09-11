import { useCallback, useEffect, useState } from 'react'
import type { SectionId } from '../config/sections'

export const CASE_TABS = ['note', 'record', 'check', 'genogram', 'review'] as const
export type CaseTab = (typeof CASE_TABS)[number]

export type Route =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'case'; caseId: string; tab: CaseTab }
  | { name: 'section'; caseId: string; sectionId: SectionId }

export function buildHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'settings':
      return '#/settings'
    case 'case':
      return `#/case/${route.caseId}/${route.tab}`
    case 'section':
      return `#/case/${route.caseId}/s/${route.sectionId}`
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'case' && parts[1]) {
    if (parts[2] === 's' && parts[3]) {
      return { name: 'section', caseId: parts[1], sectionId: parts[3] as SectionId }
    }
    const tab = (CASE_TABS as readonly string[]).includes(parts[2] ?? '')
      ? (parts[2] as CaseTab)
      : 'record'
    return { name: 'case', caseId: parts[1], tab }
  }
  return { name: 'home' }
}

export function useRoute(): {
  route: Route
  navigate: (r: Route, replace?: boolean) => void
  back: () => void
} {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((r: Route, replace = false) => {
    const next = buildHash(r)
    if (window.location.hash === next) return
    if (replace) window.history.replaceState(null, '', next)
    else window.location.hash = next
    setRoute(parseHash(next))
  }, [])

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/'
  }, [])

  return { route, navigate, back }
}
