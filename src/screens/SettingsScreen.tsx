import { useEffect, useState } from 'react'
import type { LearnerLevel } from '../types/case'
import { LEVELS, LEVEL_ORDER, resolveLevelRequirements } from '../config/levels'
import { REQUIREMENT_BY_ID } from '../config/requirements'
import {
  disableVault,
  enableVault,
  exportBackup,
  importBackup,
  vaultState,
} from '../db/repository'
import type { VaultState } from '../db/repository'
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
  const [pendingLevel, setPendingLevel] = useState<LearnerLevel | null>(null)
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
          {/*
            Changing this is asked about rather than done, because a learner who
            taps Y6 while browsing must not find their Y5 cases silently
            re-marked. The level a case was written at is part of what it
            records, so it stays with the case.
          */}
          <Field label="Mức đào tạo mặc định" help="Dùng cho các bệnh án tạo sau thời điểm này.">
            <div className="chips">
              {LEVEL_ORDER.map((l) => (
                <Chip key={l} on={profile?.level === l} onClick={() => l !== profile?.level && setPendingLevel(l)}>
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
          {pendingLevel && (
            <Notice tone="warn">
              Đổi mức mặc định sang <strong>{pendingLevel}</strong>? Mức mới sẽ được dùng mặc định cho các
              bệnh án tạo sau thời điểm này. <strong>Bệnh án cũ giữ nguyên mức đã chọn.</strong>
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    patchProfile({ level: pendingLevel })
                    setPendingLevel(null)
                    toast(`Mức mặc định giờ là ${pendingLevel}.`)
                  }}
                >
                  Đổi sang {pendingLevel}
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPendingLevel(null)}>
                  Giữ nguyên
                </button>
              </div>
            </Notice>
          )}

          {/*
            What each level is expected to be able to do, so the choice above is
            made against something rather than against a label. Each level says
            what it adds to the one before it, because that is how they are
            built — a mức never drops what the mức below it asks for.
          */}
          <div className="level-table" style={{ marginTop: 4 }}>
            {LEVEL_ORDER.map((l) => (
              <div
                key={l}
                className="level-table__row"
                data-current={profile?.level === l ? 'true' : 'false'}
              >
                <div className="level-table__level">
                  {l}
                  {profile?.level === l && <span className="level-table__you">bạn chọn</span>}
                </div>
                <div className="level-table__detail small">{LEVELS[l].expects}</div>
              </div>
            ))}
          </div>
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

        <VaultCard />

        <Card title="Về ClerkMate">
          <p className="small">
            <strong>ClerkMate</strong> — “Từ ghi chú nhanh đến bệnh án hoàn chỉnh.” Công cụ học tập ghi nhận
            bệnh án Y học gia đình trên điện thoại.
          </p>
          <Notice tone="info">
            Phiên bản MVP: không tài khoản, không máy chủ lưu dữ liệu. Bệnh án nằm trên máy bạn, và{' '}
            <strong>không có gợi ý chẩn đoán hay điều trị bằng AI</strong>.
            {ai.allowAi
              ? ' Bạn đang cho phép dùng AI để sắp xếp ghi chú: ở chế độ đó, nội dung ghi chú được gửi ra dịch vụ AI để đề xuất cách sắp xếp, và chỉ khi bạn tự chọn chế độ AI.'
              : ' Ghi chú và bệnh án không được gửi đi đâu.'}
          </Notice>

          {/*
            Spelled out rather than summarised as "chạy cục bộ".

            This card used to say the app had no speech recognition and no text
            recognition. The first had not been true since dictation shipped, and
            the second stopped being true when slip reading did. A learner
            deciding whether to point a microphone at a consultation deserves the
            actual answer, so both are named here with where the data goes.
          */}
          <Notice tone="warn">
            Hai chỗ <em>có thể</em> gửi dữ liệu ra ngoài máy, và cả hai chỉ chạy khi bạn chủ động
            dùng:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              <li>
                <strong>Nhập bằng giọng nói</strong> dùng dịch vụ nhận dạng của trình duyệt (Google
                với Chrome, Apple với Safari), nên <strong>âm thanh được gửi tới dịch vụ đó</strong>.
                Ứng dụng nói rõ điều này trước khi bật micro.
              </li>
              <li>
                <strong>Đọc phiếu xét nghiệm</strong> chạy ngay trên máy này: ảnh không được lưu vào
                bệnh án và không gửi đi đâu. Chỉ khi bạn chọn “nhờ AI đọc lại” thì ảnh mới rời máy,
                và ứng dụng hỏi lại trước khi gửi.
              </li>
            </ul>
          </Notice>
        </Card>
      </div>
    </>
  )
}


