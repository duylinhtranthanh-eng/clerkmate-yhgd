/**
 * Deterministic, offline note structurer.
 *
 * It proposes; it never writes. Every suggestion carries the snippet it came
 * from so the learner can judge it, and nothing is applied without a tap.
 * This is intentionally rule-based for the MVP — `NoteStructurer` is the seam
 * where an AI parsing layer plugs in later.
 */

import type { CaseRecord } from '../types/case'
import type { NoteStructurer, StructuringSuggestion } from './types'
import { clauses, isNegated, norm, titleCase } from './text'
import {
  CONDITION_TERMS,
  DRUG_TERMS,
  OCCUPATION_TERMS,
  RED_FLAG_PATTERNS,
  RELATION_TERMS,
  SYMPTOM_TERMS,
} from './dictionaries'
import { uid } from '../utils/id'

interface Draft {
  targetKey: string
  sectionId: StructuringSuggestion['sectionId']
  fieldLabel: string
  value: string
  payload?: Record<string, string>
  snippet: string
  confidence: StructuringSuggestion['confidence']
  /** Only an AI backend fills these; the local parser has no numeric score. */
  score?: number
  reason?: string
}

const DURATION_RE = /(\d+(?:[.,]\d+)?)\s*(gio|ngay|tuan|thang|nam|hour|day|week|month|year)s?\b/
const DURATION_LABEL: Record<string, string> = {
  gio: 'giờ', hour: 'giờ',
  ngay: 'ngày', day: 'ngày',
  tuan: 'tuần', week: 'tuần',
  thang: 'tháng', month: 'tháng',
  nam: 'năm', year: 'năm',
}

function findDuration(clause: string): string | null {
  const m = norm(clause).match(DURATION_RE)
  if (!m) return null
  return `${m[1].replace(',', '.')} ${DURATION_LABEL[m[2]] ?? m[2]}`
}

function findCondition(clause: string): string | null {
  const n = ' ' + norm(clause) + ' '
  for (const term of CONDITION_TERMS) {
    for (const key of term.keys) {
      const needle = key.length <= 4 ? ` ${key} ` : key
      if (n.includes(needle)) return term.label
    }
  }
  return null
}

