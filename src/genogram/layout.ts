/**
 * Deterministic genogram layout.
 *
 * Generation-based: -1 parents, 0 patient / siblings / spouse, +1 children.
 * Same input always produces the same coordinates — no randomness, no AI.
 * Grandparents and wider structures can be added by extending `GENERATIONS`
 * and the row builders without changing the renderer.
 */

import type { FamilyMember } from '../types/case'

export const NODE = 46
export const HGAP = 30
export const ROW_H = 120
export const PAD = 28

export interface GenogramNode {
  id: string
  member: FamilyMember
  /** Top-left corner of the symbol box. */
  x: number
  y: number
  size: number
  generation: -1 | 0 | 1
  isIndexPerson: boolean
}

export type EdgeKind = 'couple' | 'descent'

export interface GenogramEdge {
  id: string
  kind: EdgeKind
  points: [number, number][]
}

export interface GenogramLayout {
  width: number
  height: number
  nodes: GenogramNode[]
  edges: GenogramEdge[]
  /** Non-fatal notes shown under the drawing, e.g. missing parents. */
  notices: string[]
}

const byOrder = (a: FamilyMember, b: FamilyMember) => a.order - b.order || a.id.localeCompare(b.id)

function centerX(n: { x: number; size: number }): number {
  return n.x + n.size / 2
}

