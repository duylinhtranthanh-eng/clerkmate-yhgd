import type { ReactNode } from 'react'

export function TopBar({
  title,
  subtitle,
  onBack,
  backLabel,
  right,
}: {
  title: string
  subtitle?: ReactNode
  onBack?: () => void
  /** Accessible name for the back button, e.g. "Danh sách ca". */
  backLabel?: string
  right?: ReactNode
}) {
  return (
    <header className="topbar no-print">
      {onBack && (
        <button
          type="button"
          className="iconbtn iconbtn--ghost"
          onClick={onBack}
          aria-label={backLabel ?? 'Quay lại'}
          title={backLabel ?? 'Quay lại'}
        >
          ‹
        </button>
      )}
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {right}
    </header>
  )
}
