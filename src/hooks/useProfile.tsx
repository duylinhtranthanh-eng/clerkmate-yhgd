import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LearnerProfile } from '../types/profile'
import { getProfile, saveProfile, setActiveProfile } from '../db/repository'

interface ProfileCtx {
  profile: LearnerProfile | null
  loading: boolean
  save: (next: LearnerProfile) => Promise<void>
  /** Switch to another local profile; the case list follows. */
  switchTo: (id: string) => Promise<void>
}

const Ctx = createContext<ProfileCtx>({
  profile: null,
  loading: true,
  save: async () => undefined,
  switchTo: async () => undefined,
})

export function useProfile() {
  return useContext(Ctx)
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LearnerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback(async (next: LearnerProfile) => {
    const saved = await saveProfile(next)
    setProfile(saved)
  }, [])

  const switchTo = useCallback(async (id: string) => {
    await setActiveProfile(id)
    setProfile(await getProfile())
  }, [])

  const value = useMemo(
    () => ({ profile, loading, save, switchTo }),
    [profile, loading, save, switchTo],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
