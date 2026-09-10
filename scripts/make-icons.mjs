/**
 * Generates the PWA icons from geometry, with no image library.
 *
 * The mark is the same one used by the favicon: three rounded strokes on a
 * teal ground. Everything is rasterised here — a signed-distance test per
 * sub-pixel, then a hand-rolled PNG encoder over zlib — so the icons are
 * reproducible from source instead of being checked in as opaque blobs.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BG = [0x0f, 0x9b, 0x8e]
const FG = [0xff, 0xff, 0xff]

/** The favicon's three strokes, as fractions of the icon size. */
const STROKES = [
  [0.28, 0.3125, 0.625],
  [0.28, 0.5, 0.72],
  [0.28, 0.6875, 0.53],
]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Signed distance to a rounded rectangle centred on (cx, cy). */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius)
  const qy = Math.abs(py - cy) - (halfH - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

/** Signed distance to a capsule: a line segment with rounded ends. */
function capsuleDistance(px, py, x0, y0, x1, y1, radius) {
  const dx = x1 - x0
  const dy = y1 - y0
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : clamp01(((px - x0) * dx + (py - y0) * dy) / lengthSq)
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)) - radius
}

/** Coverage in [0,1] for a distance field, using a one-pixel soft edge. */
const coverage = (distance) => clamp01(0.5 - distance)

function renderIcon(size, { maskable = false } = {}) {
  const scale = maskable ? 0.78 : 1
  const centre = size / 2
  const cornerRadius = size * 0.22
  const strokeRadius = (size * 0.082) / 2
  const samples = 3
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgCoverage = 0
      let fgCoverage = 0

      // Supersample: distance fields alias badly at 192px otherwise.
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples
          const py = y + (sy + 0.5) / samples

          bgCoverage += maskable
            ? 1
            : coverage(roundedRectDistance(px, py, centre, centre, centre, centre, cornerRadius))

          // Glyph coordinates shrink about the centre for the maskable safe zone.
          const gx = centre + (px - centre) / scale
          const gy = centre + (py - centre) / scale
          let best = Infinity
          for (const [x0, yy, x1] of STROKES) {
            best = Math.min(
              best,
              capsuleDistance(gx, gy, size * x0, size * yy, size * x1, size * yy, strokeRadius),
            )
          }
          fgCoverage += coverage(best)
        }
      }

      const total = samples * samples
      const bgAlpha = bgCoverage / total
      const fgAlpha = Math.min(fgCoverage / total, bgAlpha)
      const offset = (y * size + x) * 4

      // Composite the white mark over the teal ground.
      for (let c = 0; c < 3; c++) {
        pixels[offset + c] = Math.round(
          bgAlpha === 0 ? 0 : (BG[c] * (bgAlpha - fgAlpha) + FG[c] * fgAlpha) / bgAlpha,
        )
      }
      pixels[offset + 3] = Math.round(bgAlpha * 255)
    }
  }

  return pixels
}

// --- minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 10..12 stay zero: default compression, filter and interlace.

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --- write them out ---------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
]

for (const [name, size, opts] of targets) {
  const png = encodePng(size, renderIcon(size, opts))
  writeFileSync(join(OUT_DIR, name), png)
  console.log(`${name.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} kB`)
}
