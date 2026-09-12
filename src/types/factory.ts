/**
 * Factory for a blank CaseRecord, plus a schema migration hook so records
 * written by an older build keep opening.
 */

import type {
  CaptureSource,
  CaseRecord,
  ExamStatus,
  LearnerLevel,
  QuickNote,
  Screem,
  SystemExam,
} from './case'
import { uid } from '../utils/id'
import { todayIso } from '../utils/format'
import { EXAM_SYSTEMS, SCREENING_ITEMS, VACCINATION_ITEMS } from '../config/clinical'
import { RISK_FACTOR_DEFS } from '../config/risk'

export const SCHEMA_VERSION = 1

function emptyScreem(): Screem {
  const blank = { resources: '', pathology: '' }
  return {
    social: { ...blank },
    cultural: { ...blank },
    religious: { ...blank },
    economic: { ...blank },
    educational: { ...blank },
    medical: { ...blank },
  }
}

export function createEmptyCase(
  level: LearnerLevel = 'Y5',
  caseLabel = '',
  ownerProfileId = '',
): CaseRecord {
  const now = new Date().toISOString()
  return {
    id: uid('case'),
    ownerProfileId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    learnerLevel: level,

    patient: {
      name: '',
      sex: 'unknown',
      ageYears: null,
      dateOfBirth: '',
      occupation: '',
      education: '',
      ethnicity: '',
      religion: '',
      maritalStatus: '',
      address: '',
      phone: '',
      insurance: '',
      caseLabel,
      fileNumber: '',
      familyCode: '',
    },
    visit: {
      date: todayIso(),
      setting: '',
      encounterType: '',
      reasonForEncounter: '',
      accompaniedBy: '',
    },
    quickNotes: [],
    history: {
      chiefComplaint: '',
      duration: '',
      hpi: '',
      socrates: {
        site: '',
        onset: '',
        character: '',
        radiation: '',
        associations: '',
        timeCourse: '',
        exacerbatingRelieving: '',
        severity: '',
      },
      redFlags: { present: [], absent: [], note: '' },
      ice: { ideas: '', concerns: '', expectations: '' },
      systemsReview: '',
    },
    personalHistory: {
      pastMedical: [],
      pastSurgical: [],
      allergies: [],
      reproductive: {
        applicable: true,
        menarcheAge: '',
        cycle: '',
        lmp: '',
        gravida: '',
        para: '',
        abortions: '',
        livingChildren: '',
        contraception: '',
        menopause: '',
        obstetricNote: '',
      },
      noPastMedical: false,
      noPastSurgical: false,
      noAllergies: false,
      note: '',
    },
    lifestyle: {
      smoking: { status: '', detail: '' },
      alcohol: { status: '', detail: '' },
      physicalActivity: '',
      diet: '',
      sleep: '',
      substanceUse: '',
      stress: '',
      occupationalExposure: '',
    },
    familyHistory: { entries: [], none: false, note: '' },
    familyMedicineAssessment: {
      familyType: '',
      familyLifeCycleStage: '',
      familyLifeCycleNote: '',
      apgar: {
        adaptation: null,
        partnership: null,
        growth: null,
        affection: null,
        resolve: null,
        note: '',
      },
      screem: emptyScreem(),
      homeEnvironment: '',
      continuityNote: '',
    },
    examination: {
      generalAppearance: '',
      vitals: {
        temperatureC: '',
        pulse: '',
        respiratoryRate: '',
        systolic: '',
        diastolic: '',
        spo2: '',
        heightCm: '',
        weightKg: '',
        waistCm: '',
        bmi: '',
        bloodGlucose: '',
      },
      systems: EXAM_SYSTEMS.map((s) => ({
        id: s.id,
        label: s.label,
        status: 'unchecked' as ExamStatus,
        findings: '',
      })),
      note: '',
    },
    investigations: {
      proposed: [],
      results: [],
      interpretation: { abnormal: '', supportsDiagnosis: '', inconsistencies: '', impactOnPlan: '' },
      summary: '',
    },
    riskAssessment: {
      factors: RISK_FACTOR_DEFS.map((r) => ({
        id: r.id,
        label: r.label,
        domain: r.domain,
        present: 'unknown' as const,
        note: '',
      })),
      recall: {},
      scales: [],
      falls: {
        fellPastYear: 'unknown',
        fallCount: '',
        injured: 'unknown',
        feelsUnsteady: 'unknown',
        worriesAboutFalling: 'unknown',
        timedUpAndGoSeconds: '',
        chairStandCount: '',
        note: '',
      },
      cvd: { inputs: {}, chart: '', percent: '', band: '', note: '' },
      overallNote: '',
    },
    diagnosis: {
      primary: null,
      comorbidities: [],
      differentials: [],
      noComorbidities: false,
      reasoning: '',
    },
    managementPlan: {
      nonPharmacological: '',
      patientEducation: '',
      followUpInterval: '',
      followUpPlan: '',
      referral: { needed: 'unknown', destination: '', reason: '', urgency: '' },
      hospitalization: { needed: 'unknown', reason: '' },
      goalsOfCare: '',
    },
    medications: [],
    prevention: {
      screenings: SCREENING_ITEMS.map((s) => ({
        id: s.id,
        name: s.name,
        status: '',
        date: '',
        result: '',
      })),
      vaccinations: VACCINATION_ITEMS.map((v) => ({
        id: v.id,
        name: v.name,
        date: '',
        status: '',
        note: '',
      })),
      counselling: '',
      healthMaintenanceNote: '',
    },
    attachments: [],
    familyMembers: [
      {
        id: uid('fm'),
        name: 'Bệnh nhân',
        relation: 'self',
        sex: 'unknown',
        ageYears: null,
        alive: true,
        ageAtDeath: null,
        conditions: [],
        order: 0,
        note: '',
      },
    ],
    followUps: [],
    reflection: {
      learned: '',
      difficulties: '',
      nextTime: '',
      questionsForTeacher: '',
      selfRating: null,
      tags: [],
    },
    submission: {
      code: '',
      submittedAt: '',
      exportedAt: '',
      locked: false,
      reopenedAt: [],
      reviews: [],
      acknowledgedReviewIds: [],
      answeredReviewIds: [],
    },
    completeness: null,
  }
}

