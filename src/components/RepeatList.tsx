import type { ReactNode } from 'react'

/** Generic add / remove list used by every repeating clinical field. */
export function RepeatList<T extends { id: string }>({
  items,
  render,
  onAdd,
  onRemove,
  addLabel,
  emptyLabel,
}: {
  items: T[]
  render: (item: T, index: number) => ReactNode
  onAdd: () => void
  onRemove: (id: string) => void
  addLabel: string
  emptyLabel?: string
}) {
  return (
    <div className="stack">
      {items.length === 0 && emptyLabel && <p className="small muted" style={{ margin: 0 }}>{emptyLabel}</p>}
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--sp-3)',
            background: 'var(--surface-alt)',
          }}
        >
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="tiny muted">#{i + 1}</span>
            <button type="button" className="link-btn" onClick={() => onRemove(item.id)}>
              Xóa
            </button>
          </div>
          {render(item, i)}
        </div>
      ))}
      <button type="button" className="btn btn--soft btn--sm" onClick={onAdd} style={{ alignSelf: 'flex-start' }}>
        ＋ {addLabel}
      </button>
    </div>
  )
}
