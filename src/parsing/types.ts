import type { CaseRecord } from '../types/case'
import type { SectionId } from '../config/sections'

export type Confidence = 'high' | 'medium' | 'low'

/**
 * A single proposed edit derived from free-text notes.
 *
 * Plain data on purpose: an AI parsing layer added later returns exactly this
 * shape, and `applySuggestion` stays the only code that mutates the record.
 * Nothing is written until the learner accepts it.
 */
export interface StructuringSuggestion {
  id: string
  /** Stable key into the applier registry, e.g. `history.chiefComplaint`. */
  targetKey: string
  sectionId: SectionId
  fieldLabel: string
  /** Human-readable value shown on the suggestion card. */
  value: string
  /** Structured parts for list targets (medication name/dose, relation, ...). */
  payload?: Record<string, string>
  /** The fragment of the note this came from, for provenance. */
  snippet: string
  confidence: Confidence
  /** Set by the parser when the record already holds this exact value. */
  alreadyPresent?: boolean
  /**
   * The record already holds something *different* here.
   *
   * A learner who says "lúc nặng nhất 8/10" has not corrected the 6/10 they
   * recorded earlier — both may be true of the same knee. So the existing value
   * travels with the suggestion, the review sheet shows both, and nothing is
   * overwritten until someone chooses. Contradictions are for people to
   * resolve; the app's job is to notice them.
   */
  conflictsWith?: string
  /**
   * Which backend proposed this. The review sheet says so out loud, because a
   * learner deciding whether to accept a suggestion should know whether it came
   * off their own device or out of a model.
   */
  origin?: 'local' | 'ai'
  /** 0–1 as returned by an AI backend; `confidence` above stays what the UI shows. */
  score?: number
  /** One short line from an AI backend on why it proposed this. */
  reason?: string
}

/**
 * Raised when a structuring backend cannot answer at all.
 *
 * The caller's contract is to fall back to the local parser and tell the
 * learner, never to lose the note.
 */
export class StructuringUnavailable extends Error {
  constructor(
    readonly code:
      | 'offline'
      | 'not-configured'
      | 'timeout'
      | 'auth'
      | 'rate-limit'
      | 'server'
      | 'bad-response'
      | 'network',
    message: string,
  ) {
    super(message)
    this.name = 'StructuringUnavailable'
  }
}

/**
 * Pluggable structuring backend. The MVP ships `heuristicStructurer`;
 * an API-backed one can be registered later without touching the UI.
 */
export interface NoteStructurer {
  id: string
  label: string
  /** Offline / deterministic backends set this so the UI can say so. */
  local: boolean
  structure(text: string, record: CaseRecord): Promise<StructuringSuggestion[]>
}
