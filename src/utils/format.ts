import type { Sex } from '../types/case'

export const SEX_LABEL: Record<Sex, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  unknown: 'Chưa rõ',
}

export function computeBmi(heightCm: string, weightKg: string): string {
  const h = parseFloat(String(heightCm).replace(',', '.'))
  const w = parseFloat(String(weightKg).replace(',', '.'))
  if (!isFinite(h) || !isFinite(w) || h <= 0 || w <= 0) return ''
  const m = h > 3 ? h / 100 : h
  const bmi = w / (m * m)
  if (!isFinite(bmi) || bmi <= 0 || bmi > 200) return ''
  return bmi.toFixed(1)
}

/** WHO Asia-Pacific cut-offs, which is what the FM curriculum teaches locally. */
export function bmiCategory(bmi: string): string {
  const v = parseFloat(bmi)
  if (!isFinite(v)) return ''
  if (v < 18.5) return 'Thiếu cân'
  if (v < 23) return 'Bình thường'
  if (v < 25) return 'Thừa cân'
  if (v < 30) return 'Béo phì độ I'
  return 'Béo phì độ II'
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function relativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (isNaN(d)) return ''
  const diff = Date.now() - d
  const min = Math.round(diff / 60000)
  if (min < 1) return 'vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day} ngày trước`
  return formatDate(iso)
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nonEmpty(s: string | null | undefined): boolean {
  return !!s && s.trim().length > 0
}
