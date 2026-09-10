/**
 * Print-ready rendering of a CaseRecord.
 *
 * Used both for the on-screen review and, via the print stylesheet, as the
 * exported PDF. Rendering the same component for both means what the learner
 * previews is exactly what gets exported.
 */

import type { ReactNode } from 'react'
import type { CaseRecord } from '../types/case'
import type { LearnerProfile } from '../types/profile'
import { GenogramSvg } from '../genogram/GenogramSvg'
import { resolveFamilyMembers } from '../genogram/resolve'
import { completedScales, scaleMaxScore } from '../scales/scoring'
import { fallsBand } from '../config/falls'
import { APGAR_ITEMS, ATTACHMENT_CATEGORIES, SCREEM_DOMAINS, interpretApgar } from '../config/clinical'
import { RISK_DOMAINS } from '../config/risk'
import { LEVELS } from '../config/levels'
import { RISK_MODE_BY_LEVEL } from '../config/risk'
import { CVD_INPUTS } from '../config/cvd'
import { SEX_LABEL, bmiCategory, formatDate, formatDateTime, nonEmpty } from '../utils/format'

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
  const mode = RISK_MODE_BY_LEVEL[record.learnerLevel]
  const modeLabel =
    mode === 'checklist'
      ? 'danh mục nguy cơ đầy đủ'
      : mode === 'recallThenChecklist'
        ? 'tự nhớ trước rồi xem danh mục'
        : 'tự liệt kê, không có danh mục sẵn'

  return (
    <div className="print-stamp">
      <strong>Bệnh án lập ở mức {record.learnerLevel}</strong> — {LEVELS[record.learnerLevel].label}.
      Chế độ rà soát nguy cơ tương ứng: {modeLabel}.
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

  return (
    <article className="doc">
      <Watermark record={record} profile={profile} />

      <header>
        <h1>BỆNH ÁN Y HỌC GIA ĐÌNH</h1>
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

        {nonEmpty(record.submission.code) && (
          <dl style={{ margin: '10px 0 0' }}>
            <Row label="Mã bài nộp" value={record.submission.code} />
            <Row
              label="Nộp lúc"
              value={
                nonEmpty(record.submission.submittedAt)
                  ? formatDateTime(record.submission.submittedAt)
                  : 'Đã mở lại để bổ sung, chưa nộp lại'
              }
            />
            <Row
              label="Số lần mở lại"
              value={record.submission.reopenedAt.length > 0 ? `${record.submission.reopenedAt.length}` : ''}
            />
          </dl>
        )}
      </header>

      <Section title="1. Thông tin hành chính">
        <dl>
          <Row label="Tên / mã ca" value={p.name} />
          <Row label="Tuổi" value={p.ageYears !== null ? `${p.ageYears}` : ''} />
          <Row label="Giới tính" value={p.sex !== 'unknown' ? SEX_LABEL[p.sex] : ''} />
          <Row label="Nghề nghiệp" value={p.occupation} />
          <Row label="Học vấn" value={p.education} />
          <Row label="Hôn nhân" value={p.maritalStatus} />
          <Row label="Dân tộc" value={p.ethnicity} />
          <Row label="Tôn giáo" value={p.religion} />
          <Row label="Nơi ở" value={p.address} />
          <Row label="Bảo hiểm y tế" value={p.insurance} />
          <Row label="Ngày khám" value={formatDate(record.visit.date)} />
          <Row label="Nơi khám" value={record.visit.setting} />
          <Row label="Hình thức" value={record.visit.encounterType} />
          <Row label="Người đi cùng" value={record.visit.accompaniedBy} />
        </dl>
      </Section>

      <Section title="2. Lý do đến khám">
        <dl>
          <Row label="Than phiền chính" value={record.history.chiefComplaint} />
          <Row label="Thời gian" value={record.history.duration} />
          <Row label="Lý do khám" value={record.visit.reasonForEncounter} />
        </dl>
      </Section>

      <Section title="3. Bệnh sử" empty={!nonEmpty(record.history.hpi) && !nonEmpty(record.history.systemsReview)}>
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
      </Section>

      <Section
        title="4. Cờ đỏ và ICE"
        empty={
          record.history.redFlags.present.length === 0 &&
          record.history.redFlags.absent.length === 0 &&
          !nonEmpty(record.history.redFlags.note) &&
          !Object.values(record.history.ice).some(nonEmpty)
        }
      >
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
      </Section>

      <Section
        title="5. Tiền căn"
        empty={
          record.personalHistory.pastMedical.length === 0 &&
          record.personalHistory.pastSurgical.length === 0 &&
          record.personalHistory.allergies.length === 0 &&
          !record.personalHistory.noPastMedical &&
          !record.personalHistory.noPastSurgical &&
          !record.personalHistory.noAllergies &&
          !nonEmpty(record.personalHistory.note)
        }
      >
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
            <ul>
              {record.personalHistory.pastMedical.map((m) => (
                <li key={m.id}>
                  {m.label}
                  {m.since && ` — ${m.since}`}
                  {m.status && ` (${m.status})`}
                </li>
              ))}
            </ul>
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
      </Section>

      <Section
        title="6. Tiền căn sản phụ khoa"
        empty={
          p.sex !== 'female' ||
          !Object.entries(record.personalHistory.reproductive).some(
            ([k, val]) => k !== 'applicable' && nonEmpty(String(val)),
          )
        }
      >
        <dl>
          <Row label="Tuổi có kinh" value={record.personalHistory.reproductive.menarcheAge} />
          <Row label="Chu kỳ" value={record.personalHistory.reproductive.cycle} />
          <Row label="Kinh cuối" value={record.personalHistory.reproductive.lmp} />
          <Row label="PARA" value={record.personalHistory.reproductive.para} />
          <Row label="Ngừa thai" value={record.personalHistory.reproductive.contraception} />
          <Row label="Mãn kinh" value={record.personalHistory.reproductive.menopause} />
          <Row label="Ghi chú" value={record.personalHistory.reproductive.obstetricNote} />
        </dl>
      </Section>

      <Section title="7. Lối sống" empty={!Object.values(record.lifestyle).some((x) => (typeof x === 'string' ? nonEmpty(x) : nonEmpty(x.status) || nonEmpty(x.detail)))}>
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
      </Section>

      <Section
        title="8. Tiền căn gia đình"
        empty={
          record.familyHistory.entries.length === 0 &&
          !record.familyHistory.none &&
          !nonEmpty(record.familyHistory.note)
        }
      >
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

      <Section
        title="9. Đánh giá Y học gia đình"
        empty={
          !nonEmpty(fm.familyType) &&
          !nonEmpty(fm.familyLifeCycleStage) &&
          !apgarAnswered &&
          !SCREEM_DOMAINS.some((d) => nonEmpty(fm.screem[d.key].resources) || nonEmpty(fm.screem[d.key].pathology)) &&
          !nonEmpty(fm.homeEnvironment) &&
          !nonEmpty(fm.continuityNote)
        }
      >
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
      </Section>

      <Section title="10. Sơ đồ phả hệ" empty={record.familyMembers.filter((m) => m.relation !== 'self').length === 0}>
        <GenogramSvg members={resolveFamilyMembers(record)} />
        {nonEmpty(fm.familyLifeCycleStage) && (
          <p className="doc__meta" style={{ marginTop: 8 }}>
            Vòng đời gia đình: {fm.familyLifeCycleStage}
          </p>
        )}
      </Section>

      <Section
        title="11. Khám lâm sàng"
        empty={
          !nonEmpty(record.examination.generalAppearance) &&
          examined.length === 0 &&
          !Object.values(v).some(nonEmpty)
        }
      >
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

      <Section
        title="12. Cận lâm sàng"
        empty={
          record.investigations.proposed.length === 0 &&
          record.investigations.results.length === 0 &&
          !nonEmpty(record.investigations.summary)
        }
      >
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

      <Section
        title="13. Yếu tố nguy cơ"
        empty={riskPresent.length === 0 && riskAbsent.length === 0 && !nonEmpty(record.riskAssessment.overallNote)}
      >
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
                      .map((f) => {
                        const label = f.custom ? `${f.label} [người học tự nêu]` : f.label
                        return nonEmpty(f.note) ? `${label} (${f.note})` : label
                      })
                      .join('; ')}
                  />
                )
              })}
            </dl>
          </>
        )}
        {riskAbsent.length > 0 && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Đã hỏi và không có</p>
            <p className="doc__meta">{riskAbsent.map((f) => f.label).join('; ')}</p>
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

        <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>Mức trợ giúp của ứng dụng</p>
        <dl>
          {RISK_DOMAINS.map((d) => {
            if (d.derivedFrom) return null
            const entry = record.riskAssessment.recall[d.id]
            const mode = entry?.mode ?? (d.alwaysChecklist ? 'checklist' : null)
            const label = !entry
              ? 'Danh mục đầy đủ (không tự liệt kê)'
              : mode === 'generate'
                ? 'Người học tự liệt kê, không có danh mục sẵn'
                : mode === 'recallThenChecklist'
                  ? 'Tự nhớ trước, sau đó xem danh mục'
                  : 'Danh mục đầy đủ'
            return <Row key={d.id} label={`${d.step}. ${d.label}`} value={label} />
          })}
        </dl>

        {Object.entries(record.riskAssessment.recall).some(([, v]) => nonEmpty(v.text)) && (
          <>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>
              Người học tự nghĩ ra trước khi xem danh sách
            </p>
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

      <Section
        title="14. Chẩn đoán"
        empty={
          !record.diagnosis.primary &&
          record.diagnosis.comorbidities.length === 0 &&
          record.diagnosis.differentials.length === 0
        }
      >
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

      <Section
        title="15. Kế hoạch xử trí"
        empty={
          !nonEmpty(record.managementPlan.nonPharmacological) &&
          !nonEmpty(record.managementPlan.patientEducation) &&
          !nonEmpty(record.managementPlan.followUpPlan) &&
          !nonEmpty(record.managementPlan.followUpInterval) &&
          record.managementPlan.referral.needed === 'unknown'
        }
      >
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

      <Section title="16. Thuốc" empty={record.medications.length === 0}>
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

      <Section
        title="17. Dự phòng và tư vấn"
        empty={
          screenings.length === 0 &&
          vaccinations.length === 0 &&
          !nonEmpty(record.prevention.counselling) &&
          !nonEmpty(record.prevention.healthMaintenanceNote)
        }
      >
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

      <Section title="18. Theo dõi dọc" empty={record.followUps.length === 0}>
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

      <Section
        title="19. Tự lượng giá của người học"
        empty={
          !nonEmpty(record.reflection.learned) &&
          !nonEmpty(record.reflection.difficulties) &&
          !nonEmpty(record.reflection.nextTime) &&
          !nonEmpty(record.reflection.questionsForTeacher)
        }
      >
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
      </Section>

      <Section title="20. Danh mục hình ảnh đính kèm" empty={record.attachments.length === 0}>
        <ul>
          {record.attachments.map((a) => (
            <li key={a.id}>
              {a.title || 'Không tiêu đề'} — {ATTACHMENT_CATEGORIES.find((c) => c.id === a.category)?.label}
              {a.date && ` (${formatDate(a.date)})`}
              {a.redacted
                ? ' — đã che thông tin định danh'
                : a.privacyChecked
                  ? ' — đã kiểm tra, không có thông tin định danh'
                  : ' — CHƯA kiểm tra thông tin định danh'}
              {a.note && ` — ${a.note}`}
            </li>
          ))}
        </ul>
        <div className="thumbgrid" style={{ marginTop: 8 }}>
          {record.attachments
            .filter((a) => a.thumbnail)
            .map((a) => (
              <div key={a.id} className="thumb">
                <img src={a.thumbnail} alt={a.title} />
              </div>
            ))}
        </div>
      </Section>

      <Section title="21. Nhận xét của giảng viên" empty={record.submission.reviews.length === 0}>
        <ul>
          {record.submission.reviews.map((r) => (
            <li key={r.id}>
              <strong>{r.decision === 'returned' ? 'Trả lại để bổ sung' : 'Chấp nhận'}</strong> —{' '}
              {r.reviewer} · {formatDateTime(r.at)}
              {nonEmpty(r.comment) && <div className="doc__free">{r.comment}</div>}
            </li>
          ))}
        </ul>
        <p className="doc__meta">
          Nhận xét do người mở tệp bài nộp tự nhập; ứng dụng không xác thực danh tính giảng viên.
        </p>
      </Section>

      <div className="print-footer">
        ClerkMate — bệnh án Y học gia đình · Mức {record.learnerLevel}
        {profile ? ` · ${profile.fullName} (${profile.studentId})` : ''} · Xuất ngày{' '}
        {formatDateTime(new Date().toISOString())}.
      </div>
    </article>
  )
}
