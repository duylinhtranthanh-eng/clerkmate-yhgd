/**
 * Reading the text off a photographed result slip, on the device.
 *
 * Why this exists: the alternative to typing lab values in by hand used to be
 * photographing the slip, and a photograph of a slip carries the patient's name,
 * their record number and often their address, printed across the top. The app
 * answered that with a redaction tool — paint boxes over the identifiers, burn
 * them into the pixels. That works, but it asks a learner standing in a clinic
 * to spot every identifier on a page, and a missed one is invisible until it is
 * already in a PDF someone else is holding.
 *
 * Reading the slip into text changes the shape of that problem. Text can be
 * read, checked and deleted a line at a time, and once the numbers are in the
 * record the photograph does not have to be kept at all. It does not make the
 * identifiers disappear — they are printed on the slip, so they are in the
 * extracted text too — but it turns "find every name in an image" into "delete
 * these two lines", which is a task a person can actually finish.
 *
 * Everything here runs in the browser. The worker, the WebAssembly core and the
 * Vietnamese language data are served from this app's own origin (see
 * `scripts/sync-ocr-assets.mjs`), not from a CDN, so using the feature does not
 * put the photograph — or the fact that one was taken — in front of anyone else.
 */

/** A line as the recogniser read it. */
export interface OcrLine {
  text: string
  /** 0–100, as Tesseract reports it. Low lines are shown but not trusted. */
  confidence: number
}

export interface OcrOutcome {
  lines: OcrLine[]
  /** How long recognition took, in ms. Shown so slow devices explain themselves. */
  elapsedMs: number
}

export type OcrProgress = (stage: string, fraction: number) => void

/**
 * Where the self-hosted runtime lives, as an absolute URL.
 *
 * It has to be absolute. The app is built with `base: './'` so it can be served
 * from a repository subpath, which makes `BASE_URL` a relative string — and a
 * relative specifier in a dynamic import resolves against the importing chunk,
 * not against the page. That quietly asked for `assets/ocr/…` instead of
 * `ocr/…`, and the first browser run of the recogniser died on a 404. Resolving
 * against `document.baseURI` gives the same answer wherever the app is hosted.
 */
const assetBase = (): string =>
  new URL(`${import.meta.env.BASE_URL || './'}ocr/`, document.baseURI).href

interface TesseractLine {
  text: string
  confidence: number
}

interface TesseractWorkerLike {
  recognize(
    image: Blob,
    options: Record<string, unknown>,
    output: Record<string, boolean>,
  ): Promise<{
    data: {
      text: string
      blocks?: { paragraphs?: { lines?: TesseractLine[] }[] }[]
    }
  }>
  terminate(): Promise<void>
}

interface TesseractModuleLike {
  createWorker(
    lang: string,
    oem: number,
    options: Record<string, unknown>,
  ): Promise<TesseractWorkerLike>
}

/**
 * The worker is expensive to start and cheap to keep, so it is started once.
 *
 * It is deliberately not torn down between images: a learner photographing four
 * result slips in a row should pay the three-megabyte download and the
 * WebAssembly start-up once, not four times.
 */
let workerPromise: Promise<TesseractWorkerLike> | null = null

async function getWorker(onProgress?: OcrProgress): Promise<TesseractWorkerLike> {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    // Imported by URL rather than by package name so the recogniser never
    // enters the main bundle: a learner who only ever types results in should
    // not download, or have the service worker precache, a megabyte of OCR.
    // The ESM build exposes the library as a default export and nothing else.
    const mod = ((await import(/* @vite-ignore */ `${assetBase()}tesseract.esm.min.js`)) as
      { default: TesseractModuleLike }).default
    const base = assetBase()
    return mod.createWorker('vie', 1, {
      workerPath: `${base}worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (onProgress && typeof m.progress === 'number') {
          onProgress(m.status ?? '', m.progress)
        }
      },
    })
  })()
  try {
    return await workerPromise
  } catch (e) {
    // A failed start must not poison every later attempt — a learner who loses
    // signal mid-download should be able to simply try again.
    workerPromise = null
    throw e
  }
}

/**
 * How many screens currently want the recogniser alive.
 *
 * The worker costs a few hundred megabytes of WebAssembly heap, which is real
 * money on the phone this app is built for, but tearing it down after every
 * photograph would make a learner with four slips pay the start-up four times.
 * So it is reference counted: it survives while any sheet that might use it is
 * mounted, and goes away when the last one does.
 *
 * Counted rather than released by whoever closes first, because the
 * investigations screen can have several sheets mounted at once — one for the
 * general import, one per photographed result — and the first of them to
 * unmount must not terminate a worker another one is mid-recognition on.
 */
let holders = 0

/** Registers interest in the recogniser. Returns the matching release. */
export function retainOcr(): () => void {
  holders += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holders -= 1
    if (holders <= 0) void releaseOcr()
  }
}

/** Frees the worker and the memory it holds. */
export async function releaseOcr(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  try {
    await (await pending).terminate()
  } catch {
    // Nothing to do: the worker is being discarded either way.
  }
}

/** Whether this browser can run the recogniser at all. */
export function ocrAvailable(): boolean {
  return typeof WebAssembly === 'object' && typeof Worker === 'function'
}

/**
 * Reads an image and returns its lines.
 *
 * Blank lines and pure punctuation are dropped — Tesseract emits a lot of both
 * on a photograph of a printed form, and they are noise in a list a person has
 * to read through.
 */
export async function recognizeImage(image: Blob, onProgress?: OcrProgress): Promise<OcrOutcome> {
  if (!ocrAvailable()) throw new Error('Trình duyệt này không chạy được nhận dạng chữ.')
  const started = performance.now()
  const worker = await getWorker(onProgress)
  // `blocks` has to be asked for: without it the result carries the page text
  // and nothing else, and the per-line confidence that tells a learner which
  // rows to look at twice is simply absent.
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true })

  const fromBlocks = (data.blocks ?? []).flatMap((b) =>
    (b.paragraphs ?? []).flatMap((p) => p.lines ?? []),
  )
  const raw = fromBlocks.length
    ? fromBlocks.map((l) => ({ text: l.text ?? '', confidence: Math.round(l.confidence ?? 0) }))
    : String(data.text ?? '')
        .split('\n')
        .map((text) => ({ text, confidence: 0 }))

  const lines = raw
    .map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), confidence: l.confidence }))
    .filter((l) => /[0-9A-Za-zÀ-ỹ]/.test(l.text))

  return { lines, elapsedMs: Math.round(performance.now() - started) }
}
