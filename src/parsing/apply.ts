/**
 * The single place where a structuring suggestion becomes record data.
 *
 * Keeping this separate from the parser means an AI backend can propose the
 * same `StructuringSuggestion` shape and reuse every applier unchanged.
 */

import type { CaseRecord, Sex } from '../types/case'
import type { StructuringSuggestion } from './types'
import { uid } from '../utils/id'
import { computeBmi } from '../utils/format'

type Applier = (draft: CaseRecord, s: StructuringSuggestion) => void

const appliers: Record<string, Applier> = {
  'patient.sex': (d, s) => {
    const sex = s.payload?.sex as Sex | undefined
    if (sex) d.patient.sex = sex
  },
  'patient.ageYears': (d, s) => {
    const n = Number(s.payload?.age)
    if (Number.isFinite(n)) d.patient.ageYears = n
  },
  'patient.occupation': (d, s) => {
    d.patient.occupation = s.value
  },

  'history.chiefComplaint': (d, s) => {
    d.history.chiefComplaint = s.value
  },
  'history.duration': (d, s) => {
    d.history.duration = s.value
  },
  'history.hpi.append': (d, s) => {
    d.history.hpi = d.history.hpi.trim() ? `${d.history.hpi.trim()}\n${s.value}` : s.value
  },

  'redFlags.present': (d, s) => {
    if (!d.history.redFlags.present.includes(s.value)) d.history.redFlags.present.push(s.value)
  },
  'redFlags.absent': (d, s) => {
    if (!d.history.redFlags.absent.includes(s.value)) d.history.redFlags.absent.push(s.value)
  },

  'ice.ideas': (d, s) => {
    d.history.ice.ideas = s.value
  },
  'ice.concerns': (d, s) => {
    d.history.ice.concerns = s.value
  },
  'ice.expectations': (d, s) => {
    d.history.ice.expectations = s.value
  },

  'pastMedical.add': (d, s) => {
    d.personalHistory.pastMedical.push({
      id: uid('pm'),
      // A note says what the problem is, not which system it is filed under —
      // that stays for the learner to choose rather than being guessed.
      system: '',
      label: s.payload?.label ?? s.value,
      since: s.payload?.since ?? '',
      status: '',
      note: '',
    })
  },
  'allergies.add': (d, s) => {
    d.personalHistory.allergies.push({
      id: uid('al'),
      agent: s.payload?.agent ?? s.value,
      reaction: s.payload?.reaction ?? '',
      severity: '',
    })
  },

  'lifestyle.smoking': (d, s) => {
    d.lifestyle.smoking = { status: s.payload?.status ?? s.value, detail: s.payload?.detail ?? '' }
  },
  'lifestyle.alcohol': (d, s) => {
    d.lifestyle.alcohol = { status: s.payload?.status ?? s.value, detail: s.payload?.detail ?? '' }
  },
  'lifestyle.physicalActivity': (d, s) => {
    d.lifestyle.physicalActivity = s.value
  },
  'lifestyle.diet': (d, s) => {
    d.lifestyle.diet = s.value
  },
  'lifestyle.sleep': (d, s) => {
    d.lifestyle.sleep = s.value
  },

  'familyHistory.add': (d, s) => {
    d.familyHistory.entries.push({
      id: uid('fh'),
      condition: s.payload?.condition ?? s.value,
      relatives: s.payload?.relatives ?? '',
      note: '',
    })
  },
  'familyMembers.add': (d, s) => {
    const relation = (s.payload?.relation ?? 'sibling') as CaseRecord['familyMembers'][number]['relation']
    const existing = d.familyMembers.find(
      (m) => m.relation === relation && m.name === (s.payload?.name ?? ''),
    )
    const condition = s.payload?.condition
    if (existing) {
      if (condition && !existing.conditions.includes(condition)) existing.conditions.push(condition)
      return
    }
    d.familyMembers.push({
      id: uid('fm'),
      name: s.payload?.name ?? s.value,
      relation,
      sex: (s.payload?.sex ?? 'unknown') as Sex,
      ageYears: null,
      alive: true,
      ageAtDeath: null,
      conditions: condition ? [condition] : [],
      order: d.familyMembers.filter((m) => m.relation === relation).length,
      note: '',
    })
  },

  'medications.add': (d, s) => {
    d.medications.push({
      id: uid('med'),
      name: s.payload?.name ?? s.value,
      dose: s.payload?.dose ?? '',
      route: 'Uống',
      frequency: s.payload?.frequency ?? '',
      duration: '',
      indication: '',
      adherence: '',
      note: '',
    })
  },

  'vitals.bloodPressure': (d, s) => {
    d.examination.vitals.systolic = s.payload?.systolic ?? ''
    d.examination.vitals.diastolic = s.payload?.diastolic ?? ''
  },
  'vitals.pulse': (d, s) => {
    d.examination.vitals.pulse = s.payload?.pulse ?? ''
  },
  'vitals.temperature': (d, s) => {
    d.examination.vitals.temperatureC = s.payload?.temperatureC ?? ''
  },
  'vitals.respiratoryRate': (d, s) => {
    d.examination.vitals.respiratoryRate = s.payload?.respiratoryRate ?? ''
  },
  'vitals.waist': (d, s) => {
    d.examination.vitals.waistCm = s.payload?.waistCm ?? ''
  },
  'vitals.spo2': (d, s) => {
    d.examination.vitals.spo2 = s.payload?.spo2 ?? ''
  },
  'vitals.weight': (d, s) => {
    d.examination.vitals.weightKg = s.payload?.weightKg ?? ''
  },
  'vitals.height': (d, s) => {
    d.examination.vitals.heightCm = s.payload?.heightCm ?? ''
  },
}

export function canApply(targetKey: string): boolean {
  return targetKey in appliers
}

export function applySuggestion(record: CaseRecord, s: StructuringSuggestion): CaseRecord {
  const applier = appliers[s.targetKey]
  if (!applier) return record
  const draft: CaseRecord = structuredClone(record)
  applier(draft, s)
  draft.examination.vitals.bmi = computeBmi(
    draft.examination.vitals.heightCm,
    draft.examination.vitals.weightKg,
  )
  return draft
}

export function applyMany(record: CaseRecord, suggestions: StructuringSuggestion[]): CaseRecord {
  return suggestions.reduce((acc, s) => applySuggestion(acc, s), record)
}
