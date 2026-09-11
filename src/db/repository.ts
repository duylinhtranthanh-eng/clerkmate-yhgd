/**
 * Case repository — the only API the UI uses to persist anything.
 *
 * Everything is local to the browser profile. No network, no auth, no sync.
 */

import type { Attachment, CaseRecord, CaseSummary } from '../types/case'
import type { LearnerProfile } from '../types/profile'
import { migrateCase } from '../types/factory'
import { evaluateCompleteness } from '../completeness/engine'
import { caseStatus } from '../workflow/status'
import { unreadReviews } from '../workflow/submission'
import { STORE_BLOBS, STORE_CASES, STORE_META, idb } from './idb'

function toSummary(c: CaseRecord): CaseSummary {
  const completeness = c.completeness ?? evaluateCompleteness(c)
  return {
    id: c.id,
    caseLabel: c.patient.caseLabel,
    patientName: c.patient.name,
    sex: c.patient.sex,
    ageYears: c.patient.ageYears,
    chiefComplaint: c.history.chiefComplaint || c.visit.reasonForEncounter,
    learnerLevel: c.learnerLevel,
    updatedAt: c.updatedAt,
    percent: completeness.percent,
    status: caseStatus(c, completeness),
    hasUnreadReview: unreadReviews(c).length > 0,
  }
}

export async function listCases(): Promise<CaseSummary[]> {
  const rows = await idb.all<CaseRecord>(STORE_CASES)
  return rows
    .map((r) => toSummary(migrateCase(r)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const row = await idb.get<CaseRecord | undefined>(STORE_CASES, id)
  return row ? migrateCase(row) : null
}

/**
 * Persists the record, refreshing the cached completeness snapshot.
 *
 * `requireExisting` guards autosave: an editor may still hold a record that was
 * deleted from another screen, and a late flush must not resurrect it.
 * Returns null when the case is gone.
 */
export async function saveCase(
  record: CaseRecord,
  opts: { requireExisting?: boolean } = {},
): Promise<CaseRecord | null> {
  if (opts.requireExisting) {
    const existing = await idb.get<CaseRecord | undefined>(STORE_CASES, record.id)
    if (!existing) return null
  }
  const next: CaseRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
    completeness: evaluateCompleteness(record),
  }
  await idb.put(STORE_CASES, next)
  return next
}

export async function deleteCase(id: string): Promise<void> {
  const record = await getCase(id)
  if (record) {
    for (const a of record.attachments) {
      // Both copies: the working image and the sanitized derivative, which
      // lives under its own key and would otherwise outlive the case.
      for (const key of attachmentKeys(a)) {
        await idb.del(STORE_BLOBS, key).catch(() => undefined)
      }
    }
  }
  await idb.del(STORE_CASES, id)
}

// --- attachments -----------------------------------------------------------

/** Every blob key an attachment owns; the derivative may not exist yet. */
export function attachmentKeys(a: Pick<Attachment, 'blobKey' | 'sanitizedBlobKey'>): string[] {
  const keys = [a.blobKey]
  if (a.sanitizedBlobKey && a.sanitizedBlobKey !== a.blobKey) keys.push(a.sanitizedBlobKey)
  return keys.filter((k) => k.trim().length > 0)
}

export async function putAttachmentBlob(key: string, blob: Blob): Promise<void> {
  await idb.put(STORE_BLOBS, blob, key)
}

export async function getAttachmentBlob(key: string): Promise<Blob | null> {
  const b = await idb.get<Blob | undefined>(STORE_BLOBS, key)
  return b ?? null
}

export async function deleteAttachmentBlob(key: string): Promise<void> {
  await idb.del(STORE_BLOBS, key).catch(() => undefined)
}

export async function attachmentObjectUrl(a: Attachment): Promise<string | null> {
  const blob = await getAttachmentBlob(a.blobKey)
  return blob ? URL.createObjectURL(blob) : null
}

// --- app-level preferences -------------------------------------------------

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const v = await idb.get<T | undefined>(STORE_META, key)
  return v === undefined ? fallback : v
}

