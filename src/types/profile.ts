/**
 * Learner profile.
 *
 * This is an identity *label* for the learning record, not authentication:
 * no password, no server, no verification. It is stored locally alongside the
 * cases and printed on the exported record so a teacher knows whose work it is.
 */

import type { LearnerLevel } from './case'

export interface LevelChange {
  level: LearnerLevel
  at: string
}

export interface LearnerProfile {
  fullName: string
  studentId: string
  level: LearnerLevel
  classGroup: string
  /**
   * Ask the learner to list risks from memory before revealing the checklist.
   * On by default: recall is the skill being trained.
   */
  recallFirst: boolean
  /**
   * Every level the learner has declared, oldest first.
   *
   * The level is self-declared and this is a local-first app with no accounts,
   * so it cannot be enforced — but it can be made visible. A record exported
   * after a switch to a lower level says so.
   */
  levelHistory: LevelChange[]
  createdAt: string
  updatedAt: string
}

export function createProfile(
  fullName: string,
  studentId: string,
  level: LearnerLevel,
  classGroup = '',
): LearnerProfile {
  const now = new Date().toISOString()
  return {
    fullName,
    studentId,
    level,
    classGroup,
    recallFirst: true,
    levelHistory: [{ level, at: now }],
    createdAt: now,
    updatedAt: now,
  }
}

export function isProfileComplete(p: LearnerProfile | null): boolean {
  return !!p && p.fullName.trim().length > 0 && p.studentId.trim().length > 0
}
