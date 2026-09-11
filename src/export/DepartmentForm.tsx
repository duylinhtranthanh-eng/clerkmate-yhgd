/**
 * The department's paper record, filled in.
 *
 * This is not a report about the case — it is the form the teaching clinic
 * already uses, reproduced page for page so that a teacher opening the PDF
 * recognises it immediately and reads it in the order they are used to. The
 * boxes stay whether or not there is anything to put in them: an empty cell on
 * an official form means "not recorded", which is information, while a section
 * that quietly disappears is not.
 *
 * Its companion, `CaseDocument`, is the learning report — the same data laid
 * out for teaching rather than for the department's filing.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { CaseRecord } from '../types/case'
import type { LearnerProfile } from '../types/profile'
import { GenogramSvg } from '../genogram/GenogramSvg'
import { resolveFamilyMembers } from '../genogram/resolve'
import { APGAR_ITEMS, SCREEM_DOMAINS, EXAM_SYSTEMS, interpretApgar } from '../config/clinical'
import {
  FORM_EXAM_EXTRA_SYSTEM_IDS,
  FORM_EXAM_ROWS,
  FORM_FAMILY_ROWS,
  FORM_LAB_ROWS,
  FORM_PROBLEM_ROWS,
  FORM_SCREENING_SCHEDULE,
  problemsForRow,
} from '../config/departmentForm'
import { SEX_LABEL, bmiCategory, formatDate, nonEmpty } from '../utils/format'
import { isSubmissionSafe } from '../workflow/privacy'
import { getAttachmentBlob } from '../db/repository'

const BLANK = ''

/** `Nhãn: giá trị` on one line, the way a filled paper form reads. */
function F({ label, value, block }: { label: string; value?: ReactNode; block?: boolean }) {
  return (
    <div className={block ? 'dept-f dept-f--block' : 'dept-f'}>
      <span className="dept-f__label">{label}:</span>{' '}
      <span className="dept-f__value">{value || BLANK}</span>
    </div>
  )
}

function Tick({ on }: { on: boolean }) {
  return <span className="dept-tick">{on ? '☒' : '☐'}</span>
}

/** A bordered block with the form's own heading. */
function Box({
  title,
  children,
  center,
}: {
  title?: string
  children: ReactNode
  center?: boolean
}) {
  return (
    <div className="dept-box">
      {title && <div className={center ? 'dept-box__h dept-box__h--c' : 'dept-box__h'}>{title}</div>}
      <div className="dept-box__body">{children}</div>
    </div>
  )
}

function Page({ n, children }: { n: number; children: ReactNode }) {
  return <section className={`department-page page-${n}`}>{children}</section>
}

/** Full-resolution sanitized images, the only ones allowed off the device. */
function useSanitizedImages(record: CaseRecord): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
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

