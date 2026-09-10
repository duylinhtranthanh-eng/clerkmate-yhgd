import type { CaseRecord } from '../../types/case'

export interface SectionProps {
  record: CaseRecord
  update: (mutator: (draft: CaseRecord) => void) => void
}
