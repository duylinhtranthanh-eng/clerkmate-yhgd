/**
 * ClerkMate central data model.
 *
 * This file is deliberately UI-agnostic: no React, no DOM, no storage concerns.
 * Every screen, the completeness engine, the genogram layout and the exporter
 * all read from / write to this one shape.
 */

export type LearnerLevel = 'Y2' | 'Y5' | 'Y6' | 'SDH'

export type Sex = 'male' | 'female' | 'other' | 'unknown'

export type YesNoUnknown = 'yes' | 'no' | 'unknown'

/** Free-text-first field: students type prose, structure is optional. */
export type Text = string

// ---------------------------------------------------------------------------
// Patient & visit
// ---------------------------------------------------------------------------

export interface Patient {
  /** Fictional demo name or initials. */
  name: Text
  sex: Sex
  ageYears: number | null
  dateOfBirth: Text
  occupation: Text
  education: Text
  ethnicity: Text
  religion: Text
  maritalStatus: Text
  address: Text
  phone: Text
  insurance: Text
  /** Learner-facing identifier for the fictional case, e.g. "Case 03". */
  caseLabel: Text
  /** "Số hồ sơ" on the department's paper form. */
  fileNumber: Text
  /** "MSGĐ" — the family's own number on the paper form. */
  familyCode: Text
}

export interface Visit {
  date: Text
  setting: Text
  encounterType: Text
  reasonForEncounter: Text
  accompaniedBy: Text
}

// ---------------------------------------------------------------------------
// Quick capture
// ---------------------------------------------------------------------------

