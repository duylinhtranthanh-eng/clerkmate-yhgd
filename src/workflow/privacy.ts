import type { Attachment, CaseRecord } from '../types/case'

/**
 * The one boundary every image has to cross before it can leave the phone.
 *
 * Locally an attachment may still be the untouched file the learner picked —
 * that is the working copy, and it stays on the device. What travels (the PDF,
 * the submission bundle, any future upload) may only ever be the *derivative*:
 * either the redacted image, or a canvas re-encode produced when the learner
 * declared the image carries no identifiers. Both are written under
 * `sanitizedBlobKey`, and both are re-encodes, so EXIF and GPS have nowhere to
 * survive. An empty `sanitizedBlobKey` therefore means exactly one thing: no
 * derivative exists yet, so nothing may be exported.
 */
export function hasDerivative(a: Attachment): boolean {
  // Fails closed: a record old enough to predate the field, or malformed for
  // any other reason, has no derivative and so exports nothing.
  return typeof a.sanitizedBlobKey === 'string' && a.sanitizedBlobKey.trim().length > 0
}

/**
 * A declared face has no remedy inside the app. Blurring or painting over it
 * still leaves a photograph of a person that was taken and stored, so the
 * image is withheld rather than filtered.
 */
export function faceDeclaredPresent(a: Attachment): boolean {
  return a.category === 'clinical_photo' && a.faceCheck === 'present'
}

/** A clinical photo that has not answered the face question yet. */
export function faceUnanswered(a: Attachment): boolean {
  return a.category === 'clinical_photo' && a.faceCheck === ''
}

export function isSubmissionSafe(a: Attachment): boolean {
  return hasDerivative(a) && !faceDeclaredPresent(a) && !faceUnanswered(a)
}

/**
 * Defence in depth for the export paths. Submitting is already gated on every
 * attachment being safe, but a bundle is a file that leaves the device, so it
 * is built from a record where anything unsafe has lost its image data —
 * the entry survives so the reviewer can see an image was withheld and why.
 */
export function withExportSafeAttachments(record: CaseRecord): CaseRecord {
  if (record.attachments.every(isSubmissionSafe)) return record
  return {
    ...record,
    attachments: record.attachments.map((a) =>
      isSubmissionSafe(a) ? a : { ...a, thumbnail: '', blobKey: '', sanitizedBlobKey: '' },
    ),
  }
}