export function parseNote(text: string, record: CaseRecord): StructuringSuggestion[] {
  const drafts: Draft[] = []
  const add = (d: Draft) => drafts.push(d)
  const all = norm(text)
  /** Clauses already claimed by a specific detector, so they are not re-read as a complaint. */
  const consumed = new Set<number>()

  const list = clauses(text)

  // --- demographics --------------------------------------------------------
  const sexMatch = all.match(/\b(nam|nu|male|female|ong|ba|be trai|be gai)\b/)
  if (sexMatch) {
    const w = sexMatch[1]
    const sex = ['nu', 'female', 'ba', 'be gai'].includes(w) ? 'female' : 'male'
    add({
      targetKey: 'patient.sex',
      sectionId: 'patient',
      fieldLabel: 'Giới tính',
      value: sex === 'female' ? 'Nữ' : 'Nam',
      payload: { sex },
      snippet: sexMatch[0],
      confidence: 'high',
    })
  }

  // Accepts "58 tuổi", "62t", "45 y/o", and "nam 62" / "nữ 58".
  const ageMatch =
    all.match(/\b(\d{1,3})\s*(?:tuoi|t|y\/o|yo|years? old)\b/) ??
    all.match(/\b(?:nam|nu|male|female)\s*,?\s*(\d{1,3})(?!\d)/)
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10)
    if (age > 0 && age < 120) {
      add({
        targetKey: 'patient.ageYears',
        sectionId: 'patient',
        fieldLabel: 'Tuổi',
        value: `${age} tuổi`,
        payload: { age: String(age) },
        snippet: ageMatch[0],
        confidence: 'high',
      })
    }
  }

  for (const occ of OCCUPATION_TERMS) {
    if (all.includes(occ.key)) {
      add({
        targetKey: 'patient.occupation',
        sectionId: 'patient',
        fieldLabel: 'Nghề nghiệp',
        value: occ.label,
        snippet: occ.label,
        confidence: 'medium',
      })
      break
    }
  }

  // --- vital signs ---------------------------------------------------------
  list.forEach((clause, idx) => {
    const n = norm(clause)

    const bp = n.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/)
    if (bp) {
      const sys = parseInt(bp[1], 10)
      const dia = parseInt(bp[2], 10)
      if (sys >= 60 && sys <= 300 && dia >= 30 && dia <= 200 && sys > dia) {
        consumed.add(idx)
        add({
          targetKey: 'vitals.bloodPressure',
          sectionId: 'examination',
          fieldLabel: 'Huyết áp',
          value: `${sys}/${dia} mmHg`,
          payload: { systolic: String(sys), diastolic: String(dia) },
          snippet: clause,
          confidence: 'high',
        })
      }
    }

    // Accepts "mạch 78", "M 78", "M: 78", "HR 78".
    const pulse = n.match(/\b(?:mach|pulse|nhip tim|hr|m)\s*[:=]?\s*(\d{2,3})\s*(?:l\/?p|bpm|lan\/phut)?\b/)
    if (pulse) {
      consumed.add(idx)
      add({
        targetKey: 'vitals.pulse',
        sectionId: 'examination',
        fieldLabel: 'Mạch',
        value: `${pulse[1]} lần/phút`,
        payload: { pulse: pulse[1] },
        snippet: clause,
        confidence: 'high',
      })
    }

    const temp = n.match(/\b(?:sot|nhiet do|t|temp)\s*[:=]?\s*(3[5-9](?:[.,]\d)?|4[0-2](?:[.,]\d)?)\b/)
    if (temp) {
      consumed.add(idx)
      add({
        targetKey: 'vitals.temperature',
        sectionId: 'examination',
        fieldLabel: 'Nhiệt độ',
        value: `${temp[1].replace(',', '.')} °C`,
        payload: { temperatureC: temp[1].replace(',', '.') },
        snippet: clause,
        confidence: 'high',
      })
    }

    // "nhịp thở 18", "NT 18", "RR 18", "TS thở 18".
    const rr = n.match(/\b(?:nhip tho|nt|rr|ts tho|tan so tho)\s*[:=]?\s*(\d{1,2})\b/)
    if (rr) {
      const value = parseInt(rr[1], 10)
      if (value >= 8 && value <= 60) {
        consumed.add(idx)
        add({
          targetKey: 'vitals.respiratoryRate',
          sectionId: 'examination',
          fieldLabel: 'Nhịp thở',
          value: `${value} lần/phút`,
          payload: { respiratoryRate: String(value) },
          snippet: clause,
          confidence: 'high',
        })
      }
    }

    // "vòng eo 88", "VE 88".
    const waist = n.match(/\b(?:vong eo|ve)\s*[:=]?\s*(\d{2,3})\b/)
    if (waist) {
      const value = parseInt(waist[1], 10)
      if (value >= 40 && value <= 200) {
        consumed.add(idx)
        add({
          targetKey: 'vitals.waist',
          sectionId: 'examination',
          fieldLabel: 'Vòng eo',
          value: `${value} cm`,
          payload: { waistCm: String(value) },
          snippet: clause,
          confidence: 'medium',
        })
      }
    }

    const spo2 = n.match(/spo2\s*[:=]?\s*(\d{2,3})\s*%?/)
    if (spo2) {
      consumed.add(idx)
      add({
        targetKey: 'vitals.spo2',
        sectionId: 'examination',
        fieldLabel: 'SpO₂',
        value: `${spo2[1]}%`,
        payload: { spo2: spo2[1] },
        snippet: clause,
        confidence: 'high',
      })
    }

    const weight =
      n.match(/\b(\d{2,3}(?:[.,]\d)?)\s*kg\b/) ??
      n.match(/\b(?:cn|can nang)\s*[:=]?\s*(\d{2,3}(?:[.,]\d)?)\b/)
    if (weight) {
      consumed.add(idx)
      add({
        targetKey: 'vitals.weight',
        sectionId: 'examination',
        fieldLabel: 'Cân nặng',
        value: `${weight[1].replace(',', '.')} kg`,
        payload: { weightKg: weight[1].replace(',', '.') },
        snippet: clause,
        confidence: 'high',
      })
    }

    const heightCm =
      n.match(/\b(1?\d{2})\s*cm\b/) ??
      n.match(/\b(?:cc|chieu cao)\s*[:=]?\s*(1?\d{2})\b/)
    const heightM = n.match(/\b1\s*m\s*(\d{2})\b/)
    if (heightCm || heightM) {
      const cm = heightCm ? heightCm[1] : `1${heightM![1]}`
      if (parseInt(cm, 10) >= 80 && parseInt(cm, 10) <= 230) {
        consumed.add(idx)
        add({
          targetKey: 'vitals.height',
          sectionId: 'examination',
          fieldLabel: 'Chiều cao',
          value: `${cm} cm`,
          payload: { heightCm: cm },
          snippet: clause,
          confidence: 'medium',
        })
      }
    }
  })

  // --- medications ---------------------------------------------------------
  list.forEach((clause, idx) => {
    const n = norm(clause)
    const doseRe = /([a-z][a-z0-9]{3,})\s+(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|ml|ui|iu|dv)\b/g
    let m: RegExpExecArray | null
    while ((m = doseRe.exec(n)) !== null) {
      const rawName = m[1]
      const known = DRUG_TERMS.some((d) => rawName.startsWith(d.slice(0, 6)) || d.startsWith(rawName.slice(0, 6)))
      const freq = n.match(/(\d)\s*(?:v|vien|lan)\s*\/?\s*(?:ngay|day)/)
      const freqAlt = n.match(/\bx\s*(\d)\b/)
      const frequency = freq ? `${freq[1]} lần/ngày` : freqAlt ? `${freqAlt[1]} lần/ngày` : ''
      consumed.add(idx)
      add({
        targetKey: 'medications.add',
        sectionId: 'medications',
        fieldLabel: 'Thuốc đang dùng',
        value: `${titleCase(rawName)} ${m[2].replace(',', '.')} ${m[3]}${frequency ? ` — ${frequency}` : ''}`,
        payload: {
          name: titleCase(rawName),
          dose: `${m[2].replace(',', '.')} ${m[3]}`,
          frequency,
        },
        snippet: clause,
        confidence: known ? 'high' : 'low',
      })
    }
  })

  // --- family history ------------------------------------------------------
  list.forEach((clause, idx) => {
    const n = ' ' + norm(clause) + ' '
    for (const rel of RELATION_TERMS) {
      const hit = rel.keys.find((k) => n.includes(` ${k} `))
      if (!hit) continue
      const condition = findCondition(clause)
      if (!condition) continue
      consumed.add(idx)
      add({
        targetKey: 'familyHistory.add',
        sectionId: 'familyHistory',
        fieldLabel: 'Tiền căn gia đình',
        value: `${rel.label}: ${condition}`,
        payload: { condition, relatives: rel.label },
        snippet: clause,
        confidence: 'high',
      })
      add({
        targetKey: 'familyMembers.add',
        sectionId: 'genogram',
        fieldLabel: 'Thành viên gia đình (cho phả hệ)',
        value: `${rel.label} — ${condition}`,
        payload: { relation: rel.relation, name: rel.label, sex: rel.sex, condition },
        snippet: clause,
        confidence: 'medium',
      })
      break
    }
  })

  // --- past medical history ------------------------------------------------
  list.forEach((clause, idx) => {
    if (consumed.has(idx)) return
    const n = ' ' + norm(clause) + ' '
    const mentionsRelative = RELATION_TERMS.some((r) => r.keys.some((k) => n.includes(` ${k} `)))
    if (mentionsRelative) return
    const condition = findCondition(clause)
    if (!condition) return
    const since = findDuration(clause)
    consumed.add(idx)
    add({
      targetKey: 'pastMedical.add',
      sectionId: 'personalHistory',
      fieldLabel: 'Tiền căn bệnh lý',
      value: since ? `${condition} — ${since}` : condition,
      payload: { label: condition, since: since ?? '' },
      snippet: clause,
      confidence: 'high',
    })
  })

  // --- allergies -----------------------------------------------------------
  list.forEach((clause, idx) => {
    const n = norm(clause)
    if (!/di ung|allerg/.test(n)) return
    consumed.add(idx)
    if (isNegated(clause)) {
      add({
        targetKey: 'allergies.add',
        sectionId: 'personalHistory',
        fieldLabel: 'Dị ứng',
        value: 'Chưa ghi nhận dị ứng',
        payload: { agent: 'Chưa ghi nhận', reaction: '', severity: '' },
        snippet: clause,
        confidence: 'high',
      })
      return
    }
    const agent = clause.replace(/.*?(dị ứng|di ung|allergic to|allergy to)\s*/i, '').trim()
    if (agent) {
      add({
        targetKey: 'allergies.add',
        sectionId: 'personalHistory',
        fieldLabel: 'Dị ứng',
        value: agent,
        payload: { agent, reaction: '', severity: '' },
        snippet: clause,
        confidence: 'medium',
      })
    }
  })

  // --- lifestyle -----------------------------------------------------------
  list.forEach((clause, idx) => {
    const n = norm(clause)
    if (/hut thuoc|thuoc la|smok|cigarette/.test(n)) {
      consumed.add(idx)
      const packYears = n.match(/(\d+)\s*goi[\s-]*nam/)
      const quit = /bo thuoc|da bo|cai thuoc|quit/.test(n)
      const value = isNegated(clause)
        ? 'Không hút thuốc'
        : quit
          ? 'Đã bỏ thuốc lá'
          : packYears
            ? `Đang hút — ${packYears[1]} gói-năm`
            : 'Có hút thuốc lá'
      add({
        targetKey: 'lifestyle.smoking',
        sectionId: 'lifestyle',
        fieldLabel: 'Thuốc lá',
        value,
        payload: { status: value, detail: packYears ? `${packYears[1]} gói-năm` : '' },
        snippet: clause,
        confidence: 'high',
      })
    }
    if (/ruou|bia|alcohol|drink/.test(n)) {
      consumed.add(idx)
      const value = isNegated(clause) ? 'Không uống rượu bia' : 'Có uống rượu bia'
      add({
        targetKey: 'lifestyle.alcohol',
        sectionId: 'lifestyle',
        fieldLabel: 'Rượu bia',
        value,
        payload: { status: value, detail: '' },
        snippet: clause,
        confidence: 'high',
      })
    }
    if (/tap the duc|di bo|van dong|the thao|tap gym|choi cau long/.test(n)) {
      consumed.add(idx)
      add({
        targetKey: 'lifestyle.physicalActivity',
        sectionId: 'lifestyle',
        fieldLabel: 'Vận động thể lực',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
    if (/mat ngu|kho ngu|ngu kem|ngu \d/.test(n)) {
      consumed.add(idx)
      add({
        targetKey: 'lifestyle.sleep',
        sectionId: 'lifestyle',
        fieldLabel: 'Giấc ngủ',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
    if (/an man|an nhat|an kieng|che do an|an chay|an ngot/.test(n)) {
      consumed.add(idx)
      add({
        targetKey: 'lifestyle.diet',
        sectionId: 'lifestyle',
        fieldLabel: 'Chế độ ăn',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
  })

  // --- red flags -----------------------------------------------------------
  for (const clause of list) {
    const n = norm(clause)
    for (const rf of RED_FLAG_PATTERNS) {
      if (!rf.keys.some((k) => n.includes(k))) continue
      const negated = isNegated(clause)
      add({
        targetKey: negated ? 'redFlags.absent' : 'redFlags.present',
        sectionId: 'history',
        fieldLabel: negated ? 'Cờ đỏ đã loại trừ' : 'Cờ đỏ ghi nhận',
        value: rf.label,
        payload: { flag: rf.label },
        snippet: clause,
        confidence: 'medium',
      })
    }
  }

  // --- ICE -----------------------------------------------------------------
  for (const clause of list) {
    const n = norm(clause)
    if (/\bnghi (la |do |minh |bi )|tuong (la )?|cho rang/.test(n)) {
      add({
        targetKey: 'ice.ideas',
        sectionId: 'history',
        fieldLabel: 'ICE — Ideas (bệnh nhân nghĩ gì)',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
    if (/lo lang|lo so|\bso bi\b|\bso rang\b|worried|lo ngai/.test(n)) {
      add({
        targetKey: 'ice.concerns',
        sectionId: 'history',
        fieldLabel: 'ICE — Concerns (bệnh nhân lo gì)',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
    if (/mong muon|muon duoc|hy vong|de nghi bac si|xin duoc/.test(n)) {
      add({
        targetKey: 'ice.expectations',
        sectionId: 'history',
        fieldLabel: 'ICE — Expectations (bệnh nhân mong gì)',
        value: clause.trim(),
        snippet: clause,
        confidence: 'medium',
      })
    }
  }

  // --- chief complaint -----------------------------------------------------
  const complaintIdx = list.findIndex((clause, idx) => {
    if (consumed.has(idx)) return false
    const n = norm(clause)
    return SYMPTOM_TERMS.some((s) => n.includes(s))
  })
  if (complaintIdx >= 0) {
    const clause = list[complaintIdx]
    add({
      targetKey: 'history.chiefComplaint',
      sectionId: 'history',
      fieldLabel: 'Lý do chính',
      value: clause.trim(),
      snippet: clause,
      confidence: 'medium',
    })
    const dur = findDuration(clause)
    if (dur) {
      add({
        targetKey: 'history.duration',
        sectionId: 'history',
        fieldLabel: 'Thời gian diễn tiến',
        value: dur,
        snippet: clause,
        confidence: 'high',
      })
    }
  }

  // The whole note always remains available as narrative HPI.
  if (text.trim().length > 0) {
    add({
      targetKey: 'history.hpi.append',
      sectionId: 'history',
      fieldLabel: 'Thêm vào diễn tiến bệnh sử',
      value: text.trim(),
      snippet: text.trim(),
      confidence: 'low',
    })
  }

  return finalise(record, dedupe(drafts), 'local')
}

/**
 * Shared tail of every structuring backend: drop duplicates the record already
 * holds, stamp provenance, and mark values that are already filed.
 *
 * Exported so an AI backend gets the same duplicate detection as the local
 * parser instead of reimplementing it and drifting.
 */
export function finalise(
  record: CaseRecord,
  drafts: Draft[],
  origin: 'local' | 'ai',
): StructuringSuggestion[] {
  return dedupe(drafts).map((d) => ({
    id: uid('sg'),
    ...d,
    origin,
    alreadyPresent: isAlreadyPresent(record, d),
  }))
}

export type { Draft }

function dedupe(drafts: Draft[]): Draft[] {
  const seen = new Set<string>()
  const out: Draft[] = []
  for (const d of drafts) {
    const key = `${d.targetKey}::${norm(d.value)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

function isAlreadyPresent(record: CaseRecord, d: Draft): boolean {
  const eq = (a: string, b: string) => norm(a).trim() === norm(b).trim()
  switch (d.targetKey) {
    case 'patient.sex':
      return record.patient.sex === d.payload?.sex
    case 'patient.ageYears':
      return record.patient.ageYears === Number(d.payload?.age)
    case 'patient.occupation':
      return eq(record.patient.occupation, d.value)
    case 'history.chiefComplaint':
      return eq(record.history.chiefComplaint, d.value)
    case 'history.duration':
      return eq(record.history.duration, d.value)
    case 'pastMedical.add':
      return record.personalHistory.pastMedical.some((p) => eq(p.label, d.payload?.label ?? ''))
    case 'allergies.add':
      return record.personalHistory.allergies.some((a) => eq(a.agent, d.payload?.agent ?? ''))
    case 'medications.add':
      return record.medications.some((m) => eq(m.name, d.payload?.name ?? ''))
    case 'familyHistory.add':
      return record.familyHistory.entries.some(
        (e) => eq(e.condition, d.payload?.condition ?? '') && eq(e.relatives, d.payload?.relatives ?? ''),
      )
    case 'familyMembers.add':
      return record.familyMembers.some(
        (m) => m.relation === d.payload?.relation && eq(m.name, d.payload?.name ?? ''),
      )
    case 'redFlags.present':
      return record.history.redFlags.present.includes(d.value)
    case 'redFlags.absent':
      return record.history.redFlags.absent.includes(d.value)
    case 'lifestyle.smoking':
      return eq(record.lifestyle.smoking.status, d.value)
    case 'lifestyle.alcohol':
      return eq(record.lifestyle.alcohol.status, d.value)
    default:
      return false
  }
}

export const heuristicStructurer: NoteStructurer = {
  id: 'heuristic-vi',
  label: 'Phân tích ngoại tuyến',
  local: true,
  async structure(text, record) {
    return parseNote(text, record)
  },
}
