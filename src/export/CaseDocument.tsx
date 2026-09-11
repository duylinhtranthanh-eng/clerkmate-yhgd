/**
 * Print-ready rendering of a CaseRecord.
 *
 * Used both for the on-screen review and, via the print stylesheet, as the
 * exported PDF. Rendering the same component for both means what the learner
 * previews is exactly what gets exported.
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CaseRecord } from '../types/case'
import type { LearnerProfile } from '../types/profile'
import { GenogramSvg } from '../genogram/GenogramSvg'
import { resolveFamilyMembers } from '../genogram/resolve'
import { completedScales, scaleMaxScore } from '../scales/scoring'
import { fallsBand } from '../config/falls'
import {
  APGAR_ITEMS,
  ATTACHMENT_CATEGORIES,
  PROBLEM_SYSTEMS,
  SCREEM_DOMAINS,
  interpretApgar,
} from '../config/clinical'
import { RISK_DOMAINS } from '../config/risk'
import { LEVELS } from '../config/levels'
import { CVD_INPUTS } from '../config/cvd'
import { SEX_LABEL, bmiCategory, formatDate, formatDateTime, nonEmpty } from '../utils/format'
import { faceDeclaredPresent, isSubmissionSafe } from '../workflow/privacy'
import { getAttachmentBlob } from '../db/repository'

/**
 * Full-resolution images for the printed record.
 *
 * The list thumbnails are 320px at quality 0.72 — fine for a grid on a phone,
 * useless for reading a lab slip on paper. What the reader needs is the
 * sanitized derivative itself, so it is loaded here as an object URL. Only
 * `sanitizedBlobKey` is ever read: the picked file never reaches the page.
 */
function useSanitizedImages(record: CaseRecord): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  // Every edit clones the record, so the array's identity is not a useful
  // dependency; what matters is which derivative each attachment points at.
  const key = record.attachments.map((a) => `${a.id}:${a.sanitizedBlobKey}`).join('|')

  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    void (async () => {
      const next: Record<string, string> = {}
      for (const a of record.attachments) {
        if (!isSubmissionSafe(a)) continue
        const blob = await getAttachmentBlob(a.sanitizedBlobKey)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        created.push(url)
        next[a.id] = url
      }
      if (cancelled) {
        created.forEach(URL.revokeObjectURL)
        return
      }
      setUrls(next)
    })()
    return () => {
      cancelled = true
      created.forEach(URL.revokeObjectURL)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}

function Section({
  title,
  children,
  empty,
}: {
  title: string
  children: ReactNode
  empty?: boolean
}) {
  if (empty) return null
  return (
    <section className="print-avoid-break">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/**
 * A heading inside a section. A conventional Vietnamese bệnh án has around a
 * dozen numbered parts, not twenty-one, so related material sits together under
 * one Roman numeral and each piece keeps its own heading and its own silence
 * when there is nothing to say.
 */
function SubSection({
  title,
  children,
  empty,
}: {
  title: string
  children: ReactNode
  empty?: boolean
}) {
  if (empty) return null
  return (
    <div className="doc__sub">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '' || value === false) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

function Para({ text }: { text: string }) {
  if (!nonEmpty(text)) return null
  return <p className="doc__free">{text}</p>
}

/**
 * Diagonal watermark carrying the declared level.
 *
 * The level is self-declared and this app has no accounts, so it cannot be
 * enforced — but a record printed at Y2 says Y2 on every page, and the teacher
 * knows what year the student is actually in.
 */
function Watermark({
  record,
  profile,
}: {
  record: CaseRecord
  profile: LearnerProfile | null
}) {
  const text = `${record.learnerLevel} · ${profile?.studentId ?? 'ClerkMate'}`
  return (
    <div className="print-watermark" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i}>{text}</span>
      ))}
    </div>
  )
}

/**
 * States the level the record was documented at, and flags the two things a
 * teacher would otherwise have to spot by hand: a level that was changed after
 * the case began, and a case level that no longer matches the profile.
 */
function LevelStamp({
  record,
  profile,
}: {
  record: CaseRecord
  profile: LearnerProfile | null
}) {
  const history = profile?.levelHistory ?? []
  const changedAfterStart = history.filter((h) => h.at > record.createdAt)
  const mismatch = profile && profile.level !== record.learnerLevel
  return (
    <div className="print-stamp">
      <strong>Bệnh án lập ở mức {record.learnerLevel}</strong> — {LEVELS[record.learnerLevel].label}.
      {history.length > 1 && (
        <>
          {' '}
          Trình độ đã khai: {history.map((h) => h.level).join(' → ')}.
        </>
      )}
      {changedAfterStart.length > 0 && (
        <>
          {' '}
          <strong>
            Lưu ý: trình độ được thay đổi sau khi ca này bắt đầu ({changedAfterStart
              .map((h) => `${h.level} lúc ${formatDateTime(h.at)}`)
              .join(', ')}).
          </strong>
        </>
      )}
      {mismatch && (
        <>
          {' '}
          <strong>Lưu ý: hồ sơ người học hiện đang khai mức {profile!.level}.</strong>
        </>
      )}
    </div>
  )
}

