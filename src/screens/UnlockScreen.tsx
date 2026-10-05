/**
 * The screen a learner meets when the records on this device are encrypted.
 *
 * It stands in front of the app, not inside it: nothing is read from storage
 * until the password opens the key, so there is no decrypted state to leak
 * while this is on screen. There is no "forgot password" link because there is
 * nothing behind one — no server holds anything that could reset it, and saying
 * otherwise would be a lie told at the worst possible moment.
 */

import { useState } from 'react'
import { Card, Notice, TextInput } from '../components/Ui'
import { unlockVault } from '../db/repository'

export function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)

  const submit = async () => {
    if (!password || busy) return
    setBusy(true)
    setWrong(false)
    try {
      if (await unlockVault(password)) {
        onUnlocked()
        return
      }
      setWrong(true)
      setPassword('')
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
          🔒
        </div>
        <h1>Bệnh án đang được khoá</h1>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          Dữ liệu trên thiết bị này đã được mã hoá. Nhập mật khẩu để mở.
        </p>
      </div>

      <Card title="Mở khoá">
        <TextInput
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Mật khẩu"
          autoFocus
          aria-label="Mật khẩu mở khoá"
        />
        {wrong && <Notice tone="warn">Mật khẩu không đúng. Chưa có gì được mở.</Notice>}
        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 'var(--sp-3)' }}
          disabled={!password || busy}
          onClick={() => void submit()}
        >
          {busy ? 'Đang mở…' : 'Mở khoá'}
        </button>
      </Card>

      <Notice tone="info">
        Mật khẩu này chỉ nằm trong đầu bạn. ClerkMate không có máy chủ, nên{' '}
        <strong>không ai đặt lại được</strong> — kể cả người viết ứng dụng. Quên mật khẩu là mất toàn
        bộ bệnh án trên thiết bị này.
      </Notice>
    </div>
  )
}
