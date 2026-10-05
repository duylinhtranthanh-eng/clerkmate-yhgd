/**
 * Copies the OCR runtime out of node_modules into `public/ocr/`.
 *
 * Tesseract.js fetches its worker, its WebAssembly core and its language data
 * at run time, and by default it fetches them from a public CDN. That would
 * mean a learner's lab photo triggers a request to a third party the moment
 * they use the feature, which is exactly the property this app claims not to
 * have. Serving the same files from our own origin keeps the claim true: the
 * only host involved is the one the app is already on, and the service worker
 * caches them on first use so the second use works with no signal at all.
 *
 * The language data is committed (it is half a megabyte and does not come from
 * npm). Everything else is copied here at build time and is git-ignored.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const files = [
  ['node_modules/tesseract.js/dist/tesseract.esm.min.js', 'tesseract.esm.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // All three LSTM cores, because `corePath` is a directory and tesseract.js
  // picks by feature detection inside the worker: relaxed SIMD where the browser
  // has it, plain SIMD next, and the baseline build otherwise. Shipping only the
  // one this machine happens to choose is how the first run of this failed —
  // Chrome asked for the relaxed-SIMD core and got a 404. Exactly one of them is
  // ever downloaded. The `.wasm.js` carries the WebAssembly inside it as base64,
  // so the matching `.wasm` files are dead weight and are not copied.
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
]

let copied = 0
for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) {
    console.error(`sync-ocr-assets: missing ${from} — run npm install first.`)
    process.exit(1)
  }
  copyFileSync(src, join(out, to))
  copied += 1
}

if (!existsSync(join(out, 'vie.traineddata.gz'))) {
  console.error('sync-ocr-assets: public/ocr/vie.traineddata.gz is missing from the repository.')
  process.exit(1)
}

console.log(`sync-ocr-assets: ${copied} files copied into public/ocr/`)