export function CaseDocument({
  record,
  profile,
}: {
  record: CaseRecord
  profile: LearnerProfile | null
}) {
  const imageUrls = useSanitizedImages(record)
  const p = record.patient
  const v = record.examination.vitals
  const fm = record.familyMedicineAssessment
  const apgarAnswered = APGAR_ITEMS.every((i) => fm.apgar[i.key] !== null)
  const apgarTotal = APGAR_ITEMS.reduce<number>((a, i) => a + (fm.apgar[i.key] ?? 0), 0)
  const abnormalSystems = record.examination.systems.filter(
    (s) => s.status === 'abnormal' && nonEmpty(s.findings),
  )
  const normalSystems = record.examination.systems.filter((s) => s.status === 'normal')
  const examined = [...abnormalSystems, ...normalSystems]
  const riskPresent = record.riskAssessment.factors.filter((f) => f.present === 'yes')
  const riskAbsent = record.riskAssessment.factors.filter((f) => f.present === 'no')
  const screenings = record.prevention.screenings.filter((s) => nonEmpty(s.status))
  const vaccinations = record.prevention.vaccinations.filter((s) => nonEmpty(s.status))

  // Each section states once whether it has anything to print. A merged
  // section needs its parts' answers to decide whether to print a heading at
  // all, and naming them keeps the same condition from being written twice.
  const emptyHistory = !nonEmpty(record.history.hpi) && !nonEmpty(record.history.systemsReview)
  const emptyRedFlags = record.history.redFlags.present.length === 0 && record.history.redFlags.absent.length === 0 && !nonEmpty(record.history.redFlags.note) && !Object.values(record.history.ice).some(nonEmpty)
  const emptyPersonal = record.personalHistory.pastMedical.length === 0 && record.personalHistory.pastSurgical.length === 0 && record.personalHistory.allergies.length === 0 && !record.personalHistory.noPastMedical && !record.personalHistory.noPastSurgical && !record.personalHistory.noAllergies && !nonEmpty(record.personalHistory.note)
  const emptyReproductive = p.sex !== 'female' || !Object.entries(record.personalHistory.reproductive).some( ([k, val]) => k !== 'applicable' && nonEmpty(String(val)), )
  const emptyLifestyle = !Object.values(record.lifestyle).some((x) => (typeof x === 'string' ? nonEmpty(x) : nonEmpty(x.status) || nonEmpty(x.detail)))
  const emptyFamilyHistory = record.familyHistory.entries.length === 0 && !record.familyHistory.none && !nonEmpty(record.familyHistory.note)
  const emptyFamilyAssessment = !nonEmpty(fm.familyType) && !nonEmpty(fm.familyLifeCycleStage) && !apgarAnswered && !SCREEM_DOMAINS.some((d) => nonEmpty(fm.screem[d.key].resources) || nonEmpty(fm.screem[d.key].pathology)) && !nonEmpty(fm.homeEnvironment) && !nonEmpty(fm.continuityNote)
  const emptyGenogram = record.familyMembers.filter((m) => m.relation !== 'self').length === 0
  // The paper form puts pulse and pressure in a table of their own at the top,
  // and starts the systems examination with the general appearance, so the two
  // are separate blocks here rather than one "khám lâm sàng".
  const emptyVitals = !Object.values(v).some(nonEmpty)
  const emptySystems =
    !nonEmpty(record.examination.generalAppearance) &&
    examined.length === 0 &&
    !nonEmpty(record.examination.note)
  const emptyInvestigations = record.investigations.proposed.length === 0 && record.investigations.results.length === 0 && !nonEmpty(record.investigations.summary)
  const emptyRisk = riskPresent.length === 0 && riskAbsent.length === 0 && !nonEmpty(record.riskAssessment.overallNote)
  const emptyDiagnosis = !record.diagnosis.primary && record.diagnosis.comorbidities.length === 0 && record.diagnosis.differentials.length === 0
  const emptyPlan = !nonEmpty(record.managementPlan.nonPharmacological) && !nonEmpty(record.managementPlan.patientEducation) && !nonEmpty(record.managementPlan.followUpPlan) && !nonEmpty(record.managementPlan.followUpInterval) && record.managementPlan.referral.needed === 'unknown'
  const emptyMeds = record.medications.length === 0
  const emptyPrevention = screenings.length === 0 && vaccinations.length === 0 && !nonEmpty(record.prevention.counselling) && !nonEmpty(record.prevention.healthMaintenanceNote)
  const emptyFollowUps = record.followUps.length === 0
  const emptyReflection = !nonEmpty(record.reflection.learned) && !nonEmpty(record.reflection.difficulties) && !nonEmpty(record.reflection.nextTime) && !nonEmpty(record.reflection.questionsForTeacher)
  const emptyAttachments = record.attachments.length === 0

  return (
    <article className="doc">
      <Watermark record={record} profile={profile} />

      <header>
        <h1>PHÒNG KHÁM THỰC HÀNH Y HỌC GIA ĐÌNH</h1>
        <p className="doc__subtitle">BỆNH ÁN Y HỌC GIA ĐÌNH</p>
        <p className="doc__meta">
          {p.caseLabel && `${p.caseLabel} · `}
          {LEVELS[record.learnerLevel].label} · Lập ngày {formatDate(record.createdAt)} · Cập nhật{' '}
          {formatDateTime(record.updatedAt)}
        </p>
        {profile && (
          <dl style={{ margin: '10px 0 0' }}>
            <Row label="Người học" value={profile.fullName} />
            <Row label="Mã số" value={profile.studentId} />
            <Row label="Lớp / nhóm" value={profile.classGroup} />
          </dl>
        )}

        <LevelStamp record={record} profile={profile} />
      </header>

      <Section title="Hành chính">
        <dl>
          <Row label="Số hồ sơ" value={p.fileNumber} />
          <Row label="MSGĐ" value={p.familyCode} />
          <Row label="Tên / mã ca" value={p.name} />
          <Row label="Tuổi" value={p.ageYears !== null ? `${p.ageYears}` : ''} />
          <Row label="Giới tính" value={p.sex !== 'unknown' ? SEX_LABEL[p.sex] : ''} />
          <Row label="Nghề nghiệp" value={p.occupation} />
          <Row label="Học vấn" value={p.education} />
          <Row label="Hôn nhân" value={p.maritalStatus} />
          <Row label="Dân tộc" value={p.ethnicity} />
          <Row label="Tôn giáo" value={p.religion} />
          <Row label="Nơi ở" value={p.address} />
          <Row label="Số điện thoại" value={p.phone} />
          <Row label="Bảo hiểm y tế" value={p.insurance} />
          <Row label="Ngày khám" value={formatDate(record.visit.date)} />
          <Row label="Nơi khám" value={record.visit.setting} />
          <Row label="Hình thức" value={record.visit.encounterType} />
          <Row label="Người đi cùng" value={record.visit.accompaniedBy} />
        </dl>
      </Section>

      <Section title="Lý do khám">
        <dl>
          <Row label="Than phiền chính" value={record.history.chiefComplaint} />
          <Row label="Thời gian" value={record.history.duration} />
          <Row label="Lý do khám" value={record.visit.reasonForEncounter} />
        </dl>
      </Section>

      <Section title="Sinh hiệu" empty={emptyVitals}>
        <dl>
          <Row
            label="Huyết áp"
            value={nonEmpty(v.systolic) && nonEmpty(v.diastolic) ? `${v.systolic}/${v.diastolic} mmHg` : ''}
          />
          <Row label="Mạch" value={nonEmpty(v.pulse) ? `${v.pulse} lần/phút` : ''} />
          <Row label="Nhịp thở" value={nonEmpty(v.respiratoryRate) ? `${v.respiratoryRate} lần/phút` : ''} />
          <Row label="Nhiệt độ" value={nonEmpty(v.temperatureC) ? `${v.temperatureC} °C` : ''} />
          <Row label="SpO₂" value={nonEmpty(v.spo2) ? `${v.spo2}%` : ''} />
          <Row label="Chiều cao" value={nonEmpty(v.heightCm) ? `${v.heightCm} cm` : ''} />
          <Row label="Cân nặng" value={nonEmpty(v.weightKg) ? `${v.weightKg} kg` : ''} />
          <Row label="Vòng eo" value={nonEmpty(v.waistCm) ? `${v.waistCm} cm` : ''} />
          <Row label="BMI" value={nonEmpty(v.bmi) ? `${v.bmi} — ${bmiCategory(v.bmi)}` : ''} />
          <Row label="Đường huyết" value={v.bloodGlucose} />
        </dl>
      </Section>

      <Section title="Bệnh sử (Redflag, SOCRATES, ICE)" empty={emptyHistory && emptyRedFlags}>
        <SubSection title="SOCRATES và diễn tiến" empty={emptyHistory}>
            <Para text={record.history.hpi} />
            {Object.values(record.history.socrates).some(nonEmpty) && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>SOCRATES</p>
                <dl>
                  <Row label="Vị trí" value={record.history.socrates.site} />
                  <Row label="Khởi phát" value={record.history.socrates.onset} />
                  <Row label="Tính chất" value={record.history.socrates.character} />
                  <Row label="Hướng lan" value={record.history.socrates.radiation} />
                  <Row label="Triệu chứng kèm" value={record.history.socrates.associations} />
                  <Row label="Diễn tiến" value={record.history.socrates.timeCourse} />
                  <Row label="Tăng / giảm" value={record.history.socrates.exacerbatingRelieving} />
                  <Row label="Mức độ" value={record.history.socrates.severity} />
                </dl>
              </>
            )}
            {nonEmpty(record.history.systemsReview) && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Rà soát cơ quan</p>
                <Para text={record.history.systemsReview} />
              </>
            )}
        </SubSection>
        <SubSection title="Dấu hiệu báo động (Redflag) · ICE" empty={emptyRedFlags}>
            <dl>
              <Row
                label="Cờ đỏ ghi nhận"
                value={record.history.redFlags.present.length > 0 ? record.history.redFlags.present.join('; ') : ''}
              />
              <Row
                label="Cờ đỏ đã loại trừ"
                value={record.history.redFlags.absent.length > 0 ? record.history.redFlags.absent.join('; ') : ''}
              />
              <Row label="Ghi chú cờ đỏ" value={record.history.redFlags.note} />
              <Row label="Ideas" value={record.history.ice.ideas} />
              <Row label="Concerns" value={record.history.ice.concerns} />
              <Row label="Expectations" value={record.history.ice.expectations} />
            </dl>
        </SubSection>
      </Section>

      <Section title="Các vấn đề đã và hiện có" empty={emptyPersonal && emptyLifestyle}>
        <SubSection title="Bệnh và dị ứng" empty={emptyPersonal}>
            {record.personalHistory.pastMedical.length === 0 && record.personalHistory.noPastMedical && (
              <p style={{ margin: '0 0 4px' }}>
                <strong>Nội khoa:</strong> đã hỏi, không ghi nhận bệnh nền.
              </p>
            )}
            {record.personalHistory.pastSurgical.length === 0 && record.personalHistory.noPastSurgical && (
              <p style={{ margin: '0 0 4px' }}>
                <strong>Ngoại khoa:</strong> đã hỏi, chưa phẫu thuật.
              </p>
            )}
            {record.personalHistory.allergies.length === 0 && record.personalHistory.noAllergies && (
              <p style={{ margin: '0 0 4px' }}>
                <strong>Dị ứng:</strong> đã hỏi, không ghi nhận.
              </p>
            )}
            {record.personalHistory.pastMedical.length > 0 && (
              <>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Nội khoa</p>
                {/*
                  Filed by body system, the way the paper form's table is. A
                  problem the learner never filed still prints, under "Chưa
                  phân loại" — it must not vanish because a dropdown was left
                  alone.
                */}
                <dl>
                  {[...PROBLEM_SYSTEMS, ''].map((sys) => {
                    const items = record.personalHistory.pastMedical.filter((m) =>
                      sys === '' ? !PROBLEM_SYSTEMS.includes(m.system) : m.system === sys,
                    )
                    if (items.length === 0) return null
                    return (
                      <Row
                        key={sys || 'unfiled'}
                        label={sys || 'Chưa phân loại'}
                        value={items
                          .map((m) =>
                            [m.label, m.since && `từ ${m.since}`, m.status, m.note]
                              .filter(nonEmpty)
                              .join(' — '),
                          )
                          .join('; ')}
                      />
                    )
                  })}
                </dl>
              </>
            )}
            {record.personalHistory.pastSurgical.length > 0 && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Ngoại khoa</p>
                <ul>
                  {record.personalHistory.pastSurgical.map((m) => (
                    <li key={m.id}>
                      {m.label}
                      {m.since && ` — ${m.since}`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {record.personalHistory.allergies.length > 0 && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Dị ứng</p>
                <ul>
                  {record.personalHistory.allergies.map((a) => (
                    <li key={a.id}>
                      {a.agent}
                      {a.reaction && ` — ${a.reaction}`}
                      {a.severity && ` (${a.severity})`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Para text={record.personalHistory.note} />
        </SubSection>
        <SubSection title="Thói quen lối sống" empty={emptyLifestyle}>
            <dl>
              <Row
                label="Thuốc lá"
                value={[record.lifestyle.smoking.status, record.lifestyle.smoking.detail].filter(nonEmpty).join(' — ')}
              />
              <Row
                label="Rượu bia"
                value={[record.lifestyle.alcohol.status, record.lifestyle.alcohol.detail].filter(nonEmpty).join(' — ')}
              />
              <Row label="Vận động" value={record.lifestyle.physicalActivity} />
              <Row label="Dinh dưỡng" value={record.lifestyle.diet} />
              <Row label="Giấc ngủ" value={record.lifestyle.sleep} />
              <Row label="Chất gây nghiện" value={record.lifestyle.substanceUse} />
              <Row label="Căng thẳng" value={record.lifestyle.stress} />
              <Row label="Phơi nhiễm nghề nghiệp" value={record.lifestyle.occupationalExposure} />
            </dl>
        </SubSection>
      </Section>

      <Section title="Tiền sử gia đình" empty={emptyFamilyHistory}>
          {record.familyHistory.entries.length === 0 && record.familyHistory.none && (
            <p style={{ margin: 0 }}>Đã hỏi, không ghi nhận bệnh lý gia đình đáng kể.</p>
          )}
          {record.familyHistory.entries.length > 0 && (
            <ul>
              {record.familyHistory.entries.map((e) => (
                <li key={e.id}>
                  {e.relatives ? `${e.relatives}: ` : ''}
                  {e.condition}
                  {e.note && ` — ${e.note}`}
                </li>
              ))}
            </ul>
          )}
          <Para text={record.familyHistory.note} />
      </Section>

      <Section title="Cá nhân" empty={emptyReproductive && emptyFamilyAssessment}>
        <SubSection title="Sản phụ khoa" empty={emptyReproductive}>
            <dl>
              <Row label="Tuổi có kinh" value={record.personalHistory.reproductive.menarcheAge} />
              <Row label="Chu kỳ" value={record.personalHistory.reproductive.cycle} />
              <Row label="Kinh cuối" value={record.personalHistory.reproductive.lmp} />
              <Row label="PARA" value={record.personalHistory.reproductive.para} />
              <Row label="Ngừa thai" value={record.personalHistory.reproductive.contraception} />
              <Row label="Mãn kinh" value={record.personalHistory.reproductive.menopause} />
              <Row label="Ghi chú" value={record.personalHistory.reproductive.obstetricNote} />
            </dl>
        </SubSection>
        <SubSection title="Vòng đời gia đình · Family APGAR · SCREEM" empty={emptyFamilyAssessment}>
            <dl>
              <Row label="Kiểu gia đình" value={fm.familyType} />
              <Row label="Chu kỳ sống gia đình" value={fm.familyLifeCycleStage} />
              <Row label="Nhận định chu kỳ" value={fm.familyLifeCycleNote} />
              <Row
                label="Family APGAR"
                value={apgarAnswered ? `${apgarTotal}/10 — ${interpretApgar(apgarTotal)}` : ''}
              />
              <Row label="Ghi chú APGAR" value={fm.apgar.note} />
            </dl>

            {SCREEM_DOMAINS.some((d) => nonEmpty(fm.screem[d.key].resources) || nonEmpty(fm.screem[d.key].pathology)) && (
              <>
                <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>SCREEM</p>
                <dl>
                  {SCREEM_DOMAINS.map((d) => {
                    const e = fm.screem[d.key]
                    const value = [
                      nonEmpty(e.resources) ? `Nguồn lực: ${e.resources}` : '',
                      nonEmpty(e.pathology) ? `Trở ngại: ${e.pathology}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return <Row key={d.key} label={d.label} value={value} />
                  })}
                </dl>
              </>
            )}

            <dl>
              <Row label="Môi trường sống" value={fm.homeEnvironment} />
              <Row label="Chăm sóc liên tục" value={fm.continuityNote} />
            </dl>
        </SubSection>
      </Section>

      <Section title="Khám hệ cơ quan" empty={emptySystems}>
        <dl>
          <Row label="Tổng trạng" value={record.examination.generalAppearance} />
        </dl>
        {abnormalSystems.length > 0 && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Khám theo cơ quan — bất thường</p>
            <dl>
              {abnormalSystems.map((s) => (
                <Row key={s.id} label={s.label} value={s.findings} />
              ))}
            </dl>
          </>
        )}
        {normalSystems.length > 0 && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Khám theo cơ quan — bình thường</p>
            <dl>
              {normalSystems.map((s) => (
                <Row key={s.id} label={s.label} value={s.findings || 'Bình thường'} />
              ))}
            </dl>
          </>
        )}
        <Para text={record.examination.note} />
      </Section>

      <Section title="Đề nghị cận lâm sàng · Tóm tắt cận lâm sàng đã có" empty={emptyInvestigations}>
          {record.investigations.proposed.length > 0 && (
            <>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Đề nghị</p>
              <ul>
                {record.investigations.proposed.map((i) => (
                  <li key={i.id}>{i.name}</li>
                ))}
              </ul>
            </>
          )}
          {record.investigations.results.length > 0 && (
            <>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Kết quả</p>
              <ul>
                {record.investigations.results.map((r) => (
                  <li key={r.id}>
                    {r.name}: {r.value} {r.unit}
                    {r.flag === 'abnormal' && ' — bất thường'}
                    {r.flag === 'borderline' && ' — ranh giới'}
                    {r.flag === 'normal' && ' — bình thường'}
                    {r.date && ` — lấy mẫu ${formatDate(r.date)}`}
                    {r.attachmentId && ' — có ảnh đính kèm'}
                    {r.interpretation && ` — ${r.interpretation}`}
                  </li>
                ))}
              </ul>
            </>
          )}
          {nonEmpty(record.investigations.summary) && (
            <>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Tóm tắt</p>
              <Para text={record.investigations.summary} />
            </>
          )}
          {(nonEmpty(record.investigations.interpretation.abnormal) ||
            nonEmpty(record.investigations.interpretation.supportsDiagnosis) ||
            nonEmpty(record.investigations.interpretation.inconsistencies) ||
            nonEmpty(record.investigations.interpretation.impactOnPlan)) && (
            <>
              <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Lý giải kết quả</p>
              <dl>
                <Row label="Bất thường" value={record.investigations.interpretation.abnormal} />
                <Row
                  label="Ủng hộ / không ủng hộ"
                  value={record.investigations.interpretation.supportsDiagnosis}
                />
                <Row
                  label="Chưa phù hợp lâm sàng"
                  value={record.investigations.interpretation.inconsistencies}
                />
                <Row label="Thay đổi trong xử trí" value={record.investigations.interpretation.impactOnPlan} />
              </dl>
            </>
          )}
      </Section>

      <Section title="Xác định yếu tố nguy cơ" empty={emptyRisk}>
        {riskPresent.length > 0 && (
          <>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Ghi nhận có</p>
            <dl>
              {RISK_DOMAINS.map((d) => {
                const items = riskPresent.filter((f) => f.domain === d.id)
                if (items.length === 0) return null
                return (
                  <Row
                    key={d.id}
                    label={`${d.step}. ${d.label}`}
                    value={items
                      .map((f) => (nonEmpty(f.note) ? `${f.label} (${f.note})` : f.label))
                      .join('; ')}
                  />
                )
              })}
            </dl>
          </>
        )}
        {(() => {
          const falls = fallsBand(record.riskAssessment.falls)
          if (!falls.level) return null
          return (
            <>
              <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Mức độ nguy cơ té ngã</p>
              <dl>
                <Row label="Kết luận" value={falls.label} />
                <Row label="Căn cứ" value={falls.reasons.join('; ')} />
                <Row
                  label="Timed Up and Go"
                  value={
                    nonEmpty(record.riskAssessment.falls.timedUpAndGoSeconds)
                      ? `${record.riskAssessment.falls.timedUpAndGoSeconds} giây`
                      : ''
                  }
                />
                <Row label="Ghi chú" value={record.riskAssessment.falls.note} />
              </dl>
            </>
          )
        })()}

        {(nonEmpty(record.riskAssessment.cvd.percent) || nonEmpty(record.riskAssessment.cvd.band)) && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Nguy cơ tim mạch 10 năm</p>
            <dl>
              <Row
                label="Kết quả"
                value={[record.riskAssessment.cvd.percent && `${record.riskAssessment.cvd.percent}%`, record.riskAssessment.cvd.band]
                  .filter(Boolean)
                  .join(' — ')}
              />
              <Row label="Biểu đồ sử dụng" value={record.riskAssessment.cvd.chart} />
              <Row
                label="Biến số người học dùng để tra"
                value={CVD_INPUTS.filter((i) => nonEmpty(record.riskAssessment.cvd.inputs[i.id] ?? ''))
                  .map((i) => `${i.label}: ${record.riskAssessment.cvd.inputs[i.id]}`)
                  .join('; ')}
              />
              <Row label="Ghi chú" value={record.riskAssessment.cvd.note} />
            </dl>
          </>
        )}

        {completedScales(record).length > 0 && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Thang điểm đã thực hiện</p>
            <dl>
              {completedScales(record).map((sm) => (
                <Row
                  key={sm.def.id}
                  label={sm.def.name}
                  value={
                    sm.def.availability === 'licensed'
                      ? (sm.def.subscales ?? []).length > 0
                        ? (sm.def.subscales ?? [])
                            .map((sub) => `${sub.label}: ${sm.inst?.subscaleTotals[sub.id] ?? '—'}`)
                            .join(' · ')
                        : `${sm.inst?.subscaleTotals.total ?? '—'}/${scaleMaxScore(sm.def)}`
                      : `${sm.total}/${scaleMaxScore(sm.def)}${sm.band ? ` — ${sm.band.label}` : ''}${
                          nonEmpty(sm.inst?.note ?? '') ? ` (${sm.inst?.note})` : ''
                        }`
                  }
                />
              ))}
            </dl>
          </>
        )}

        {/*
          What the record carries is the learner's own clinical reasoning. How
          much help the app gave them to reach it is a fact about the software,
          not about the patient, so it does not appear on the chart.
        */}
        {Object.entries(record.riskAssessment.recall).some(([, v]) => nonEmpty(v.text)) && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Người học tự liệt kê</p>
            <dl>
              {RISK_DOMAINS.filter((d) => nonEmpty(record.riskAssessment.recall[d.id]?.text ?? '')).map((d) => (
                <Row
                  key={d.id}
                  label={`${d.step}. ${d.label}`}
                  value={record.riskAssessment.recall[d.id].text.replace(/\n+/g, ' · ').replace(/^[-·\s]+/, '')}
                />
              ))}
            </dl>
          </>
        )}

        {nonEmpty(record.riskAssessment.overallNote) && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Nhận định</p>
            <Para text={record.riskAssessment.overallNote} />
          </>
        )}
      </Section>

      <Section title="Chẩn đoán (ICD-10, ICPC-2)" empty={emptyDiagnosis}>
        <dl>
          <Row
            label="Chẩn đoán chính"
            value={
              record.diagnosis.primary
                ? `${record.diagnosis.primary.label}${
                    record.diagnosis.primary.icd10 ? ` — ICD-10: ${record.diagnosis.primary.icd10}` : ''
                  }${record.diagnosis.primary.icpc2 ? ` · ICPC-2: ${record.diagnosis.primary.icpc2}` : ''}`
                : ''
            }
          />
        </dl>
        {record.diagnosis.comorbidities.length > 0 ? (
          <>
            <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>
              Chẩn đoán kèm theo — bệnh đồng mắc ({record.diagnosis.comorbidities.length})
            </p>
            <ul>
              {record.diagnosis.comorbidities.map((d) => (
                <li key={d.id}>
                  {d.label}
                  {d.icd10 && ` — ICD-10: ${d.icd10}`}
                  {d.icpc2 && ` · ICPC-2: ${d.icpc2}`}
                  {d.status && ` — ${d.status}`}
                  {d.note && ` (${d.note})`}
                </li>
              ))}
            </ul>
          </>
        ) : (
          record.diagnosis.noComorbidities && (
            <p style={{ margin: '8px 0 4px' }}>
              <strong>Bệnh đồng mắc:</strong> không ghi nhận.
            </p>
          )
        )}
        {record.diagnosis.differentials.length > 0 && (
          <>
            <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Chẩn đoán phân biệt</p>
            <ul>
              {record.diagnosis.differentials.map((d) => (
                <li key={d.id}>
                  {d.label}
                  {d.note && ` — ${d.note}`}
                </li>
              ))}
            </ul>
          </>
        )}
        {nonEmpty(record.diagnosis.reasoning) && (
          <>
            <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Lập luận</p>
            <Para text={record.diagnosis.reasoning} />
          </>
        )}
      </Section>

      <Section title="Kế hoạch quản lý" empty={emptyPlan}>
          <dl>
            <Row label="Không dùng thuốc" value={record.managementPlan.nonPharmacological} />
            <Row label="Mục tiêu điều trị" value={record.managementPlan.goalsOfCare} />
            <Row label="Giáo dục sức khỏe" value={record.managementPlan.patientEducation} />
            <Row label="Hẹn tái khám" value={record.managementPlan.followUpInterval} />
            <Row label="Nội dung theo dõi" value={record.managementPlan.followUpPlan} />
            <Row
              label="Chuyển tuyến"
              value={
                record.managementPlan.referral.needed === 'yes'
                  ? `Có — ${record.managementPlan.referral.destination}${
                      record.managementPlan.referral.reason ? ` (${record.managementPlan.referral.reason})` : ''
                    }`
                  : record.managementPlan.referral.needed === 'no'
                    ? 'Không'
                    : ''
              }
            />
            <Row
              label="Nhập viện"
              value={
                record.managementPlan.hospitalization.needed === 'yes'
                  ? `Có — ${record.managementPlan.hospitalization.reason}`
                  : record.managementPlan.hospitalization.needed === 'no'
                    ? 'Không'
                    : ''
              }
            />
          </dl>
      </Section>

      <Section title="Toa thuốc" empty={emptyMeds}>
          <ul>
            {record.medications.map((m) => (
              <li key={m.id}>
                <strong>{m.name}</strong> {m.dose}
                {m.route && `, ${m.route}`}
                {m.frequency && `, ${m.frequency}`}
                {m.duration && `, ${m.duration}`}
                {m.indication && ` — ${m.indication}`}
                {m.adherence && ` (tuân thủ: ${m.adherence})`}
              </li>
            ))}
          </ul>
      </Section>

      <Section title="Biện pháp duy trì sức khoẻ và tham vấn" empty={emptyPrevention}>
          {screenings.length > 0 && (
            <>
              <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Tầm soát</p>
              <ul>
                {screenings.map((s) => (
                  <li key={s.id}>
                    {s.name}: {s.status}
                    {s.date && ` (${formatDate(s.date)})`}
                    {s.result && ` — ${s.result}`}
                  </li>
                ))}
              </ul>
            </>
          )}
          {vaccinations.length > 0 && (
            <>
              <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Tiêm chủng</p>
              <ul>
                {vaccinations.map((s) => (
                  <li key={s.id}>
                    {s.name}: {s.status}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Para text={record.prevention.counselling} />
          <Para text={record.prevention.healthMaintenanceNote} />
      </Section>

      <Section title="Sơ đồ cây phả hệ" empty={emptyGenogram}>
          <GenogramSvg members={resolveFamilyMembers(record)} />
          {nonEmpty(fm.familyLifeCycleStage) && (
            <p className="doc__meta" style={{ marginTop: 8 }}>
              Vòng đời gia đình: {fm.familyLifeCycleStage}
            </p>
          )}
      </Section>

      <Section title="Theo dõi" empty={emptyFollowUps}>
          {record.followUps.map((f) => (
            <div key={f.id} className="print-avoid-break" style={{ marginBottom: 10 }}>
              <p style={{ margin: '0 0 3px', fontWeight: 600 }}>{f.date ? formatDate(f.date) : 'Lần theo dõi'}</p>
              <dl>
                <Row label="S" value={f.subjective} />
                <Row label="O" value={f.objective} />
                <Row label="A" value={f.assessment} />
                <Row label="P" value={f.plan} />
                <Row label="Đáp ứng điều trị" value={f.treatmentResponse} />
                <Row label="Tuân thủ" value={f.adherence} />
                <Row label="Tác dụng phụ" value={f.adverseEffects} />
              </dl>
            </div>
          ))}
      </Section>

      <Section title="Hình ảnh đính kèm" empty={emptyAttachments}>
          <ul>
            {record.attachments.map((a) => (
              <li key={a.id}>
                {a.title || 'Không tiêu đề'} — {ATTACHMENT_CATEGORIES.find((c) => c.id === a.category)?.label}
                {a.date && ` (${formatDate(a.date)})`}
                {a.redacted
                  ? ' — đã che thông tin định danh'
                  : isSubmissionSafe(a)
                    ? ' — đã kiểm tra, không có thông tin định danh'
                    : faceDeclaredPresent(a)
                      ? ' — CÓ KHUÔN MẶT BỆNH NHÂN, ảnh bị giữ lại, không in'
                      : ' — CHƯA kiểm tra thông tin định danh, ảnh không được in'}
                {a.note && ` — ${a.note}`}
              </li>
            ))}
          </ul>
          {/*
            Only the sanitized derivative is ever printed, and it is printed
            whole: a lab slip with its header and footer cropped away is not
            evidence of anything. Each image keeps its own proportions and is
            captioned, the way an appendix figure is.
          */}
          <div className="doc__figures">
            {record.attachments
              .filter((a) => isSubmissionSafe(a) && (imageUrls[a.id] || a.thumbnail))
              .map((a) => (
                <figure key={a.id} className="print-avoid-break">
                  <img src={imageUrls[a.id] || a.thumbnail} alt={a.title} />
                  <figcaption>
                    {a.title || 'Ảnh đính kèm'}
                    {a.date && ` — ${formatDate(a.date)}`}
                  </figcaption>
                </figure>
              ))}
          </div>
      </Section>

      <Section title="Phần dành cho đào tạo — không có trong bệnh án giấy" empty={emptyReflection}>
        <SubSection title="Tự lượng giá của người học" empty={emptyReflection}>
            {nonEmpty(record.reflection.learned) && (
              <>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Điều học được</p>
                <Para text={record.reflection.learned} />
              </>
            )}
            {nonEmpty(record.reflection.difficulties) && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Chỗ còn thấy khó</p>
                <Para text={record.reflection.difficulties} />
              </>
            )}
            {nonEmpty(record.reflection.nextTime) && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Lần sau sẽ làm khác</p>
                <Para text={record.reflection.nextTime} />
              </>
            )}
            {nonEmpty(record.reflection.questionsForTeacher) && (
              <>
                <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>Câu hỏi cho giảng viên</p>
                <Para text={record.reflection.questionsForTeacher} />
              </>
            )}
            <dl style={{ marginTop: 8 }}>
              <Row
                label="Mức tự tin"
                value={record.reflection.selfRating ? `${record.reflection.selfRating}/5` : ''}
              />
              <Row label="Từ khóa" value={record.reflection.tags.join(', ')} />
            </dl>
        </SubSection>
      </Section>

      {/*
        A chart is signed by the person who wrote it. The date follows the visit
        rather than the export, because that is the day being recorded.
      */}
      <div className="doc__sign">
        <div>
          <p>
            <strong>Sinh viên / học viên</strong>
          </p>
          <p className="doc__meta">(Ký và ghi rõ họ tên)</p>
          <p className="doc__sign-name">{profile?.fullName || '………………………………'}</p>
        </div>
        <div>
          <p className="doc__meta">
            {nonEmpty(record.visit.date) ? `Ngày ${formatDate(record.visit.date)}` : 'Ngày ……/……/20……'}
          </p>
          <p>
            <strong>Bác sĩ</strong>
          </p>
          <p className="doc__meta">(Ký và ghi rõ họ tên)</p>
          <p className="doc__sign-name">………………………………</p>
        </div>
      </div>

      {nonEmpty(record.submission.code) && (
        <p className="doc__meta" style={{ marginTop: 14 }}>
          Mã bài nộp: {record.submission.code}
          {nonEmpty(record.submission.submittedAt)
            ? ` · Nộp lúc ${formatDateTime(record.submission.submittedAt)}`
            : ' · Đã mở lại để bổ sung, chưa nộp lại'}
          {record.submission.reopenedAt.length > 0 &&
            ` · Số lần mở lại: ${record.submission.reopenedAt.length}`}
        </p>
      )}

      <div className="print-footer">
        ClerkMate — bệnh án Y học gia đình · Mức {record.learnerLevel}
        {profile ? ` · ${profile.fullName} (${profile.studentId})` : ''} · Xuất ngày{' '}
        {formatDateTime(new Date().toISOString())}.
      </div>
    </article>
  )
}
