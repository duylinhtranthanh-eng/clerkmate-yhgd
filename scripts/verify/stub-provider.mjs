/**
 * Stand-in for the AI provider, so the whole path can be exercised without a
 * real key: proxy → provider → validation → UI. Speaks the Anthropic Messages
 * shape. `?mode=` switches it into each failure the fallback must survive.
 */
import { createServer } from 'node:http'

const EXTRACTION = {
  suggestions: [
    { target: 'patient.sex', value: 'Nữ', source: 'Nữ 58 tuổi', confidence: 0.99, fields: { sex: 'Nữ' } },
    { target: 'patient.ageYears', value: '58', source: 'Nữ 58 tuổi', confidence: 0.99, fields: { age: '58' } },
    { target: 'patient.occupation', value: 'Nội trợ', source: 'nội trợ', confidence: 0.95 },
    { target: 'history.chiefComplaint', value: 'Đau gối phải', source: 'Đau gối phải 3 tháng', confidence: 0.94 },
    { target: 'history.duration', value: '3 tháng', source: 'Đau gối phải 3 tháng', confidence: 0.96 },
    { target: 'history.hpi.append', value: 'Đau gối phải 3 tháng, tăng khi lên xuống cầu thang.', source: 'Đau gối phải 3 tháng, tăng khi lên xuống cầu thang.', confidence: 0.9 },
    { target: 'pastMedical.add', value: 'Tăng huyết áp', source: 'THA 10 năm', confidence: 0.96, fields: { label: 'Tăng huyết áp', since: '10 năm' } },
    { target: 'medications.add', value: 'Amlodipine 5 mg mỗi sáng', source: 'đang uống amlodipine 5 mg mỗi sáng', confidence: 0.93, fields: { name: 'Amlodipine', dose: '5 mg', frequency: 'Mỗi sáng' } },
    { target: 'lifestyle.smoking', value: 'Không hút thuốc', source: 'Không hút thuốc', confidence: 0.97, fields: { status: 'Không hút thuốc' } },
    { target: 'lifestyle.alcohol', value: 'Thỉnh thoảng uống bia', source: 'thỉnh thoảng uống bia', confidence: 0.9, fields: { status: 'Thỉnh thoảng uống bia' } },
    { target: 'familyHistory.add', value: 'Đái tháo đường — Mẹ', source: 'Mẹ bị đái tháo đường', confidence: 0.94, fields: { condition: 'Đái tháo đường', relatives: 'Mẹ' } },
    { target: 'familyMembers.add', value: 'Mẹ', source: 'Mẹ bị đái tháo đường', confidence: 0.9, fields: { relation: 'mother', condition: 'Đái tháo đường' } },
    { target: 'vitals.bloodPressure', value: '148/86', source: 'HA hôm nay 148/86 mmHg', confidence: 0.98, fields: { systolic: '148', diastolic: '86' } },
    { target: 'vitals.pulse', value: '78', source: 'mạch 78 lần/phút', confidence: 0.98, fields: { pulse: '78' } },

    // Three items that MUST be discarded by the client, never shown:
    { target: 'diagnosis.primary', value: 'Thoái hóa khớp gối', source: 'Đau gối phải 3 tháng', confidence: 0.8 },
    { target: 'redFlags.present', value: 'Sốt', source: 'bệnh nhân sốt cao 39 độ', confidence: 0.7 },
    { target: 'allergies.add', value: 'Penicillin', source: 'Không dị ứng thuốc', confidence: 0.4, fields: { agent: 'Penicillin' } },
  ],
}

const send = (res, status, body) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(text)
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  const mode = url.searchParams.get('mode') ?? 'ok'
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (mode === 'rate-limit') return send(res, 429, { error: 'slow down' })
    if (mode === 'auth') return send(res, 401, { error: 'bad key' })
    if (mode === 'server') return send(res, 500, { error: 'boom' })
    if (mode === 'timeout') return setTimeout(() => send(res, 200, {}), 30_000)
    if (mode === 'garbage') {
      return send(res, 200, { content: [{ type: 'text', text: 'xin lỗi, tôi không thể trả JSON' }] })
    }
    // The real model wraps its JSON in prose and fences often enough that the
    // proxy has to cope; make the happy path do exactly that.
    const text = 'Đây là kết quả:\n```json\n' + JSON.stringify(EXTRACTION) + '\n```'
    send(res, 200, { content: [{ type: 'text', text }], model: 'stub-model' })
  })
}).listen(8787, () => console.log('stub provider on :8787'))
