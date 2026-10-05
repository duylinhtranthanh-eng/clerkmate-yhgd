/**
 * Serves `dist/` the way the deployment serves it.
 *
 * The browser suites used to run behind a plain static server with no headers,
 * which meant they were testing a more permissive environment than the one the
 * app actually ships into. That gap hid a real failure: the on-device slip
 * recogniser starts its worker from a `blob:` URL and compiles WebAssembly, and
 * the production `Content-Security-Policy` forbade both. The feature worked in
 * every test and would have been dead on the deployed site.
 *
 * So the headers are read out of `netlify.toml` rather than written again here.
 * If the policy changes, this follows; if it drifts, the suites notice.
 *
 *     node scripts/serve-dist.mjs [dist] [port] [base-path]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const DIST = resolve(process.argv[2] || 'dist')
const PORT = Number(process.argv[3] || 4191)
/** Matches GitHub Pages, where the app lives under the repository name. */
const PREFIX = process.argv[4] || '/clerkmate-yhgd'

/** The headers the deployment sets, taken from the file that sets them. */
function headersFromNetlifyToml() {
  const toml = readFileSync(resolve('netlify.toml'), 'utf8')
  const out = {}
  for (const line of toml.split('\n')) {
    const m = line.match(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/)
    if (!m) continue
    const [, name, value] = m
    if (/^(Content-Security-Policy|X-[A-Za-z-]+|Referrer-Policy|Permissions-Policy)$/.test(name)) {
      out[name] = value
    }
  }
  if (!out['Content-Security-Policy']) {
    throw new Error('serve-dist: no Content-Security-Policy found in netlify.toml')
  }
  return out
}

const HEADERS = headersFromNetlifyToml()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
  '.pdf': 'application/pdf',
}

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0])
  if (!path.startsWith(PREFIX)) {
    res.writeHead(404, HEADERS)
    return res.end('outside the base path')
  }
  path = path.slice(PREFIX.length) || '/'
  // A hash router means every real path is a file; anything extensionless is
  // the shell.
  if (path.endsWith('/') || !extname(path)) path = '/index.html'

  try {
    const body = await readFile(join(DIST, path))
    res.writeHead(200, {
      ...HEADERS,
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404, HEADERS)
    res.end('not found')
  }
}).listen(PORT, () => {
  console.log(`serving ${DIST} at http://localhost:${PORT}${PREFIX}/ with the deployment's headers`)
})
