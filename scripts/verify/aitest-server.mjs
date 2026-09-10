/**
 * Serves the production build and mounts the real Netlify function handler at
 * its real path, so the browser exercises the shipped client code against the
 * shipped proxy code. Only the provider behind it is a stub.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const FN = '/.netlify/functions/ai-structure-note'
const handler = (await import('../../netlify/functions/ai-structure-note.mjs')).default

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:4180')
  if (url.pathname === FN) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const request = new Request('http://localhost' + req.url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    })
    const out = await handler(request)
    res.writeHead(out.status, Object.fromEntries(out.headers))
    res.end(Buffer.from(await out.arrayBuffer()))
    return
  }
  const rel = url.pathname === '/' ? '/index.html' : url.pathname
  const file = join(process.cwd(), 'dist', normalize(rel).replace(/^(\.\.[/\\])+/, ''))
  try {
    const buf = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(buf)
  } catch {
    const buf = await readFile(join(process.cwd(), 'dist', 'index.html'))
    res.writeHead(200, { 'content-type': TYPES['.html'] })
    res.end(buf)
  }
}).listen(4180, () => console.log('app + function on :4180'))
