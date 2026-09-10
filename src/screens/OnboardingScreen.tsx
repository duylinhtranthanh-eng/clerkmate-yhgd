import { useState } from 'react'
import type { LearnerLevel } from '../types/case'
import { createProfile } from '../types/profile'
import { LEVELS, LEVEL_ORDER } from '../config/levels'
import { Card, Chip, Field, Notice, TextInput } from '../components/Ui'
import { useProfile } from '../hooks/useProfile'

/**
 * First-run learner profile. Not a login: nothing is verified and nothing
 * leaves the device — the name and student ID exist so the exported record
 * says whose work it is.
 */
export function OnboardingScreen() {
  const { save } = useProfile()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [level, setLevel] = useState<LearnerLevel>('Y5')
  const [classGroup, setClassGroup] = useState('')
  const [busy, setBusy] = useState(false)

  const ready = fullName.trim().length > 0 && studentId.trim().length > 0

  const submit = async () => {
    if (!ready) return
    setBusy(true)
    try {
      await save(createProfile(fullName.trim(), studentId.trim(), level, classGroup.trim()))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content" style={{ paddingTop: 'var(--sp-8)' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 18,
            background: 'var(--brand-600)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto var(--sp-4)',
            fontSize: 30,
          }}
          aria-hidden="true"
        >
          🩺
        </div>
        <h1>ClerkMate</h1>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Từ ghi chú nhanh đến bệnh án hoàn chỉnh
        </p>
        {/*
          This is the first screen anyone sees on a fresh install — including a
          reviewer who has never heard of ClerkMate. It has to say what the app
          is for and what data belongs in it before asking for anything.
        */}
        <p className="small" style={{ margin: '10px 0 0' }}>
          Công cụ <strong>học tập</strong> để ghi bệnh án Y học gia đình trên điện thoại — không phải
          EMR bệnh viện. Ca mẫu trong ứng dụng là <strong>bệnh nhân giả lập</strong>; chỉ dùng dữ liệu
          giả lập hoặc đã ẩn danh.
        </p>
      </div>

      <Card title="Hồ sơ người học" hint="Thông tin này in trên bệnh án khi bạn xuất PDF gửi giảng viên.">
        <Field label="Họ và tên">
          <TextInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
          />
        </Field>

        <Field label="Mã số sinh viên / học viên">
          <TextInput
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="21YHGD001"
          />
        </Field>

        <Field label="Năm / trình độ" help="Quy định mức độ đầy đủ mà bệnh án cần đạt.">
          <div className="chips">
            {LEVEL_ORDER.map((l) => (
              <Chip key={l} on={level === l} onClick={() => setLevel(l)}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
        <p className="small muted" style={{ marginTop: -4 }}>{LEVELS[level].description}</p>

        <Field label="Lớp / nhóm">
          <TextInput
            value={classGroup}
            onChange={(e) => setClassGroup(e.target.value)}
            placeholder="Không bắt buộc"
          />
        </Field>

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 'var(--sp-4)' }}
          disabled={!ready || busy}
          onClick={submit}
        >
          {busy ? 'Đang lưu…' : 'Bắt đầu'}
        </button>
      </Card>

      <Notice tone="info">
        Đây không phải đăng nhập. Không có mật khẩu, không có máy chủ — hồ sơ chỉ lưu trong trình duyệt này
        và có thể sửa lại trong Cài đặt.
      </Notice>
    </div>
  )
}
