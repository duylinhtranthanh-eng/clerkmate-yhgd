import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function Card({
  children,
  title,
  hint,
  action,
  className = '',
}: {
  children: ReactNode
  title?: ReactNode
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card__head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {hint && <p className="card__hint">{hint}</p>}
      {children}
    </section>
  )
}

export function Field({
  label,
  help,
  children,
}: {
  label?: string
  help?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`textarea ${props.className ?? ''}`} />
}

export function Select({
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select {...props} className={`select ${props.className ?? ''}`}>
      <option value="">{placeholder ?? '— chọn —'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Chip({
  on,
  onClick,
  children,
  tone,
  small,
}: {
  on?: boolean
  onClick?: () => void
  children: ReactNode
  tone?: 'ok' | 'danger'
  small?: boolean
}) {
  return (
    <button
      type="button"
      className={`chip ${tone ? `chip--${tone}` : ''} ${small ? 'chip--sm' : ''}`}
      data-on={on ? 'true' : 'false'}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = 'muted',
  children,
}: {
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'muted' | 'info'
  children: ReactNode
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Progress({ percent }: { percent: number }) {
  const tone = percent >= 80 ? undefined : percent >= 50 ? 'warn' : 'danger'
  return (
    <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__bar" data-tone={tone} style={{ width: `${Math.max(2, percent)}%` }} />
    </div>
  )
}

export function Ring({ percent, size = 96 }: { percent: number; size?: number }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = percent >= 80 ? 'var(--brand-500)' : percent >= 50 ? 'var(--warn)' : 'var(--danger)'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9EFF3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, Math.max(0, percent))) / 100}
          style={{ transition: 'stroke-dashoffset 420ms ease' }}
        />
      </svg>
      <span className="ring__label">{percent}%</span>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p className="small" style={{ marginTop: 6 }}>{body}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'ok'
  children: ReactNode
}) {
  const icon = tone === 'warn' ? '⚠️' : tone === 'ok' ? '✅' : 'ℹ️'
  return (
    <div className={`notice notice--${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <div>{children}</div>
    </div>
  )
}

export function Checkbox({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="checkbox"
      data-on={on ? 'true' : 'false'}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={label ? `Chọn: ${label}` : 'Chọn'}
    >
      <span aria-hidden="true">✓</span>
    </button>
  )
}