/**
 * Fill in fields added by later schema versions so an old stored record still
 * satisfies the current type. Deliberately conservative: never overwrite data.
 */
/**
 * Brings an attachment written before the sanitised-derivative boundary existed
 * up to the current rules.
 *
 * A redacted image already went through a canvas re-encode, so its bytes are a
 * derivative and can be pointed at directly. An image the learner merely
 * *declared* clean is still the original file, metadata and all — the hole this
 * boundary exists to close. Rather than grandfather it, the declaration is
 * cleared so the learner confirms once more, and that confirmation now produces
 * a real derivative.
 */
/**
 * Brings a note written before fragments existed up to the new shape.
 *
 * A legacy note has text and nothing else, so it was typed, its original text
 * is its text, and whether it was ever filed is already recorded in
 * `filedInto`. Nothing is rewritten and nothing is lost — the worst case is a
 * fragment that says "unprocessed" about work the learner already did, which
 * the inbox corrects as soon as it is opened.
 */
/**
 * A freshly captured fragment.
 *
 * One constructor for both sources, so a transcript and a typed line are the
 * same kind of thing from here on — and `originalText` starts out equal to the
 * working text, which is what "the learner has not edited it yet" means.
 */
export function createFragment(
  source: CaptureSource,
  text: string,
  filedInto: string[] = [],
): QuickNote {
  return {
    id: uid('note'),
    createdAt: new Date().toISOString(),
    source,
    originalText: text,
    text,
    transcriptionStatus: source === 'voice' ? 'ready' : 'not_applicable',
    processingStatus: filedInto.length > 0 ? 'fully_applied' : 'unprocessed',
    filedInto,
    archived: false,
  }
}