export function layoutGenogram(members: FamilyMember[]): GenogramLayout {
  const notices: string[] = []
  const self = members.find((m) => m.relation === 'self') ?? null
  const father = members.find((m) => m.relation === 'father') ?? null
  const mother = members.find((m) => m.relation === 'mother') ?? null
  const siblings = members.filter((m) => m.relation === 'sibling').sort(byOrder)
  const spouses = members.filter((m) => m.relation === 'spouse').sort(byOrder)
  const children = members.filter((m) => m.relation === 'child').sort(byOrder)

  const hasParentRow = !!father || !!mother
  const hasChildRow = children.length > 0

  const generations: (-1 | 0 | 1)[] = []
  if (hasParentRow) generations.push(-1)
  generations.push(0)
  if (hasChildRow) generations.push(1)
  const rowY = (g: -1 | 0 | 1) => PAD + generations.indexOf(g) * ROW_H
  /**
   * Sibship bars sit just above their own row rather than midway between rows,
   * so they never cross the name / age labels hanging under the row above.
   */
  const barAbove = (g: -1 | 0 | 1) => rowY(g) - 18

  const nodes: GenogramNode[] = []
  const edges: GenogramEdge[] = []
  const push = (member: FamilyMember, x: number, generation: -1 | 0 | 1): GenogramNode => {
    const n: GenogramNode = {
      id: member.id,
      member,
      x,
      y: rowY(generation),
      size: NODE,
      generation,
      isIndexPerson: member.relation === 'self',
    }
    nodes.push(n)
    return n
  }

  // --- generation 0 --------------------------------------------------------
  const sibship: FamilyMember[] = [...siblings]
  if (self) sibship.push(self)
  sibship.sort(byOrder)

  const row0: { member: FamilyMember; isSpouse: boolean }[] = []
  if (sibship.length === 0 && spouses.length === 0) {
    notices.push('Chưa có dữ liệu thành viên để vẽ phả hệ.')
  }
  for (const m of sibship) {
    row0.push({ member: m, isSpouse: false })
    if (self && m.id === self.id) {
      for (const sp of spouses) row0.push({ member: sp, isSpouse: true })
    }
  }
  if (!self) {
    for (const sp of spouses) row0.push({ member: sp, isSpouse: true })
  }

  const row0Nodes = row0.map((item, i) => push(item.member, i * (NODE + HGAP), 0))
  const sibshipNodes = row0Nodes.filter((n) => n.member.relation !== 'spouse')
  const selfNode = row0Nodes.find((n) => n.member.relation === 'self') ?? null
  const spouseNodes = row0Nodes.filter((n) => n.member.relation === 'spouse')

  // --- generation -1 -------------------------------------------------------
  const sibshipSpanCenter =
    sibshipNodes.length > 0
      ? (centerX(sibshipNodes[0]) + centerX(sibshipNodes[sibshipNodes.length - 1])) / 2
      : row0Nodes.length > 0
        ? centerX(row0Nodes[0])
        : 0

  let parentCoupleMid: [number, number] | null = null
  if (hasParentRow) {
    const parentOrder = [father, mother].filter(Boolean) as FamilyMember[]
    const width = parentOrder.length * NODE + (parentOrder.length - 1) * HGAP
    const startX = sibshipSpanCenter - width / 2
    const parentNodes = parentOrder.map((m, i) => push(m, startX + i * (NODE + HGAP), -1))
    const py = rowY(-1) + NODE / 2
    if (parentNodes.length === 2) {
      edges.push({
        id: 'couple-parents',
        kind: 'couple',
        points: [
          [parentNodes[0].x + NODE, py],
          [parentNodes[1].x, py],
        ],
      })
      parentCoupleMid = [(centerX(parentNodes[0]) + centerX(parentNodes[1])) / 2, py]
    } else {
      // Single parent: leave the symbol sideways so the drop line does not run
      // through that person's own label.
      const only = parentNodes[0]
      const elbowX = only.x + NODE + HGAP / 2
      const my = rowY(-1) + NODE / 2
      edges.push({
        id: 'couple-parent-stub',
        kind: 'couple',
        points: [
          [only.x + NODE, my],
          [elbowX, my],
        ],
      })
      parentCoupleMid = [elbowX, my]
      if (!father) notices.push('Chưa có thông tin cha.')
      if (!mother) notices.push('Chưa có thông tin mẹ.')
    }
  }

  // Descent line: parents -> sibship
  if (parentCoupleMid && sibshipNodes.length > 0) {
    const barY = barAbove(0)
    edges.push({
      id: 'descent-sibship-drop',
      kind: 'descent',
      points: [parentCoupleMid, [parentCoupleMid[0], barY]],
    })
    const left = centerX(sibshipNodes[0])
    const right = centerX(sibshipNodes[sibshipNodes.length - 1])
    edges.push({
      id: 'descent-sibship-bar',
      kind: 'descent',
      points: [
        [Math.min(left, parentCoupleMid[0]), barY],
        [Math.max(right, parentCoupleMid[0]), barY],
      ],
    })
    for (const n of sibshipNodes) {
      edges.push({
        id: `descent-sib-${n.id}`,
        kind: 'descent',
        points: [
          [centerX(n), barY],
          [centerX(n), n.y],
        ],
      })
    }
  }

  // --- couple line: patient <-> spouse -------------------------------------
  let unionMid: [number, number] | null = null
  if (selfNode && spouseNodes.length > 0) {
    const sp = spouseNodes[0]
    const y = rowY(0) + NODE / 2
    const leftNode = selfNode.x < sp.x ? selfNode : sp
    const rightNode = selfNode.x < sp.x ? sp : selfNode
    edges.push({
      id: 'couple-index',
      kind: 'couple',
      points: [
        [leftNode.x + NODE, y],
        [rightNode.x, y],
      ],
    })
    unionMid = [(centerX(leftNode) + centerX(rightNode)) / 2, y]
  } else if (selfNode) {
    // No spouse recorded: same sideways elbow so children hang off the patient
    // without the line crossing their label.
    const elbowX = selfNode.x + NODE + HGAP / 2
    const my = rowY(0) + NODE / 2
    if (children.length > 0) {
      edges.push({
        id: 'couple-index-stub',
        kind: 'couple',
        points: [
          [selfNode.x + NODE, my],
          [elbowX, my],
        ],
      })
    }
    unionMid = [elbowX, my]
  }

  // --- generation +1 -------------------------------------------------------
  if (hasChildRow && unionMid) {
    const width = children.length * NODE + (children.length - 1) * HGAP
    const startX = unionMid[0] - width / 2
    const childNodes = children.map((m, i) => push(m, startX + i * (NODE + HGAP), 1))
    const barY = barAbove(1)
    edges.push({
      id: 'descent-child-drop',
      kind: 'descent',
      points: [unionMid, [unionMid[0], barY]],
    })
    if (childNodes.length > 1) {
      edges.push({
        id: 'descent-child-bar',
        kind: 'descent',
        points: [
          [centerX(childNodes[0]), barY],
          [centerX(childNodes[childNodes.length - 1]), barY],
        ],
      })
    }
    for (const n of childNodes) {
      edges.push({
        id: `descent-child-${n.id}`,
        kind: 'descent',
        points: [
          [centerX(n), barY],
          [centerX(n), n.y],
        ],
      })
    }
  } else if (hasChildRow && !unionMid) {
    notices.push('Cần có bệnh nhân trong danh sách để nối con vào phả hệ.')
  }

  // --- normalise coordinates ----------------------------------------------
  const xs = nodes.flatMap((n) => [n.x, n.x + n.size])
  const edgeXs = edges.flatMap((e) => e.points.map((p) => p[0]))
  const minX = Math.min(...xs, ...edgeXs, 0)
  const shift = PAD - minX

  for (const n of nodes) n.x += shift
  for (const e of edges) e.points = e.points.map(([x, y]) => [x + shift, y] as [number, number])

  const maxX = Math.max(...nodes.map((n) => n.x + n.size), ...edges.flatMap((e) => e.points.map((p) => p[0])), 0)
  const maxY = Math.max(...nodes.map((n) => n.y + n.size), 0)

  return {
    width: Math.round(maxX + PAD),
    height: Math.round(maxY + 30 + PAD),
    nodes,
    edges,
    notices,
  }
}