export async function setPref<T>(key: string, value: T): Promise<void> {
  await idb.put(STORE_META, value, key)
}

// --- learner profile -------------------------------------------------------

const PROFILE_KEY = 'learnerProfile'

export async function getProfile(): Promise<LearnerProfile | null> {
  const p = await idb.get<LearnerProfile | undefined>(STORE_META, PROFILE_KEY)
  return p ?? null
}

export async function saveProfile(profile: LearnerProfile): Promise<LearnerProfile> {
  const previous = await getProfile()
  const history = profile.levelHistory ?? previous?.levelHistory ?? []
  const changedLevel = !!previous && previous.level !== profile.level
  const next: LearnerProfile = {
    ...profile,
    levelHistory: changedLevel
      ? [...history, { level: profile.level, at: new Date().toISOString() }]
      : history.length > 0
        ? history
        : [{ level: profile.level, at: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  }
  await idb.put(STORE_META, next, PROFILE_KEY)
  return next
}

// --- backup / restore (local file, still no server) -------------------------

export interface BackupBundle {
  app: 'clerkmate'
  exportedAt: string
  profile?: LearnerProfile | null
  cases: CaseRecord[]
  /** Attachment blobs as data URLs so the bundle is a single JSON file. */
  blobs: Record<string, string>
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob)
  })
}

/**
 * Decodes a `data:` URL without going through `fetch`.
 *
 * `fetch(dataUrl)` is the obvious way to do this and it is the wrong one here:
 * the deployed site sends `connect-src 'self'`, which the browser applies to
 * fetch even for a `data:` URL, so every image in a restored backup failed
 * silently. It worked in development only because the dev server sends no CSP.
 * Decoding in-process has no such dependency and no network involvement at all.
 */
function dataUrlToBlob(url: string): Blob {
  if (!url.startsWith('data:')) throw new Error('Không phải data URL.')
  const comma = url.indexOf(',')
  if (comma < 0) throw new Error('data URL thiếu dấu phẩy phân cách.')

  const header = url.slice(5, comma)
  const payload = url.slice(comma + 1)
  const base64 = /;base64$/i.test(header)
  const mime = header.replace(/;base64$/i, '').split(';')[0] || 'application/octet-stream'

  if (!base64) return new Blob([decodeURIComponent(payload)], { type: mime })

  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface ImportResult {
  cases: number
  /** Attachment blobs restored, and how many could not be decoded. */
  images: number
  imagesFailed: number
}

export async function exportBackup(): Promise<BackupBundle> {
  const cases = (await idb.all<CaseRecord>(STORE_CASES)).map(migrateCase)
  const blobs: Record<string, string> = {}
  for (const c of cases) {
    for (const a of c.attachments) {
      for (const key of attachmentKeys(a)) {
        const b = await getAttachmentBlob(key)
        if (b) blobs[key] = await blobToDataUrl(b)
      }
    }
  }
  return {
    app: 'clerkmate',
    exportedAt: new Date().toISOString(),
    profile: await getProfile(),
    cases,
    blobs,
  }
}

export async function importBackup(bundle: BackupBundle): Promise<ImportResult> {
  if (bundle?.app !== 'clerkmate' || !Array.isArray(bundle.cases)) {
    throw new Error('Tệp sao lưu không đúng định dạng ClerkMate.')
  }

  let images = 0
  let imagesFailed = 0
  for (const [key, dataUrl] of Object.entries(bundle.blobs ?? {})) {
    try {
      await putAttachmentBlob(key, dataUrlToBlob(dataUrl))
      images += 1
    } catch {
      // A single unreadable image must not block restoring the text of a case,
      // but it is counted and reported: the previous version swallowed these
      // and told the learner the restore had succeeded.
      imagesFailed += 1
    }
  }

  for (const raw of bundle.cases) {
    await idb.put(STORE_CASES, migrateCase(raw))
  }
  if (bundle.profile) await saveProfile(bundle.profile)
  return { cases: bundle.cases.length, images, imagesFailed }
}
