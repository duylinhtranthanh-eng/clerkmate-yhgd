import { useEffect, useState } from 'react'
import type { LearnerLevel } from '../types/case'
import { LEVELS, LEVEL_ORDER, resolveLevelRequirements } from '../config/levels'
import { REQUIREMENT_BY_ID } from '../config/requirements'
import { exportBackup, importBackup } from '../db/repository'
import { triggerDownload } from '../export/exportPdf'
import { Badge, Card, Chip, Field, Notice, TextInput } from '../components/Ui'
import { TopBar } from '../components/TopBar'
import { useToast } from '../components/Toast'
import { useProfile } from '../hooks/useProfile'
import { useAiStructuring } from '../hooks/useAiStructuring'
import { AI_ENDPOINT } from '../parsing/aiStructurer'

export function SettingsScreen({ back }: { back: () => void }) {
  const { profile, save } = useProfile()
  const [inspect, setInspect] = useState<LearnerLevel>(profile?.level ?? 'Y5')
  const [storage, setStorage] = useState<string>('')
  const ai = useAiStructuring()
  const toast = useToast()

  useEffect(() => {
    if (profile) setInspect(profile.level)
  }, [profile])

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((e) => {
          const used = ((e.usage ?? 0) / 1024 / 1024).toFixed(1)
          const quota = ((e.quota ?? 0) / 1024 / 1024).toFixed(0)
          setStorage(`${used} MB đã dùng / ~${quota} MB khả dụng`)
        })
        .catch(() => undefined)
    }
  }, [])

  const patchProfile = (patch: Partial<NonNullable<typeof profile>>) => {
    if (!profile) return
    void save({ ...profile, ...patch })
  }

  const requirements = Array.from(resolveLevelRequirements(inspect))
    .map(([id, tier]) => ({ id, tier, def: REQUIREMENT_BY_ID[id] }))
    .filter((r) => r.def)
    .sort((a, b) => a.tier.localeCompare(b.tier))

  const onExport = async () => {
    const bundle = await exportBackup()
    triggerDownload(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
      `ClerkMate_backup_${new Date().toISOString().slice(0, 10)}.json`,
    )
    toast(`Đã sao lưu ${bundle.cases.length} ca.`)
  }

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const r = await importBackup(JSON.parse(text))
      const parts = [`Đã khôi phục ${r.cases} ca`]
      if (r.images > 0) parts.push(`${r.images} ảnh`)
      if (r.imagesFailed > 0) parts.push(`${r.imagesFailed} ảnh KHÔNG đọc được`)
      toast(`${parts.join(', ')}.`)
    } catch {
      toast('Tệp không hợp lệ.')
    }
  }

  return (
    <>
      <TopBar title="Cài đặt" onBack={back} />
      <div className="content">
        <Card
          title="Hồ sơ người học"
          hint="Tên và mã số này in trên bệnh án khi xuất PDF gửi giảng viên."
        >
          <Field label="Họ và tên">
            <TextInput
              value={profile?.fullName ?? ''}
              onChange={(e) => patchProfile({ fullName: e.target.value })}
            />
          </Field>
          <Field label="Mã số sinh viên / học viên">
            <TextInput
              value={profile?.studentId ?? ''}
              onChange={(e) => patchProfile({ studentId: e.target.value })}
            />
          </Field>
          <Field label="Lớp / nhóm">
            <TextInput
              value={profile?.classGroup ?? ''}
              onChange={(e) => patchProfile({ classGroup: e.target.value })}
              placeholder="Không bắt buộc"
            />
          </Field>
          <Field label="Năm / trình độ" help="Ca lâm sàng mới sẽ được chấm theo mức này.">
            <div className="chips">
              {LEVEL_ORDER.map((l) => (
                <Chip key={l} on={profile?.level === l} onClick={() => patchProfile({ level: l })}>
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
          {profile && (
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              {LEVELS[profile.level].description}
            </p>
          )}
        </Card>

        <Card
          title="Cách học"
          hint="Danh sách đầy đủ giúp không bỏ sót, nhưng chỉ luyện được khả năng nhận ra. Chế độ dưới đây luyện khả năng tự nhớ."
        >
          <div className="row-between" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 14 }}>Tự nghĩ trước khi xem danh sách</strong>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Ở mỗi nhóm yếu tố nguy cơ, bạn viết ra những gì mình nhớ được trước, rồi mới mở danh sách để
                tự đối chiếu. Có thể bỏ qua bất cứ lúc nào.
              </p>
            </div>
            <div className="chips">
              <Chip on={profile?.recallFirst === true} tone="ok" onClick={() => patchProfile({ recallFirst: true })}>
                Bật
              </Chip>
              <Chip on={profile?.recallFirst === false} onClick={() => patchProfile({ recallFirst: false })}>
                Tắt
              </Chip>
            </div>
          </div>
        </Card>

        <Card
          title="Cấu trúc ghi chú"
          hint="Ghi chú nhanh được tách thành các mục bệnh án bằng bộ luật chạy trên máy. Bạn có thể cho phép dùng thêm một dịch vụ AI."
        >
          <div className="stack stack--tight">
            <button
              type="button"
              className="list__item"
              onClick={() => ai.setAllowAi(false)}
              style={{
                borderRadius: 'var(--r-md)',
                border: `1px solid ${!ai.allowAi ? 'var(--brand-600)' : 'var(--line)'}`,
                background: !ai.allowAi ? 'var(--brand-50)' : undefined,
                textAlign: 'left',
              }}
            >
              <span className="list__icon" aria-hidden="true">{!ai.allowAi ? '◉' : '○'}</span>
              <span className="grow">
                <span className="title">Luôn dùng cục bộ</span>
                <span className="meta">
                  Không có lựa chọn AI. Ứng dụng không gọi ra ngoài, kể cả để kiểm tra dịch vụ.
                </span>
              </span>
            </button>
            <button
              type="button"
              className="list__item"
              onClick={() => ai.setAllowAi(true)}
              style={{
                borderRadius: 'var(--r-md)',
                border: `1px solid ${ai.allowAi ? 'var(--brand-600)' : 'var(--line)'}`,
                background: ai.allowAi ? 'var(--brand-50)' : undefined,
                textAlign: 'left',
              }}
            >
              <span className="list__icon" aria-hidden="true">{ai.allowAi ? '◉' : '○'}</span>
              <span className="grow">
                <span className="title">Cho phép chọn AI khi có mạng</span>
                <span className="meta">
                  Màn hình Ghi nhanh sẽ có thêm nút chọn giữa cục bộ và AI. Mặc định vẫn là cục bộ.
                </span>
              </span>
            </button>
          </div>

          <dl className="doc" style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
            <dt>Chế độ hiện tại</dt>
            <dd>{ai.allowAi ? 'Cho phép chọn AI' : 'Luôn dùng cục bộ'}</dd>
            <dt>Dịch vụ AI</dt>
            <dd>
              {!ai.allowAi
                ? 'Chưa kiểm tra (đang ở chế độ cục bộ)'
                : !ai.online
                  ? 'Đang ngoại tuyến — không kiểm tra được'
                  : ai.checking
                    ? 'Đang kiểm tra…'
                    : ai.configured
                      ? `Đã cấu hình${ai.model ? ` · ${ai.model}` : ''}`
                      : 'Chưa cấu hình trên máy chủ'}
            </dd>
            <dt>Đã đồng ý điều khoản AI</dt>
            <dd>{ai.privacyAccepted ? 'Rồi, trên trình duyệt này' : 'Chưa'}</dd>
            <dt>Điểm gửi yêu cầu</dt>
            <dd className="tiny mono">{AI_ENDPOINT}</dd>
          </dl>

          {ai.privacyAccepted && (
            <button
              type="button"
              className="link-btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                ai.resetPrivacy()
                toast('Đã xoá xác nhận. Lần dùng AI kế tiếp sẽ hỏi lại.')
              }}
            >
              Xoá xác nhận quyền riêng tư
            </button>
          )}

          <Notice tone="info">
            Ở chế độ AI, ứng dụng chỉ gửi <strong>nội dung ghi chú nhanh</strong> — không gửi bệnh án,
            hình ảnh đính kèm, tên hay mã số của bạn. AI chỉ đề xuất cách sắp xếp; bạn vẫn phải xác
            nhận từng mục. AI không chẩn đoán và không đề nghị điều trị. Nếu dịch vụ lỗi hoặc mất
            mạng, ứng dụng tự quay về bộ sắp xếp cục bộ.
          </Notice>
        </Card>

        <Card title="Yêu cầu theo trình độ" hint="Bảng cấu hình này do bộ môn quy định và có thể chỉnh sửa.">
          <div className="chips" style={{ marginBottom: 12 }}>
            {LEVEL_ORDER.map((l) => (
              <Chip key={l} small on={inspect === l} onClick={() => setInspect(l)}>
                {l}
              </Chip>
            ))}
          </div>
          <p className="small muted">{LEVELS[inspect].description}</p>
          <div className="stack stack--tight" style={{ marginTop: 10 }}>
            {requirements.map((r) => (
              <div key={r.id} className="row-between" style={{ gap: 10 }}>
                <span style={{ fontSize: 13.5, flex: 1 }}>{r.def.label}</span>
                <Badge tone={r.tier === 'mandatory' ? 'danger' : r.tier === 'recommended' ? 'warn' : 'muted'}>
                  {r.tier === 'mandatory' ? 'bắt buộc' : r.tier === 'recommended' ? 'nên có' : 'nâng cao'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Dữ liệu cục bộ" hint="Toàn bộ dữ liệu nằm trong trình duyệt này.">
          {storage && <p className="small muted">{storage}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn--secondary" onClick={onExport}>
              Sao lưu ra tệp
            </button>
            <label className="btn btn--secondary" style={{ cursor: 'pointer' }}>
              Khôi phục từ tệp
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onImport(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh sẽ làm mất các ca đã lưu. Hãy sao lưu trước khi
            trình diễn.
          </p>
        </Card>

        <Card title="Về ClerkMate">
          <p className="small">
            <strong>ClerkMate</strong> — “Từ ghi chú nhanh đến bệnh án hoàn chỉnh.” Công cụ học tập ghi nhận
            bệnh án Y học gia đình trên điện thoại.
          </p>
          <Notice tone="info">
            Phiên bản MVP: không tài khoản, không máy chủ lưu dữ liệu. Bệnh án nằm trên máy bạn.
            Không có OCR, không nhận dạng giọng nói, <strong>không gợi ý chẩn đoán hay điều trị bằng
            AI</strong>.
            {ai.allowAi
              ? ' Bạn đang cho phép dùng AI để sắp xếp ghi chú: ở chế độ đó, nội dung ghi chú được gửi ra dịch vụ AI để đề xuất cách sắp xếp, và chỉ khi bạn tự chọn chế độ AI.'
              : ' Đang ở chế độ cục bộ hoàn toàn: ứng dụng không gửi dữ liệu đi đâu.'}
          </Notice>
        </Card>
      </div>
    </>
  )
}