function migrateQuickNote(stored: unknown): QuickNote {
  const n = (stored ?? {}) as Partial<QuickNote> & { text?: string }
  const text = n.text ?? ''
  return {
    id: n.id ?? uid('note'),
    createdAt: n.createdAt ?? new Date().toISOString(),
    updatedAt: n.updatedAt,
    source: n.source ?? 'text',
    originalText: n.originalText ?? text,
    text,
    transcriptionStatus: n.transcriptionStatus ?? (n.source === 'voice' ? 'ready' : 'not_applicable'),
    processingStatus:
      n.processingStatus ?? ((n.filedInto ?? []).length > 0 ? 'fully_applied' : 'unprocessed'),
    filedInto: n.filedInto ?? [],
    archived: n.archived === true,
  }
}

function migrateAttachment(stored: CaseRecord['attachments'][number]): CaseRecord['attachments'][number] {
  const a = stored as Partial<CaseRecord['attachments'][number]> & { blobKey: string }
  if (typeof a.sanitizedBlobKey === 'string') {
    return { ...(a as CaseRecord['attachments'][number]), faceCheck: a.faceCheck ?? '' }
  }
  const wasRedacted = a.redacted === true
  return {
    ...(a as CaseRecord['attachments'][number]),
    sanitizedBlobKey: wasRedacted ? a.blobKey : '',
    privacyChecked: wasRedacted,
    faceCheck: '',
  }
}

/**
 * Keep a stored record's answers while picking up factors added to the
 * catalogue since it was written. Answers win; labels and domains follow the
 * current config so a renamed factor is not stuck with its old wording.
 */
function mergeRiskFactors(
  stored: CaseRecord['riskAssessment']['factors'] | undefined,
  current: CaseRecord['riskAssessment']['factors'],
): CaseRecord['riskAssessment']['factors'] {
  if (!stored || stored.length === 0) return current
  const answers = new Map(stored.map((f) => [f.id, f]))
  const merged = current.map((f) => {
    const prev = answers.get(f.id)
    return prev ? { ...f, present: prev.present, note: prev.note } : f
  })
  // Anything the learner answered that is no longer in the catalogue is kept,
  // so a record never silently loses documented work.
  const known = new Set(current.map((f) => f.id))
  for (const f of stored) {
    if (known.has(f.id)) continue
    // Keep the learner's own factors always, and retired catalogue factors
    // only when they carry an answer.
    if (f.custom || f.present !== 'unknown') merged.push(f)
  }
  return merged
}

/**
 * Records written before exam systems had a tri-state carried a boolean
 * `examined`; map those onto the closest status without guessing "normal".
 */
function normalizeSystems(
  stored: SystemExam[] | undefined,
  fallback: SystemExam[],
): SystemExam[] {
  if (!stored || stored.length === 0) return fallback
  return stored.map((s) => {
    const legacy = s as SystemExam & { examined?: boolean }
    const status: ExamStatus = s.status
      ? s.status
      : legacy.examined
        ? 'abnormal'
        : 'unchecked'
    return { id: s.id, label: s.label, status, findings: s.findings ?? '' }
  })
}