export function DepartmentForm({
  record,
  profile,
}: {
  record: CaseRecord
  profile: LearnerProfile | null
}) {
  const p = record.patient
  const v = record.examination.vitals
  const fm = record.familyMedicineAssessment
  const rp = record.personalHistory.reproductive
  const images = useSanitizedImages(record)

  const apgarAnswered = APGAR_ITEMS.every((i) => fm.apgar[i.key] !== null)
  const apgarTotal = APGAR_ITEMS.reduce<number>((a, i) => a + (fm.apgar[i.key] ?? 0), 0)
  const systemById = new Map(record.examination.systems.map((s) => [s.id, s]))
  const follow = record.followUps[record.followUps.length - 1] ?? null
  const meds = record.medications

  return (
    <article className="dept">
      {/* ------------------------------------------------------------ page 1 */}
      <Page n={1}>
        <div className="dept-learner">
          SV/HV: {profile?.fullName || BLANK} · MSSV: {profile?.studentId || BLANK} · Lớp:{' '}
          {profile?.classGroup || BLANK} · Trình độ: {record.learnerLevel}
        </div>

        <div className="dept-row dept-row--head">
          <div className="dept-cell dept-cell--admin">
            <F label="Số hồ sơ" value={p.fileNumber} />
            <F label="Mã số" value={p.caseLabel} />
            <F label="Tên" value={p.name} />
            <F label="Tuổi" value={p.ageYears !== null ? String(p.ageYears) : ''} />
            <F label="Giới tính" value={p.sex !== 'unknown' ? SEX_LABEL[p.sex] : ''} />
            <F label="Địa chỉ" value={p.address} />
            <F label="Nghề nghiệp" value={p.occupation} />
            <F label="Bảo hiểm Y tế" value={p.insurance} />
            <F label="Ngày khám" value={formatDate(record.visit.date)} />
            <F label="SĐT" value={p.phone} />
          </div>
          <div className="dept-cell dept-cell--title">
            PHÒNG KHÁM THỰC HÀNH
            <br />Y HỌC GIA ĐÌNH
          </div>
        </div>

        <div className="dept-row">
          <div className="dept-cell dept-cell--2">
            <F label="Lý do khám" value={record.history.chiefComplaint || record.visit.reasonForEncounter} />
          </div>
          <div className="dept-cell">
            <F label="MSGĐ" value={p.familyCode} />
          </div>
        </div>

        <table className="dept-table dept-table--vitals">
          <thead>
            <tr>
              <th>Mạch</th>
              <th>Huyết áp</th>
              <th>Chiều cao</th>
              <th>Cân nặng</th>
              <th>BMI</th>
              <th>Nhiệt độ</th>
              <th>Đường huyết</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{v.pulse}</td>
              <td>{nonEmpty(v.systolic) && nonEmpty(v.diastolic) ? `${v.systolic}/${v.diastolic}` : BLANK}</td>
              <td>{v.heightCm}</td>
              <td>{v.weightKg}</td>
              <td>{nonEmpty(v.bmi) ? `${v.bmi} — ${bmiCategory(v.bmi)}` : BLANK}</td>
              <td>{v.temperatureC}</td>
              <td>{v.bloodGlucose}</td>
            </tr>
          </tbody>
        </table>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <div className="dept-box__h">Bệnh sử: <i>(Redflag, SOCRATES, ICE)</i></div>
            <F label="SOCRATES" block value={socrates(record)} />
            <div className="dept-free">{record.history.hpi}</div>
            {nonEmpty(record.history.systemsReview) && (
              <F label="Lược qua các cơ quan" block value={record.history.systemsReview} />
            )}
          </div>
          <div className="dept-cell">
            <F label="Dấu hiệu báo động (Redflag)" block value={redFlags(record)} />
            <div className="dept-f">
              <Tick on={record.managementPlan.referral.urgency === 'Cấp cứu'} /> Chuyển khám cấp cứu{' '}
              <span className="dept-f__value">
                {record.managementPlan.referral.urgency === 'Cấp cứu'
                  ? record.managementPlan.referral.destination
                  : BLANK}
              </span>
            </div>
            <div className="dept-f">
              <Tick on={record.managementPlan.referral.needed === 'yes'} /> Chuyển khám chuyên khoa{' '}
              <span className="dept-f__value">
                {record.managementPlan.referral.needed === 'yes'
                  ? [record.managementPlan.referral.destination, record.managementPlan.referral.reason]
                      .filter(nonEmpty)
                      .join(' — ')
                  : BLANK}
              </span>
            </div>
            <F label="ICE" block value={ice(record)} />
          </div>
        </div>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell dept-cell--flush">
            <div className="dept-box__h">Các vấn đề đã và hiện có:</div>
            <table className="dept-table">
              <thead>
                <tr>
                  <th className="w-34">Vấn đề</th>
                  <th className="w-8">Có</th>
                  <th className="w-28">Phân loại</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {FORM_PROBLEM_ROWS.map((row) => {
                  const items = problemsForRow(record, row)
                  const allergy = row === 'Dị ứng' ? record.personalHistory.allergies : []
                  const on = items.length > 0 || allergy.length > 0
                  return (
                    <tr key={row}>
                      <td>{row}</td>
                      <td className="ta-c">
                        <Tick on={on} />
                      </td>
                      <td>
                        {allergy.length > 0
                          ? allergy.map((a) => a.agent).join('; ')
                          : items.map((m) => m.label).join('; ')}
                      </td>
                      <td>
                        {allergy.length > 0
                          ? allergy.map((a) => [a.reaction, a.severity].filter(nonEmpty).join(', ')).join('; ')
                          : items
                              .map((m) => [m.since && `từ ${m.since}`, m.status, m.note].filter(nonEmpty).join(', '))
                              .filter(nonEmpty)
                              .join('; ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="dept-cell dept-cell--flush">
            <div className="dept-box__h">Tiền sử gia đình</div>
            <table className="dept-table">
              <thead>
                <tr>
                  <th className="w-34">Vấn đề</th>
                  <th className="w-8">Có</th>
                  <th className="w-24">Ai</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {FORM_FAMILY_ROWS.map((row) => {
                  const entries =
                    row === 'Khác'
                      ? record.familyHistory.entries.filter((e) => !FORM_FAMILY_ROWS.includes(e.condition))
                      : record.familyHistory.entries.filter((e) => e.condition === row)
                  return (
                    <tr key={row}>
                      <td>{row === 'Khác' ? 'Khác' : row}</td>
                      <td className="ta-c">
                        <Tick on={entries.length > 0} />
                      </td>
                      <td>{entries.map((e) => e.relatives).filter(nonEmpty).join('; ')}</td>
                      <td>
                        {entries
                          .map((e) => (row === 'Khác' ? [e.condition, e.note].filter(nonEmpty).join(' — ') : e.note))
                          .filter(nonEmpty)
                          .join('; ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="dept-box__h">Cá nhân</div>
            <table className="dept-table">
              <tbody>
                <tr>
                  <td className="w-40">PARA (nữ)</td>
                  <td>{rp.para}</td>
                </tr>
                <tr>
                  <td>Tuổi có kinh (nữ)</td>
                  <td>{rp.menarcheAge}</td>
                </tr>
                <tr>
                  <td>PAP&apos;s smear (nữ)</td>
                  <td>{screeningText(record, 'pap')}</td>
                </tr>
                <tr>
                  <td>Tôn giáo</td>
                  <td>{p.religion}</td>
                </tr>
                <tr>
                  <td>Vòng đời FLC</td>
                  <td>{fm.familyLifeCycleStage}</td>
                </tr>
                <tr>
                  <td>Family APGAR</td>
                  <td>
                    Tổng điểm: {apgarAnswered ? `${apgarTotal}/10` : BLANK}
                    <br />
                    Kết luận: {apgarAnswered ? interpretApgar(apgarTotal) : BLANK}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="dept-box__h">SCREEM</div>
            <table className="dept-table">
              <tbody>
                {SCREEM_DOMAINS.map((d) => {
                  const e = fm.screem[d.key]
                  return (
                    <tr key={d.key}>
                      <td className="w-8 ta-c">{d.label.charAt(0)}</td>
                      <td>
                        {[
                          nonEmpty(e.resources) ? `Nguồn lực: ${e.resources}` : '',
                          nonEmpty(e.pathology) ? `Trở ngại: ${e.pathology}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Page>

      {/* ------------------------------------------------------------ page 2 */}
      <Page n={2}>
        <Box title="Khám hệ cơ quan: đánh dấu nếu bình thường, mô tả nếu bất thường">
          <div className="dept-exam">
            {FORM_EXAM_ROWS.map((row) => {
              const s = row.systemId ? systemById.get(row.systemId) : undefined
              const isGeneral = row.label === 'Tổng trạng'
              const normal = isGeneral ? false : s?.status === 'normal'
              const text = isGeneral
                ? record.examination.generalAppearance
                : s?.status === 'abnormal'
                  ? s.findings
                  : BLANK
              return (
                <div className="dept-exam__row" key={row.label}>
                  <span className="dept-exam__label">{row.label}</span>
                  <Tick on={normal} />
                  <span className="dept-exam__text">{text}</span>
                </div>
              )
            })}
          </div>
          {FORM_EXAM_EXTRA_SYSTEM_IDS.map((id) => {
            const s = systemById.get(id)
            if (!s || (s.status !== 'abnormal' && s.status !== 'normal')) return null
            const def = EXAM_SYSTEMS.find((x) => x.id === id)
            return (
              <div className="dept-exam__row" key={id}>
                <span className="dept-exam__label">{def?.label ?? id}</span>
                <Tick on={s.status === 'normal'} />
                <span className="dept-exam__text">{s.status === 'abnormal' ? s.findings : BLANK}</span>
              </div>
            )
          })}
        </Box>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Đề nghị cận lâm sàng</div>
            <div className="dept-free">
              {record.investigations.proposed.map((i) => i.name).join('\n')}
            </div>
          </div>
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Tóm tắt cận lâm sàng đã có</div>
            <div className="dept-free">
              {record.investigations.results
                .map((r) =>
                  [`${r.name}: ${r.value} ${r.unit}`.trim(), r.flag === 'abnormal' ? '(bất thường)' : '']
                    .filter(nonEmpty)
                    .join(' '),
                )
                .join('\n')}
              {nonEmpty(record.investigations.summary) ? `\n${record.investigations.summary}` : ''}
            </div>
          </div>
        </div>

        <Box title="Xác định yếu tố nguy cơ" center>
          <div className="dept-free">{riskText(record)}</div>
        </Box>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <div className="dept-box__h">Chẩn đoán (ICD10, ICPC2):</div>
            <div className="dept-free">{diagnosisText(record)}</div>
          </div>
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Kế hoạch quản lý</div>
            <div className="dept-free">{managementText(record)}</div>
          </div>
        </div>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <div className="dept-box__h">Toa thuốc</div>
            <ol className="dept-rx">
              {meds.map((m) => (
                <li key={m.id}>
                  {[m.name, m.dose, m.route, m.frequency, m.duration].filter(nonEmpty).join(', ')}
                  {m.indication && ` — ${m.indication}`}
                </li>
              ))}
              {Array.from({ length: Math.max(0, 7 - meds.length) }).map((_, i) => (
                <li key={`blank-${i}`} className="dept-rx__blank" />
              ))}
            </ol>
          </div>
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Biện pháp duy trì sức khỏe và tham vấn</div>
            <div className="dept-free">
              {[record.prevention.counselling, record.prevention.healthMaintenanceNote]
                .filter(nonEmpty)
                .join('\n')}
            </div>
          </div>
        </div>

        <div className="dept-row dept-sign">
          <div className="dept-cell">
            <F label="Sinh viên/học viên" value={profile?.fullName} />
          </div>
          <div className="dept-cell">
            <F label="Bác sĩ" />
          </div>
        </div>
      </Page>

      {/* ------------------------------------------------------------ page 3 */}
      <Page n={3}>
        <div className="dept-row dept-row--head">
          <div className="dept-cell">
            <F label="Ngày khám" value={follow ? formatDate(follow.date) : ''} />
            <F label="Lần" value={follow ? String(record.followUps.length) : ''} />
            <table className="dept-table dept-table--vitals">
              <thead>
                <tr>
                  <th>Mạch</th>
                  <th>H/A</th>
                  <th>Cân nặng</th>
                  <th>Chiều cao</th>
                  <th>BMI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="dept-cell">
            <F label="Yếu tố nguy cơ sức khoẻ" block value={record.riskAssessment.overallNote} />
            <F label="Giải pháp" block value={follow?.plan} />
          </div>
        </div>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <F label="Đáp ứng điều trị: Sau thời gian" value={follow?.treatmentResponse} />
            <F label="Triệu chứng" value={follow?.subjective} />
            <F label="Thực thể" value={follow?.objective} />
            <F label="Không đáp ứng điều trị: Sau thời gian" />
            <F label="Than phiền" />
            <F label="Chuyển khám chuyên khoa" block value={referralText(record)} />
            <F label="Tham vấn" block value={record.prevention.counselling} />
          </div>
          <div className="dept-cell">
            <F label="Chẩn đoán" block value={follow?.assessment} />
            <div className="dept-box__h">Toa thuốc</div>
            <ol className="dept-rx">
              {meds.map((m) => (
                <li key={m.id}>{[m.name, m.dose, m.frequency].filter(nonEmpty).join(', ')}</li>
              ))}
              {Array.from({ length: Math.max(0, 5 - meds.length) }).map((_, i) => (
                <li key={`b-${i}`} className="dept-rx__blank" />
              ))}
            </ol>
          </div>
        </div>

        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <F label="Chẩn đoán" value={record.diagnosis.primary?.label} />
            <div className="dept-f">
              <Tick on={record.managementPlan.referral.needed === 'yes'} /> Khám chuyên khoa
            </div>
            <F
              label="Nhập viện"
              value={
                record.managementPlan.hospitalization.needed === 'yes'
                  ? record.managementPlan.hospitalization.reason || 'Có'
                  : record.managementPlan.hospitalization.needed === 'no'
                    ? 'Không'
                    : ''
              }
            />
            <F label="Toa" block value={meds.map((m) => m.name).join('; ')} />
            <F label="Ý kiến chuyên khoa: BS" block />
          </div>
          <div className="dept-cell dept-cell--flush">
            <table className="dept-table">
              <thead>
                <tr>
                  <th className="w-50">Cận lâm sàng</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {FORM_LAB_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>
                      {record.investigations.results
                        .filter((r) => row.match.test(r.name))
                        .map((r) => `${r.value} ${r.unit}`.trim())
                        .join('; ')}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>Khác</td>
                  <td>
                    {record.investigations.results
                      .filter((r) => !FORM_LAB_ROWS.some((x) => x.match.test(r.name)))
                      .map((r) => `${r.name}: ${r.value} ${r.unit}`.trim())
                      .join('; ')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <Box>
          <F
            label="Biện pháp duy trì sức khoẻ và tham vấn"
            block
            value={record.prevention.healthMaintenanceNote}
          />
          <div className="dept-row dept-row--plain">
            <F label="Tái khám" value={record.managementPlan.followUpInterval} />
            <F label="Ngày" value={formatDate(record.visit.date)} />
            <F label="Người làm bệnh án" value={profile?.fullName} />
          </div>
          <F label="Hồ sơ theo dõi bệnh mạn tính" />
          <F
            label="Loại bệnh"
            value={record.diagnosis.comorbidities.map((d) => d.label).join('; ')}
          />
        </Box>
      </Page>

      {/* ------------------------------------------------------------ page 4 */}
      <Page n={4}>
        <div className="dept-box__h">Sơ đồ cây phả hệ:</div>
        <div className="dept-row dept-row--grow">
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Minh hoạ</div>
            <ul className="dept-legend">
              <li>
                <span className="geno-key geno-key--m" /> nam
              </li>
              <li>
                <span className="geno-key geno-key--m geno-key--ill" /> nam bị bệnh
              </li>
              <li>
                <span className="geno-key geno-key--m geno-key--dead" /> nam đã chết
              </li>
              <li>
                <span className="geno-key geno-key--f" /> nữ
              </li>
              <li>
                <span className="geno-key geno-key--f geno-key--ill" /> nữ bị bệnh
              </li>
              <li>
                <span className="geno-key geno-key--f geno-key--dead" /> nữ đã chết
              </li>
            </ul>
          </div>
          <div className="dept-cell">
            <div className="dept-box__h dept-box__h--c">Hình vẽ</div>
            <GenogramSvg members={resolveFamilyMembers(record)} />
          </div>
        </div>

        <div className="dept-box__h">Lịch can thiệp tầm soát</div>
        <table className="dept-table">
          <thead>
            <tr>
              <th className="w-34">Can thiệp</th>
              <th className="w-22">Chu kỳ thực hiện</th>
              <th className="w-20">Độ tuổi thực hiện</th>
              <th>Thời gian thực hiện</th>
            </tr>
          </thead>
          <tbody>
            {FORM_SCREENING_SCHEDULE.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.cycle}</td>
                <td>{row.age}</td>
                <td>{row.screeningId ? screeningText(record, row.screeningId) : BLANK}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dept-box__h">Lịch chủng ngừa</div>
        <div className="dept-free">
          {record.prevention.vaccinations
            .filter((s) => nonEmpty(s.status))
            .map((s) => [s.name, s.status, s.date && formatDate(s.date)].filter(nonEmpty).join(' — '))
            .join('\n')}
        </div>

      </Page>

      {/* ------------------------------------------------- appendix, page 5 */}
      {record.attachments.some((a) => isSubmissionSafe(a)) && (
        <Page n={5}>
          <div className="dept-box__h">
            Phụ lục — hình ảnh đính kèm <i>(không có trong bệnh án giấy)</i>
          </div>
          <div className="dept-figures">
            {record.attachments
              .filter((a) => isSubmissionSafe(a) && (images[a.id] || a.thumbnail))
              .map((a) => (
                <figure key={a.id}>
                  <img src={images[a.id] || a.thumbnail} alt={a.title} />
                  <figcaption>
                    {a.title || 'Ảnh đính kèm'}
                    {a.date && ` — ${formatDate(a.date)}`}
                  </figcaption>
                </figure>
              ))}
          </div>
        </Page>
      )}
    </article>
  )
}

// --------------------------------------------------------------- assembling
// The form gives one cell to things the record keeps in several fields, so the
// joining happens here rather than inside the layout.

function socrates(record: CaseRecord): string {
  const s = record.history.socrates
  return [
    s.site && `Vị trí: ${s.site}`,
    s.onset && `Khởi phát: ${s.onset}`,
    s.character && `Tính chất: ${s.character}`,
    s.radiation && `Hướng lan: ${s.radiation}`,
    s.associations && `Kèm theo: ${s.associations}`,
    s.timeCourse && `Diễn tiến: ${s.timeCourse}`,
    s.exacerbatingRelieving && `Tăng/giảm: ${s.exacerbatingRelieving}`,
    s.severity && `Mức độ: ${s.severity}`,
  ]
    .filter(nonEmpty)
    .join('. ')
}

function redFlags(record: CaseRecord): string {
  const r = record.history.redFlags
  return [
    r.present.length > 0 ? r.present.join('; ') : '',
    r.absent.length > 0 ? `Đã hỏi và không có: ${r.absent.join('; ')}` : '',
    r.note,
  ]
    .filter(nonEmpty)
    .join('. ')
}

function ice(record: CaseRecord): string {
  const i = record.history.ice
  return [
    i.ideas && `Nghĩ là: ${i.ideas}`,
    i.concerns && `Lo lắng: ${i.concerns}`,
    i.expectations && `Mong muốn: ${i.expectations}`,
  ]
    .filter(nonEmpty)
    .join('. ')
}

function riskText(record: CaseRecord): string {
  const present = record.riskAssessment.factors.filter((f) => f.present === 'yes')
  return [present.map((f) => f.label).join('; '), record.riskAssessment.overallNote]
    .filter(nonEmpty)
    .join('\n')
}

function diagnosisText(record: CaseRecord): string {
  const d = record.diagnosis
  const code = (x: { icd10: string; icpc2: string }) =>
    [x.icd10 && `ICD-10: ${x.icd10}`, x.icpc2 && `ICPC-2: ${x.icpc2}`].filter(nonEmpty).join(' · ')
  return [
    d.primary ? `${d.primary.label}${code(d.primary) ? ` (${code(d.primary)})` : ''}` : '',
    d.comorbidities.length > 0 ? `Đồng mắc: ${d.comorbidities.map((x) => x.label).join('; ')}` : '',
    d.differentials.length > 0 ? `Phân biệt: ${d.differentials.map((x) => x.label).join('; ')}` : '',
    d.reasoning,
  ]
    .filter(nonEmpty)
    .join('\n')
}

function managementText(record: CaseRecord): string {
  const m = record.managementPlan
  return [
    m.goalsOfCare && `Mục tiêu: ${m.goalsOfCare}`,
    m.nonPharmacological,
    m.patientEducation && `Giáo dục sức khoẻ: ${m.patientEducation}`,
    m.followUpInterval && `Hẹn tái khám: ${m.followUpInterval}`,
    m.followUpPlan,
  ]
    .filter(nonEmpty)
    .join('\n')
}

function referralText(record: CaseRecord): string {
  const r = record.managementPlan.referral
  if (r.needed !== 'yes') return r.needed === 'no' ? 'Không' : ''
  return [r.destination, r.reason, r.urgency].filter(nonEmpty).join(' — ')
}

function screeningText(record: CaseRecord, id: string): string {
  const s = record.prevention.screenings.find((x) => x.id === id || x.name.toLowerCase().includes(id))
  if (!s) return ''
  return [s.status, s.date && formatDate(s.date), s.result].filter(nonEmpty).join(' — ')
}
