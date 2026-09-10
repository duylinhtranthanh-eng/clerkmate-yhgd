import type { CaseRecord } from '../types/case'
import type { SectionId } from '../config/sections'
import { SECTION_BY_ID } from '../config/sections'
import { PatientSection, VisitSection } from './sections/PatientSections'
import { HistorySection } from './sections/HistorySection'
import {
  FamilyHistorySection,
  LifestyleSection,
  PersonalHistorySection,
} from './sections/BackgroundSections'
import { FmAssessmentSection } from './sections/FmAssessmentSection'
import { ExaminationSection } from './sections/ExaminationSection'
import { AttachmentsSection, InvestigationsSection } from './sections/InvestigationSections'
import { DiagnosisSection } from './sections/DiagnosisSection'
import { RiskSection } from './sections/RiskSection'
import { ReflectionSection } from './sections/ReflectionSection'
import {
  FollowUpSection,
  ManagementSection,
  MedicationsSection,
  PreventionSection,
} from './sections/PlanSections'

export function SectionScreen({
  sectionId,
  record,
  update,
}: {
  sectionId: SectionId
  record: CaseRecord
  update: (m: (d: CaseRecord) => void) => void
}) {
  const props = { record, update }

  const body = (() => {
    switch (sectionId) {
      case 'patient':
        return <PatientSection {...props} />
      case 'visit':
        return <VisitSection {...props} />
      case 'history':
        return <HistorySection {...props} />
      case 'personalHistory':
        return <PersonalHistorySection {...props} />
      case 'lifestyle':
        return <LifestyleSection {...props} />
      case 'familyHistory':
        return <FamilyHistorySection {...props} />
      case 'fmAssessment':
        return <FmAssessmentSection {...props} />
      case 'examination':
        return <ExaminationSection {...props} />
      case 'investigations':
        return <InvestigationsSection {...props} />
      case 'attachments':
        return <AttachmentsSection {...props} />
      case 'risk':
        return <RiskSection {...props} />
      case 'diagnosis':
        return <DiagnosisSection {...props} />
      case 'management':
        return <ManagementSection {...props} />
      case 'medications':
        return <MedicationsSection {...props} />
      case 'prevention':
        return <PreventionSection {...props} />
      case 'followUp':
        return <FollowUpSection {...props} />
      case 'reflection':
        return <ReflectionSection {...props} />
      default:
        return <p className="muted">Phần này được chỉnh sửa ở tab riêng.</p>
    }
  })()

  const def = SECTION_BY_ID[sectionId]

  return (
    <div className="content">
      {def && <p className="small muted" style={{ margin: 0 }}>{def.blurb}</p>}
      {body}
    </div>
  )
}