export function migrateCase(raw: unknown): CaseRecord {
  const base = createEmptyCase()
  const stored = (raw ?? {}) as Partial<CaseRecord>
  const merged: CaseRecord = {
    ...base,
    ...stored,
    patient: { ...base.patient, ...(stored.patient ?? {}) },
    visit: { ...base.visit, ...(stored.visit ?? {}) },
    history: {
      ...base.history,
      ...(stored.history ?? {}),
      socrates: { ...base.history.socrates, ...(stored.history?.socrates ?? {}) },
      redFlags: { ...base.history.redFlags, ...(stored.history?.redFlags ?? {}) },
      ice: { ...base.history.ice, ...(stored.history?.ice ?? {}) },
    },
    personalHistory: {
      ...base.personalHistory,
      ...(stored.personalHistory ?? {}),
      reproductive: {
        ...base.personalHistory.reproductive,
        ...(stored.personalHistory?.reproductive ?? {}),
      },
    },
    lifestyle: {
      ...base.lifestyle,
      ...(stored.lifestyle ?? {}),
      smoking: { ...base.lifestyle.smoking, ...(stored.lifestyle?.smoking ?? {}) },
      alcohol: { ...base.lifestyle.alcohol, ...(stored.lifestyle?.alcohol ?? {}) },
    },
    familyHistory: { ...base.familyHistory, ...(stored.familyHistory ?? {}) },
    familyMedicineAssessment: {
      ...base.familyMedicineAssessment,
      ...(stored.familyMedicineAssessment ?? {}),
      apgar: {
        ...base.familyMedicineAssessment.apgar,
        ...(stored.familyMedicineAssessment?.apgar ?? {}),
      },
      screem: { ...base.familyMedicineAssessment.screem, ...(stored.familyMedicineAssessment?.screem ?? {}) },
    },
    examination: {
      ...base.examination,
      ...(stored.examination ?? {}),
      vitals: { ...base.examination.vitals, ...(stored.examination?.vitals ?? {}) },
      systems: normalizeSystems(stored.examination?.systems, base.examination.systems),
    },
    investigations: {
      ...base.investigations,
      ...(stored.investigations ?? {}),
      interpretation: {
        ...base.investigations.interpretation,
        ...(stored.investigations?.interpretation ?? {}),
      },
    },
    riskAssessment: {
      ...base.riskAssessment,
      ...(stored.riskAssessment ?? {}),
      factors: mergeRiskFactors(stored.riskAssessment?.factors, base.riskAssessment.factors),
      recall: stored.riskAssessment?.recall ?? base.riskAssessment.recall,
      scales: stored.riskAssessment?.scales ?? base.riskAssessment.scales,
      falls: { ...base.riskAssessment.falls, ...(stored.riskAssessment?.falls ?? {}) },
      cvd: {
        ...base.riskAssessment.cvd,
        ...(stored.riskAssessment?.cvd ?? {}),
        inputs: stored.riskAssessment?.cvd?.inputs ?? {},
      },
    },
    diagnosis: { ...base.diagnosis, ...(stored.diagnosis ?? {}) },
    managementPlan: {
      ...base.managementPlan,
      ...(stored.managementPlan ?? {}),
      referral: { ...base.managementPlan.referral, ...(stored.managementPlan?.referral ?? {}) },
      hospitalization: {
        ...base.managementPlan.hospitalization,
        ...(stored.managementPlan?.hospitalization ?? {}),
      },
    },
    prevention: {
      ...base.prevention,
      ...(stored.prevention ?? {}),
      screenings:
        stored.prevention?.screenings && stored.prevention.screenings.length > 0
          ? stored.prevention.screenings
          : base.prevention.screenings,
      vaccinations:
        stored.prevention?.vaccinations && stored.prevention.vaccinations.length > 0
          ? stored.prevention.vaccinations
          : base.prevention.vaccinations,
    },
    familyMembers:
      stored.familyMembers && stored.familyMembers.length > 0
        ? stored.familyMembers
        : base.familyMembers,
    reflection: { ...base.reflection, ...(stored.reflection ?? {}) },
    submission: { ...base.submission, ...(stored.submission ?? {}) },
    attachments: (stored.attachments ?? []).map(migrateAttachment),
    quickNotes: (stored.quickNotes ?? []).map(migrateQuickNote),
    schemaVersion: SCHEMA_VERSION,
  }
  return merged
}
