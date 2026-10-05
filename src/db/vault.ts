/**
 * At-rest encryption for the records on this device.
 *
 * What this is for: a shared clinic phone or a library browser, where the thing
 * that protects the records today is only that nobody thought to look. A
 * passcode that merely hides the interface would not help — IndexedDB is one
 * devtools panel away — so this encrypts the stored bytes instead, and the key
 * exists only while the learner is using the app.
 *
 * What it is not: authentication. There is no server, nobody is identified, and
 * a password typed here proves nothing about who is holding the phone. It makes
 * the data unreadable without that password, and that is the whole claim.
 *
 * The cost is stated plainly wherever it is switched on: there is no server to
 * reset anything, so a forgotten password means the records are gone. That is
 * what encryption without an account means, and pretending otherwise would be
 * worse than not offering it.
 */

const ITERATIONS = 310_000 // OWASP's 2023 floor for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16
const IV_BYTES = 12

/** Ciphertext as it is stored: self-describing, so a reader can tell it apart. */
export interface Sealed {
  __sealed: 1
  /** Base64 initialisation vector, unique per record. */
  iv: string
  /** Base64 ciphertext. */
  data: string
}

export function isSealed(value: unknown): value is Sealed {
  return !!value && typeof value === 'object' && (value as Sealed).__sealed === 1
}

const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

export function randomSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer)
}

/**
 * Turns a password into a key.
 *
 * Deliberately slow: the iteration count is what stands between a four-word
 * password and someone with the device and a word list.
 */
export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function seal(key: CryptoKey, bytes: ArrayBuffer): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)
  return { __sealed: 1, iv: toB64(iv.buffer), data: toB64(data) }
}

async function open(key: CryptoKey, sealed: Sealed): Promise<ArrayBuffer> {
  // AES-GCM authenticates as well as encrypts: a wrong key, or a single altered
  // byte, throws here rather than returning plausible rubbish.
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data))
}

export async function sealJson(key: CryptoKey, value: unknown): Promise<Sealed> {
  return seal(key, enc.encode(JSON.stringify(value)).buffer as ArrayBuffer)
}

export async function openJson<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  return JSON.parse(dec.decode(await open(key, sealed))) as T
}

export async function sealBlob(key: CryptoKey, blob: Blob): Promise<Sealed> {
  const sealedBytes = await seal(key, await blob.arrayBuffer())
  // The media type travels with the bytes, or a decrypted image comes back as
  // an untyped blob and no longer renders.
  return { ...sealedBytes, data: `${blob.type || 'image/jpeg'}|${sealedBytes.data}` }
}

export async function openBlob(key: CryptoKey, sealed: Sealed): Promise<Blob> {
  const at = sealed.data.indexOf('|')
  const type = at > 0 ? sealed.data.slice(0, at) : 'image/jpeg'
  const body = at > 0 ? sealed.data.slice(at + 1) : sealed.data
  const bytes = await open(key, { ...sealed, data: body })
  return new Blob([bytes], { type })
}

/**
 * A token proving a password is the right one, without storing the password.
 *
 * Decrypting it is the only check performed on unlock: if it opens, the key is
 * right, and if it does not, nothing else is touched.
 */
const CHECK_PLAINTEXT = 'clerkmate-vault-v1'

export async function makeCheck(key: CryptoKey): Promise<Sealed> {
  return sealJson(key, CHECK_PLAINTEXT)
}

export async function verifyCheck(key: CryptoKey, check: Sealed): Promise<boolean> {
  try {
    return (await openJson<string>(key, check)) === CHECK_PLAINTEXT
  } catch {
    return false
  }
}

/** Whether this browser can do any of the above at all. */
export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}