/**
 * Switching at-rest encryption on and off.
 *
 * Off by default, and it stays that way unless a learner chooses otherwise:
 * most people trying ClerkMate are looking at simulated cases, and a password
 * prompt in front of that is friction with nothing behind it. The ones who put
 * real de-identified work on a shared clinic phone are the ones this is for.
 *
 * Everything the learner is about to lose control over is said before the
 * switch, not after: no reset, and the backup file stays readable.
 */
function VaultCard() {
  const toast = useToast()
  const [state, setState] = useState<VaultState | null>(null)
  const [opening, setOpening] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void vaultState().then(setState)
  }, [])

  if (state === null) return null

  if (state === 'unavailable') {
    return (
      <Card title="Mã hoá dữ liệu trên thiết bị" className="card--flat">
        <Notice tone="warn">
          Trình duyệt này không hỗ trợ mã hoá (Web Crypto). Tính năng không dùng được ở đây.
        </Notice>
      </Card>
    )
  }

  const enabled = state === 'open' || state === 'locked'

  const turnOn = async () => {
    if (pw.length < 8) {
      toast('Mật khẩu cần ít nhất 8 ký tự.')
      return
    }
    if (pw !== pw2) {
      toast('Hai lần nhập mật khẩu chưa khớp.')
      return
    }
    if (
      !window.confirm(
        'ClerkMate không có máy chủ, nên KHÔNG AI đặt lại được mật khẩu này — kể cả người viết ứng dụng. ' +
          'Quên mật khẩu là mất toàn bộ bệnh án trên thiết bị này. Bạn đã ghi lại mật khẩu ở nơi an toàn chưa?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await enableVault(pw)
      setPw('')
      setPw2('')
      setOpening(false)
      setState(await vaultState())
      toast('Đã mã hoá dữ liệu trên thiết bị này.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không bật được mã hoá.')
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!window.confirm('Tắt mã hoá? Bệnh án sẽ được lưu ở dạng đọc được như trước.')) return
    setBusy(true)
    try {
      await disableVault()
      setState(await vaultState())
      toast('Đã tắt mã hoá.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không tắt được mã hoá.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Mã hoá dữ liệu trên thiết bị"
      hint="Dành cho máy dùng chung. Mặc định tắt."
      className="card--flat"
    >
      <div className="row-between" style={{ gap: 12 }}>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 14 }}>
            {enabled ? 'Đang bật' : 'Đang tắt'}
          </strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {enabled
              ? 'Bệnh án và ảnh được mã hoá khi lưu. Mở app lần sau sẽ phải nhập mật khẩu.'
              : 'Bệnh án đang lưu ở dạng đọc được. Ai mở được trình duyệt này là đọc được.'}
          </p>
        </div>
        {enabled ? (
          <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void turnOff()}>
            Tắt
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpening((v) => !v)}>
            {opening ? 'Huỷ' : 'Bật'}
          </button>
        )}
      </div>

      {opening && !enabled && (
        <div className="stack" style={{ marginTop: 12 }}>
          <Notice tone="warn">
            <strong>Không ai đặt lại được mật khẩu này.</strong> ClerkMate không có máy chủ. Quên là mất
            toàn bộ bệnh án trên thiết bị này.
          </Notice>
          <Field label="Mật khẩu" help="Ít nhất 8 ký tự.">
            <TextInput type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Nhập lại mật khẩu">
            <TextInput type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy || !pw || !pw2}
            onClick={() => void turnOn()}
          >
            {busy ? 'Đang mã hoá…' : 'Mã hoá dữ liệu trên thiết bị này'}
          </button>
        </div>
      )}

      <Notice tone="info">
        Đây là <strong>mã hoá dữ liệu lưu trên máy</strong>, không phải đăng nhập — nó không xác thực
        bạn là ai. Tệp sao lưu vẫn ở dạng đọc được, vì nó phải khôi phục được trên máy khác.
      </Notice>
    </Card>
  )
}
