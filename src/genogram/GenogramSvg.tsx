import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { FamilyMember } from '../types/case'
import { layoutGenogram } from './layout'
import type { GenogramNode } from './layout'
import { MAX_BANDS, PATTERN_LABEL, PATTERN_ORDER, buildConditionKey, patternFor } from './patterns'
import type { ConditionKeyEntry, PatternKind } from './patterns'

const STROKE = '#25404F'
const ACCENT = '#0F9B8E'
const FILL = '#FFFFFF'

/**
 * Pattern definitions. Each condition gets one, so the meaning survives a
 * black-and-white print — colour is decoration, the hatch is the information.
 */
function PatternDefs({ prefix }: { prefix: string }) {
  const line = { stroke: ACCENT, strokeWidth: 1.4 }
  return (
    <defs>
      <pattern id={`${prefix}-diagonal`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={FILL} />
        <line x1="0" y1="6" x2="6" y2="0" {...line} />
      </pattern>
      <pattern id={`${prefix}-diagonalBack`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={FILL} />
        <line x1="0" y1="0" x2="6" y2="6" {...line} />
      </pattern>
      <pattern id={`${prefix}-crossHatch`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={FILL} />
        <line x1="0" y1="6" x2="6" y2="0" {...line} />
        <line x1="0" y1="0" x2="6" y2="6" {...line} />
      </pattern>
      <pattern id={`${prefix}-horizontal`} width="6" height="5" patternUnits="userSpaceOnUse">
        <rect width="6" height="5" fill={FILL} />
        <line x1="0" y1="2.5" x2="6" y2="2.5" {...line} />
      </pattern>
      <pattern id={`${prefix}-vertical`} width="5" height="6" patternUnits="userSpaceOnUse">
        <rect width="5" height="6" fill={FILL} />
        <line x1="2.5" y1="0" x2="2.5" y2="6" {...line} />
      </pattern>
      <pattern id={`${prefix}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill={FILL} />
        <circle cx="3" cy="3" r="1.35" fill={ACCENT} />
      </pattern>
      <pattern id={`${prefix}-checker`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={FILL} />
        <rect width="4" height="4" fill={ACCENT} opacity="0.55" />
        <rect x="4" y="4" width="4" height="4" fill={ACCENT} opacity="0.55" />
      </pattern>
      <pattern id={`${prefix}-solid`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill={ACCENT} opacity="0.45" />
      </pattern>
    </defs>
  )
}

function PatternSwatch({ prefix, pattern }: { prefix: string; pattern: PatternKind }) {
  return (
    <svg width="18" height="18" aria-hidden="true" style={{ flex: 'none' }}>
      <PatternDefs prefix={`${prefix}-sw-${pattern}`} />
      <rect
        x="1"
        y="1"
        width="16"
        height="16"
        fill={`url(#${prefix}-sw-${pattern}-${pattern})`}
        stroke={STROKE}
        strokeWidth="1.4"
      />
    </svg>
  )
}

/** Outline of a person symbol, reused for the visible stroke and for clipping. */
function shapeFor(member: FamilyMember, x: number, y: number, size: number, props: object): ReactNode {
  if (member.sex === 'male') {
    return <rect x={x} y={y} width={size} height={size} rx={3} {...props} />
  }
  if (member.sex === 'female') {
    return <circle cx={x + size / 2} cy={y + size / 2} r={size / 2} {...props} />
  }
  const c = size / 2
  return (
    <polygon
      points={`${x + c},${y} ${x + size},${y + c} ${x + c},${y + size} ${x},${y + c}`}
      {...props}
    />
  )
}

function Person({
  node,
  prefix,
  conditionKey,
}: {
  node: GenogramNode
  prefix: string
  conditionKey: ConditionKeyEntry[]
}) {
  const { member, x, y, size } = node
  const conditions = member.conditions.map((c) => c.trim()).filter(Boolean).slice(0, MAX_BANDS)
  const clipId = `${prefix}-clip-${member.id}`
  const bandHeight = conditions.length > 0 ? size / conditions.length : size

  return (
    <g>
      {conditions.length > 0 && (
        <>
          <clipPath id={clipId}>{shapeFor(member, x, y, size, {})}</clipPath>
          <g clipPath={`url(#${clipId})`}>
            {conditions.map((condition, i) => {
              const pattern = patternFor(conditionKey, condition) ?? PATTERN_ORDER[0]
              return (
                <rect
                  key={condition}
                  x={x}
                  y={y + i * bandHeight}
                  width={size}
                  height={bandHeight}
                  fill={`url(#${prefix}-${pattern})`}
                />
              )
            })}
            {conditions.length > 1 &&
              conditions.slice(1).map((condition, i) => (
                <line
                  key={`div-${condition}`}
                  x1={x}
                  y1={y + (i + 1) * bandHeight}
                  x2={x + size}
                  y2={y + (i + 1) * bandHeight}
                  stroke={STROKE}
                  strokeWidth={0.8}
                />
              ))}
          </g>
        </>
      )}

      {shapeFor(member, x, y, size, {
        fill: conditions.length > 0 ? 'none' : FILL,
        stroke: STROKE,
        strokeWidth: node.isIndexPerson ? 3 : 2,
      })}

      {/* Index person: an inner outline, drawn over a white halo so it stays
          visible on top of a hatch fill. */}
      {node.isIndexPerson &&
        [
          { stroke: FILL, width: 3.4 },
          { stroke: ACCENT, width: 1.6 },
        ].map((ring) =>
          member.sex === 'female' ? (
            <circle
              key={ring.stroke}
              cx={x + size / 2}
              cy={y + size / 2}
              r={size / 2 - 5}
              fill="none"
              stroke={ring.stroke}
              strokeWidth={ring.width}
            />
          ) : (
            <rect
              key={ring.stroke}
              x={x + 5}
              y={y + 5}
              width={size - 10}
              height={size - 10}
              rx={2}
              fill="none"
              stroke={ring.stroke}
              strokeWidth={ring.width}
            />
          ),
        )}

      {/* Deceased: an X through the symbol, the usual genogram convention.
          Kept distinct from the hatch fills, which stay inside the outline. */}
      {!member.alive && (
        <>
          <line x1={x - 3} y1={y - 3} x2={x + size + 3} y2={y + size + 3} stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
          <line x1={x - 3} y1={y + size + 3} x2={x + size + 3} y2={y - 3} stroke={STROKE} strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}

      <text x={x + size / 2} y={y + size + 15} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1E2E3C">
        {member.name.length > 14 ? `${member.name.slice(0, 13)}…` : member.name}
      </text>
      {(member.ageYears !== null || !member.alive) && (
        <text x={x + size / 2} y={y + size + 27} textAnchor="middle" fontSize={10} fill="#6B7C8C">
          {member.alive
            ? `${member.ageYears ?? '?'} tuổi`
            : `† ${member.ageAtDeath ?? member.ageYears ?? '?'} tuổi`}
        </text>
      )}
    </g>
  )
}

export function GenogramSvg({ members }: { members: FamilyMember[] }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const prefix = `gn${reactId}`
  const layout = useMemo(() => layoutGenogram(members), [members])
  const conditionKey = useMemo(() => buildConditionKey(members), [members])

  /** Conditions beyond the bands a symbol can hold still have to be readable. */
  const overflow = layout.nodes
    .map((n) => n.member)
    .filter((m) => m.conditions.filter(Boolean).length > MAX_BANDS)

  return (
    <div>
      <div className="geno-wrap">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="Sơ đồ phả hệ gia đình"
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            minWidth: Math.min(layout.width, 320),
          }}
        >
          <PatternDefs prefix={prefix} />
          <rect width={layout.width} height={layout.height} fill="transparent" />
          {layout.edges.map((e) => (
            <polyline
              key={e.id}
              points={e.points.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={STROKE}
              strokeWidth={e.kind === 'couple' ? 2 : 1.6}
              strokeLinecap="square"
            />
          ))}
          {layout.nodes.map((n) => (
            <Person key={n.id} node={n} prefix={prefix} conditionKey={conditionKey} />
          ))}
        </svg>
      </div>

      {conditionKey.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>
            Ký hiệu bệnh lý
          </div>
          <div className="geno-legend">
            {conditionKey.map((k) => (
              <span key={k.condition}>
                <PatternSwatch prefix={prefix} pattern={k.pattern} />
                {k.condition}
                <span className="tiny muted">({PATTERN_LABEL[k.pattern]})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {overflow.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-700)' }}>
          {overflow.map((m) => (
            <li key={m.id}>
              <strong>{m.name}</strong> — {m.conditions.join(', ')}
            </li>
          ))}
        </ul>
      )}

      {layout.notices.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {layout.notices.join(' ')}
        </p>
      )}

      <div className="section-title" style={{ margin: '14px 0 8px' }}>
        Ký hiệu chung
      </div>
      <div className="geno-legend">
        <span>
          <svg width="18" height="18" aria-hidden="true">
            <rect x="1.5" y="1.5" width="15" height="15" fill="none" stroke={STROKE} strokeWidth="2" />
          </svg>
          Nam
        </span>
        <span>
          <svg width="18" height="18" aria-hidden="true">
            <circle cx="9" cy="9" r="7.5" fill="none" stroke={STROKE} strokeWidth="2" />
          </svg>
          Nữ
        </span>
        <span>
          <svg width="18" height="18" aria-hidden="true">
            <polygon points="9,1 17,9 9,17 1,9" fill="none" stroke={STROKE} strokeWidth="2" />
          </svg>
          Chưa rõ giới
        </span>
        <span>
          <svg width="18" height="18" aria-hidden="true">
            <rect x="1.5" y="1.5" width="15" height="15" fill="none" stroke={STROKE} strokeWidth="2" />
            <line x1="0" y1="0" x2="18" y2="18" stroke={STROKE} strokeWidth="2" />
            <line x1="0" y1="18" x2="18" y2="0" stroke={STROKE} strokeWidth="2" />
          </svg>
          Đã mất
        </span>
        <span>
          <svg width="18" height="18" aria-hidden="true">
            <rect x="1" y="1" width="16" height="16" fill="none" stroke={STROKE} strokeWidth="2.5" />
            <rect x="5" y="5" width="8" height="8" fill="none" stroke={ACCENT} strokeWidth="1.3" />
          </svg>
          Bệnh nhân
        </span>
      </div>

      <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
        Mỗi bệnh lý có một kiểu gạch riêng. Người mang nhiều bệnh được chia thành các dải trong cùng một ký
        hiệu (tối đa {MAX_BANDS} bệnh).
      </p>
    </div>
  )
}
