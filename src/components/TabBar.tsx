import type { CaseTab } from '../hooks/useRoute'

const TABS: { id: CaseTab; label: string; icon: string }[] = [
  { id: 'note', label: 'Ghi nhanh', icon: '✏️' },
  { id: 'record', label: 'Bệnh án', icon: '📋' },
  { id: 'check', label: 'Hoàn chỉnh', icon: '✅' },
  { id: 'genogram', label: 'Phả hệ', icon: '🌳' },
  { id: 'review', label: 'Xem trước', icon: '📄' },
]

export function TabBar({ active, onSelect }: { active: CaseTab; onSelect: (t: CaseTab) => void }) {
  return (
    <nav className="tabbar no-print" aria-label="Điều hướng ca lâm sàng">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tabbar__item"
          data-active={active === t.id ? 'true' : 'false'}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          <span className="ic" aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
