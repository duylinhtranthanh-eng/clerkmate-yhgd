/**
 * Renders a printable QR code for the deployed app.
 *
 *   node scripts/make-share-qr.mjs [url]
 *
 * Output goes to `share/` — outside `dist/`, so it is never deployed with the
 * app. Meant for a slide, a printout on a clinic noticeboard, or a Zalo message.
 */

import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL_TO_SHARE = process.argv[2] ?? 'https://clerkmate-yhgd.netlify.app'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'share')

mkdirSync(OUT_DIR, { recursive: true })

const common = {
  errorCorrectionLevel: 'M',
  margin: 2,
  color: { dark: '#0F9B8E', light: '#FFFFFF' },
}

await QRCode.toFile(join(OUT_DIR, 'clerkmate-qr.png'), URL_TO_SHARE, {
  ...common,
  type: 'png',
  width: 1024,
})

// Vector, for slides and posters that get scaled up.
await QRCode.toFile(join(OUT_DIR, 'clerkmate-qr.svg'), URL_TO_SHARE, {
  ...common,
  type: 'svg',
})

console.log(`QR cho ${URL_TO_SHARE}`)
console.log('  share/clerkmate-qr.png  (1024px, cho slide và in)')
console.log('  share/clerkmate-qr.svg  (vector, phóng to không mờ)')
console.log(await QRCode.toString(URL_TO_SHARE, { type: 'terminal', small: true }))