export interface QuickNote {
  id: string
  createdAt: string
  text: Text
  /** Section ids this note has already been filed into. */
  filedInto: string[]
  archived: boolean
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface Socrates {
  site: Text
  onset: Text
  character: Text
  radiation: Text
  associations: Text
  timeCourse: Text
  exacerbatingRelieving: Text
  severity: Text
}

export interface RedFlags {
  /** Red flags the student actively elicited as present. */
  present: string[]
  /** Red flags explicitly asked about and denied. */
  absent: string[]
  note: Text
}

export interface Ice {
  ideas: Text
  concerns: Text
  expectations: Text
}

export interface History {
  chiefComplaint: Text
  duration: Text
  hpi: Text
  socrates: Socrates
  redFlags: RedFlags
  ice: Ice
  systemsReview: Text
}

// ---------------------------------------------------------------------------
// Past / personal / family background
// ---------------------------------------------------------------------------

export interface PastProblem {
  id: string
  /** The body system it is filed under, matching the paper form's rows. */
  system: Text
  label: Text
  since: Text
  status: Text
  note: Text
}

export interface Allergy {
  id: string
  agent: Text
  reaction: Text
  severity: Text
}

export interface ReproductiveHistory {
  applicable: boolean
  menarcheAge: Text
  cycle: Text
  lmp: Text
  gravida: Text
  para: Text
  abortions: Text
  livingChildren: Text
  contraception: Text
  menopause: Text
  obstetricNote: Text
}

export interface PersonalHistory {
  pastMedical: PastProblem[]
  pastSurgical: PastProblem[]
  allergies: Allergy[]
  reproductive: ReproductiveHistory
  /**
   * Explicit "asked, nothing to record".
   *
   * An empty list alone is ambiguous — it could mean not asked. These flags let
   * the learner close a section in one tap and let the completeness engine tell
   * "chưa khai thác" apart from "đã hỏi, không có".
   */
  noPastMedical: boolean
  noPastSurgical: boolean
  noAllergies: boolean
  note: Text
}

export interface Lifestyle {
  smoking: { status: Text; detail: Text }
  alcohol: { status: Text; detail: Text }
  physicalActivity: Text
  diet: Text
  sleep: Text
  substanceUse: Text
  stress: Text
  occupationalExposure: Text
}

export interface FamilyHistoryEntry {
  id: string
  condition: Text
  relatives: Text
  note: Text
}

export interface FamilyHistory {
  entries: FamilyHistoryEntry[]
  /** Asked and nothing significant to record. */
  none: boolean
  note: Text
}

// ---------------------------------------------------------------------------
// Family Medicine assessment
// ---------------------------------------------------------------------------

/** Family APGAR: 5 items, each scored 0 (hardly ever) - 2 (almost always). */
export type ApgarScore = 0 | 1 | 2 | null

export interface FamilyApgar {
  adaptation: ApgarScore
  partnership: ApgarScore
  growth: ApgarScore
  affection: ApgarScore
  resolve: ApgarScore
  note: Text
}

export type ScreemDomain =
  | 'social'
  | 'cultural'
  | 'religious'
  | 'economic'
  | 'educational'
  | 'medical'

export interface ScreemEntry {
  resources: Text
  pathology: Text
}

export type Screem = Record<ScreemDomain, ScreemEntry>

export interface FamilyMedicineAssessment {
  familyType: Text
  familyLifeCycleStage: Text
  familyLifeCycleNote: Text
  apgar: FamilyApgar
  screem: Screem
  homeEnvironment: Text
  continuityNote: Text
}

// ---------------------------------------------------------------------------
// Examination
// ---------------------------------------------------------------------------

export interface Vitals {
  temperatureC: Text
  pulse: Text
  respiratoryRate: Text
  systolic: Text
  diastolic: Text
  spo2: Text
  heightCm: Text
  weightKg: Text
  waistCm: Text
  /** Derived, but stored so the export is reproducible. */
  bmi: Text
  /** "Đường huyết" sits in the vitals row of the paper form. */
  bloodGlucose: Text
}

/**
 * `normal` lets the learner confirm a normal system in one tap; `abnormal`
 * requires them to describe what they found. `unchecked` means not examined —
 * never assumed normal.
 */
export type ExamStatus = 'unchecked' | 'normal' | 'abnormal'

export interface SystemExam {
  id: string
  label: Text
  status: ExamStatus
  findings: Text
}

export interface Examination {
  generalAppearance: Text
  vitals: Vitals
  systems: SystemExam[]
  note: Text
}

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

/**
 * Just the name.
 *
 * There was a `rationale` field here. It came out because this list gets filled
 * standing on a ward round — asking for a written justification per test turned
 * a ten-second task into a writing exercise, and learners would skip the whole
 * section rather than do it. The reasoning lives in the interpretation block,
 * written later when the results are back and there is something to reason from.
 */
export interface ProposedInvestigation {
  id: string
  name: Text
}

/** Where a value sits against its reference range. */
export type ResultFlag = '' | 'normal' | 'borderline' | 'abnormal'

export interface InvestigationResult {
  id: string
  name: Text
  /** Date the specimen was taken, not the date it was typed in. */
  date: Text
  value: Text
  unit: Text
  flag: ResultFlag
  /** What this single result means. Required whether typed or photographed. */
  interpretation: Text
  /**
   * A photographed result instead of, or alongside, typed values.
   * Points into `attachments`; the image still needs its own interpretation.
   */
  attachmentId: string | null
}

/**
 * Reading results, as opposed to listing them.
 *
 * Separated from `summary` on purpose: summarising is recording *what was
 * found*, interpreting is saying *what it means for this patient*. A learner
 * who only ever fills the summary box has not done the second thing, and the
 * completeness engine can now tell the difference.
 */
export interface InvestigationInterpretation {
  /** Which results are abnormal, and in which direction. */
  abnormal: Text
  /** What the results support or argue against. */
  supportsDiagnosis: Text
  /** Results that do not fit the clinical picture. */
  inconsistencies: Text
  /** What changes in the plan because of these results. */
  impactOnPlan: Text
}

export interface Investigations {
  proposed: ProposedInvestigation[]
  results: InvestigationResult[]
  interpretation: InvestigationInterpretation
  summary: Text
}

// ---------------------------------------------------------------------------
// Risk, diagnosis, management
// ---------------------------------------------------------------------------

export interface RiskFactor {
  id: string
  label: Text
  /** Risk domain id from `config/risk.ts`, e.g. 'emergency'. */
  domain: Text
  present: YesNoUnknown
  note: Text
  /** Added by the learner, not from the catalogue. Always shown, never filtered. */
  custom?: boolean
}

/**
 * One administration of a rating scale.
 *
 * `answers` holds item scores for instruments whose items we may reproduce.
 * `subscaleTotals` is for licensed instruments (HADS): the app records the
 * score the learner obtained from the official form instead of reprinting it.
 */
export interface ScaleInstance {
  scaleId: string
  answers: (number | null)[]
  subscaleTotals: Record<string, number | null>
  note: string
  updatedAt: string
}

/** Graded falls assessment, not just present/absent. */
export interface FallsAssessment {
  fellPastYear: YesNoUnknown
  fallCount: Text
  injured: YesNoUnknown
  feelsUnsteady: YesNoUnknown
  worriesAboutFalling: YesNoUnknown
  /** Timed Up and Go, seconds. */
  timedUpAndGoSeconds: Text
  chairStandCount: Text
  note: Text
}

/**
 * Cardiovascular risk — entirely learner-entered.
 *
 * ClerkMate neither computes the percentage nor pre-fills the chart inputs.
 * Knowing *which* variables a risk chart needs is part of what is being
 * learnt, so the learner assembles them, reads the chart, and records the
 * result. `inputs` is keyed by the ids in `config/cvd.ts`.
 */
export interface CvdRiskAssessment {
  inputs: Record<string, Text>
  chart: Text
  percent: Text
  band: Text
  note: Text
}

/**
 * What the learner generated *before* seeing the checklist.
 *
 * A complete checklist trains recognition, which is much easier than recall and
 * does not build the ability to think of a risk unprompted. Capturing the
 * learner's own list first keeps the checklist as a self-test rather than an
 * answer key.
 */
export interface RecallEntry {
  text: Text
  /** Set once the learner reveals the checklist for that domain. */
  revealedAt: string
  /**
   * The scaffolding mode in force when this was committed.
   *
   * Stored rather than derived: the learner's level can change afterwards, and
   * the exported record has to say how much help the app actually gave at the
   * time, not how much it would give now.
   */
  mode?: Text
}

export interface RiskAssessment {
  factors: RiskFactor[]
  /** Keyed by risk domain id. */
  recall: Record<string, RecallEntry>
  /** Sparse: only the scales the learner actually used. */
  scales: ScaleInstance[]
  falls: FallsAssessment
  cvd: CvdRiskAssessment
  overallNote: Text
}

export interface DiagnosisEntry {
  id: string
  label: Text
  icd10: Text
  icpc2: Text
  /** For comorbidities: đang điều trị / ổn định / mới phát hiện / chưa điều trị. */
  status: Text
  note: Text
}

export interface Diagnosis {
  primary: DiagnosisEntry | null
  /** Bệnh đồng mắc — first-class, because multimorbidity is the norm in FM. */
  comorbidities: DiagnosisEntry[]
  differentials: DiagnosisEntry[]
  /** Asked and nothing to record. */
  noComorbidities: boolean
  reasoning: Text
}

export interface Medication {
  id: string
  name: Text
  dose: Text
  route: Text
  frequency: Text
  duration: Text
  indication: Text
  adherence: Text
  note: Text
}

export interface Referral {
  needed: YesNoUnknown
  destination: Text
  reason: Text
  urgency: Text
}

export interface ManagementPlan {
  nonPharmacological: Text
  patientEducation: Text
  followUpInterval: Text
  followUpPlan: Text
  referral: Referral
  hospitalization: { needed: YesNoUnknown; reason: Text }
  goalsOfCare: Text
}

// ---------------------------------------------------------------------------
// Prevention
// ---------------------------------------------------------------------------

export interface ScreeningItem {
  id: string
  name: Text
  status: Text
  date: Text
  result: Text
}

export interface VaccinationItem {
  id: string
  name: Text
  date: Text
  status: Text
  note: Text
}

export interface Prevention {
  screenings: ScreeningItem[]
  vaccinations: VaccinationItem[]
  counselling: Text
  healthMaintenanceNote: Text
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export type AttachmentCategory =
  | 'lab'
  | 'ecg'
  | 'imaging'
  | 'prescription'
  | 'clinical_photo'
  | 'other'

/**
 * Whether a clinical photo shows the patient's face.
 *
 * A separate question from identifying *text*, and it has no redaction answer:
 * a blurred face is still a face. The only safe outcomes are a crop that
 * removes it or a retake, so `present` blocks the image from leaving the device.
 */
export type FaceCheck = '' | 'none' | 'present'

export interface Attachment {
  id: string
  category: AttachmentCategory
  title: Text
  date: Text
  note: Text
  mimeType: string
  /** Small data-URL preview kept inline so lists render without a blob read. */
  thumbnail: string
  /**
   * Key into the `blobs` object store holding the working image.
   *
   * This is the local copy and may still be the untouched file the learner
   * picked, metadata and all. Nothing that leaves the device may read it.
   */
  blobKey: string
  /**
   * Key of the derivative that is allowed to leave the device.
   *
   * The boundary the rest of the app depends on:
   *
   *     raw local blob → sanitise / redact → submission-safe blob → PDF, export
   *
   * Produced by re-encoding through a canvas, which drops EXIF, GPS and every
   * other embedded tag as a side effect of the pixels being redrawn. Empty
   * until the learner has resolved the image's privacy state, and the print
   * and submission paths treat empty as "not eligible" rather than falling
   * back to `blobKey`.
   */
  sanitizedBlobKey: string
  /**
   * Identifiers have been painted out of the stored image.
   *
   * The redaction is destructive — the image is re-encoded with the boxes
   * burned in and the original is overwritten. An overlay would leave the
   * patient's name sitting in the file, one export away from leaking.
   */
  redacted: boolean
  /** Learner has confirmed the image carries no patient identifiers. */
  privacyChecked: boolean
  /** Only meaningful for `clinical_photo`; `present` blocks submission. */
  faceCheck: FaceCheck
  createdAt: string
}

// ---------------------------------------------------------------------------
// Family members (genogram source of truth)
// ---------------------------------------------------------------------------

export type FamilyRelation =
  | 'self'
  | 'father'
  | 'mother'
  | 'sibling'
  | 'spouse'
  | 'child'

export interface FamilyMember {
  id: string
  /** Name or family role label, e.g. "Bà Hoa" or "Con trai".*/
  name: Text
  relation: FamilyRelation
  sex: Sex
  ageYears: number | null
  alive: boolean
  ageAtDeath: number | null
  conditions: string[]
  /** Ordering hint within a sibling / child row (left to right). */
  order: number
  note: Text
}

// ---------------------------------------------------------------------------
// Longitudinal follow-up
// ---------------------------------------------------------------------------

export interface FollowUp {
  id: string
  date: Text
  subjective: Text
  objective: Text
  assessment: Text
  plan: Text
  treatmentResponse: Text
  adherence: Text
  adverseEffects: Text
}

// ---------------------------------------------------------------------------
// Submission workflow
// ---------------------------------------------------------------------------

/**
 * Processing state of a learning record.
 *
 * Derived from the record's own content rather than set by hand, except for
 * the two states a person causes: `submitted` and `returned`. Deriving keeps
 * the badge honest — a record cannot claim to be complete while a mandatory
 * item is missing.
 */
export type CaseStatus =
  | 'new'
  | 'noting'
  | 'inProgress'
  | 'complete'
  | 'readyToSubmit'
  | 'submitted'
  | 'returned'
  | 'accepted'

/** A faculty decision recorded on the record itself. */
export interface FacultyReview {
  id: string
  at: string
  /** Typed by whoever opened the submission; not authenticated. */
  reviewer: Text
  decision: 'returned' | 'accepted'
  comment: Text
}

export interface Submission {
  /** Short code generated on submit, so a paper hand-off can reference it. */
  code: Text
  submittedAt: string
  /** Set when the learner prints the PDF. */
  exportedAt: string
  /** Editing is blocked while true. */
  locked: boolean
  /** Times the learner reopened a submitted record. */
  reopenedAt: string[]
  reviews: FacultyReview[]
  /** Reviews the learner has already seen, so a new one can be announced. */
  acknowledgedReviewIds: string[]
  /**
   * Reviews the learner has already *answered* — by resubmitting or reopening.
   *
   * Deliberately not a timestamp comparison. The reviewer's decision is stamped
   * on the reviewer's device and the learner's actions on the learner's, so
   * comparing the two clocks lets a reviewer whose clock runs slow have their
   * decision silently ignored. Identities do not drift.
   */
  answeredReviewIds: string[]
}

// ---------------------------------------------------------------------------
// Learning reflection
// ---------------------------------------------------------------------------

/**
 * What the learner took away from this case.
 *
 * This is the part that makes the record a *learning* record rather than
 * documentation: the completeness engine can tell you what is missing from a
 * chart, only the learner can say what they now understand.
 */
export interface Reflection {
  learned: Text
  difficulties: Text
  nextTime: Text
  questionsForTeacher: Text
  /** Learner's own confidence with this kind of case, 1–5. */
  selfRating: number | null
  /** Free keywords, e.g. "thoái hóa khớp", "tư vấn giảm cân". */
  tags: string[]
}

// ---------------------------------------------------------------------------
// Completeness snapshot
// ---------------------------------------------------------------------------

export type RequirementTier = 'mandatory' | 'recommended' | 'optional'

export interface CompletenessItemResult {
  id: string
  label: string
  sectionId: string
  tier: RequirementTier
  satisfied: boolean
  hint: string
  /** Part of the minimum that has to be captured during the encounter. */
  bedside: boolean
}

export interface CompletenessSnapshot {
  level: LearnerLevel
  percent: number
  mandatoryTotal: number
  mandatorySatisfied: number
  recommendedTotal: number
  recommendedSatisfied: number
  optionalTotal: number
  optionalSatisfied: number
  items: CompletenessItemResult[]
  computedAt: string
}

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

export interface CaseRecord {
  id: string
  schemaVersion: number
  createdAt: string
  updatedAt: string
  learnerLevel: LearnerLevel

  patient: Patient
  visit: Visit
  quickNotes: QuickNote[]
  history: History
  personalHistory: PersonalHistory
  lifestyle: Lifestyle
  familyHistory: FamilyHistory
  familyMedicineAssessment: FamilyMedicineAssessment
  examination: Examination
  investigations: Investigations
  riskAssessment: RiskAssessment
  diagnosis: Diagnosis
  managementPlan: ManagementPlan
  medications: Medication[]
  prevention: Prevention
  attachments: Attachment[]
  familyMembers: FamilyMember[]
  followUps: FollowUp[]
  reflection: Reflection
  submission: Submission

  /** Cached last computed completeness; recomputed on demand. */
  completeness: CompletenessSnapshot | null
}

/** Summary row used by the case list, so the list never loads full records. */
export interface CaseSummary {
  id: string
  caseLabel: string
  patientName: string
  sex: Sex
  ageYears: number | null
  chiefComplaint: string
  learnerLevel: LearnerLevel
  updatedAt: string
  percent: number
  /** Derived on read, so the list badge can never disagree with the record. */
  status: CaseStatus
  hasUnreadReview: boolean
}
