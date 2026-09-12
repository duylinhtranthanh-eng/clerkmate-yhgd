# ClerkMate — Final Submission Verification

**Verified:** 12 September 2026, 18:15 (GMT+7)
**Commit:** `22af5f0`
**Method:** every number below comes from a run on this date against the production build. Nothing
here is quoted from an earlier run or inferred from source.

---

## 1. Where it lives

| | |
|---|---|
| Repository | https://github.com/duylinhtranthanh-eng/clerkmate-yhgd |
| Live app (primary) | https://duylinhtranthanh-eng.github.io/clerkmate-yhgd/ |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main` |
| Netlify | An earlier deployment exists but is **not** the submission target and was not redeployed |

**The live bundle was compared against the local build**, not assumed: the page served from Pages
references `assets/index-DvoILeLZ.js`, byte-identical in name to the file produced by `npm run build`
on this machine. What a judge opens is what passed the checks below.

The deployment workflow runs `npm ci → npm test → npm run build → deploy`. A failing audit therefore
does not deploy: the URL keeps the previous good build rather than serving a broken one.

## 2. Test results on this commit

| Suite | Command | Result |
|---|---|---|
| Rule audit | `npm test` | **96 / 96** |
| End-to-end, real Chrome | `npm run verify:app` | **104 / 104** |
| Quick Capture | `npm run verify:capture` | **29 / 29** |
| Print and PDF | `npm run verify:print` | **49 / 49** |
| Local learner profiles | `npm run verify:profiles` | **14 / 14** |

**292 checks, all passing.** The last four drive a real Chrome over the DevTools Protocol against
the built site served from a repository subpath — the same shape as GitHub Pages — not a test
renderer or a mock.

One thing worth saying about the audit itself: its runner used to call check bodies without awaiting
them, so every asynchronous check printed a tick and then failed *after* the summary. It was found
while adding the Quick Capture scenarios — five of them were reporting green while actually failing.
The runner now has a separate awaited form, and the twelve capture checks are real.

What the suites actually prove, rather than merely exercise:

- **Offline is asserted by taking the server away.** The local run kills the HTTP server, reloads,
  and requires every response for the app's own URLs to carry `fromServiceWorker`. Counting requests
  would not have distinguished cache from network; this does.
- **The submission lock is swept, not sampled.** Every input, chip and button on 18 section editors
  and 4 tabs is driven against a locked record — several hundred attempts — and the stored record is
  compared byte for byte afterwards.
- **Redaction is verified in the pixels.** The covered band of the stored image is sampled at full
  resolution and must be 100 % black, and the original bytes must be gone from the blob store rather
  than kept alongside.
- **The printed form is compared against the department's scan by eye**, page by page, not only
  asserted against the DOM. Four official pages render on four sheets.

## 3. Privacy, verified

| Claim | How it was checked |
|---|---|
| No case data leaves the device | Every network request during the whole end-to-end run was captured; the list of off-origin requests is empty |
| Nothing is logged | Console captured for the run; no patient or learner data appears, and there are no errors |
| An un-sanitized image cannot be printed | The demo ships a deliberately un-redacted lab slip; before sanitising, the printed document contains **zero** images and the list says the image was withheld |
| The printed image is the derivative | The image on paper is a `blob:` URL at 760×560 — the sanitized copy — not the 320 px list thumbnail |
| Redaction is destructive | Stored blob replaced in place; pixel-sampled |
| A declared face blocks the image | Unit-checked: a clinical photo with a face is refused even when a derivative exists |
| Deleting removes both copies | Working image and derivative are both deleted with the case |

`src/workflow/privacy.ts` is the only place that decides what may leave the device, and it **fails
closed**: a record too old to carry the field, or malformed for any other reason, exports nothing.

## 4. How a record gets written

**Capture, then confirm.** At the bedside the learner types shorthand or holds a button and talks;
each fragment is stored, structured into suggestions that quote the text they came from, and nothing
reaches the record until the learner ticks it. Afterwards a panel says which fields are still empty
at their level and gives a plain question for each.

| | |
|---|---|
| Capture modes | typed shorthand · push-to-talk dictation |
| Structuring targets | **40**, including all eight SOCRATES elements |
| Targets reaching diagnosis, management or investigations | **none** — swept by a check |
| Provenance | every suggestion quotes text that must occur in the fragment |
| Negation | "không / ko / k / chưa" produce explicit negatives; silence produces nothing |
| Conflicts | shown with both values, never preselected, never auto-resolved |

Dictation uses the browser's own recogniser — no dependency, no model, no endpoint. **The audio does
leave the device**: Chrome sends it to Google, Safari to Apple. The app says exactly that, naming the
vendor, before the microphone is opened for the first time, and Firefox is told plainly that it has
no recogniser.

## 5. What the learner hands in

**A PDF.** Preview → *Xuất PDF* → send it to faculty over email, Zalo, an LMS or Drive. Faculty
install nothing and hold no account; the product delivers its value without requiring their adoption.

Two exports exist:

1. **Bệnh án theo mẫu Bộ môn** (default) — the teaching clinic's own four-page paper form, filled in:
   masthead and administrative block, the seven vitals columns, history against red flags and ICE, the
   seventeen-row problem table beside the family-history table, the organ systems, the follow-up sheet,
   the genogram page and the screening schedule. Verified page by page against
   `docs/reference/mau-benh-an-yhgd.pdf`.
2. **Bản học tập ClerkMate** — the same data laid out for teaching. Self-assessment and the
   completeness picture have no cell on the department's form.

A portable `.json` exists for backup, device-to-device transfer and technical audit. It is **not** the
submission route and the app says so.

## 6. Honest limitations

These are things the app cannot do, stated so that no one discovers them during judging.

- **The app cannot share the PDF file itself.** Export goes through the browser's print pipeline,
  which hands the file to the operating system and never to the page, so there is no Blob to pass to
  `navigator.share`. `canShareFile()` returns `false` with that reason recorded in the source.
- **`mailto:` cannot attach a local file** in any browser. The email button is therefore labelled
  *"Mở email đã soạn sẵn lời nhắn"*, and the body tells the learner to attach the PDF themselves.
- **Local profiles are separation, not authentication.** Anyone holding the device can switch
  profiles. The app says this in the profile screen rather than implying accounts exist.
- **The declared learner level is self-reported.** There are no accounts, so it cannot be enforced —
  only made visible, which the printed record does.
- **Offline could be asserted locally but only reported remotely.** A deployed host cannot be switched
  off, and page-level offline emulation does not reach a service worker's own fetches.
- **Two fields of the paper form have no counterpart in the record** (*Vú*, and the follow-up sheet's
  repeat vitals); they print as empty cells rather than being filled with something invented.
- **Dictation is not on-device** and needs a network. Firefox has no recogniser at all. Typed capture
  works offline in every browser, and a failed transcription never loses the fragment.
- **Suggestions are not persisted.** They live in the review sheet; closing it means structuring the
  fragment again, which costs a tap and no data.
- **The gap panel prompts for fields, not for clinical thinking.** It cannot tell a learner what to
  suspect, and is not meant to.

## 7. Scale

| | |
|---|---|
| Source | 79 TypeScript/TSX files, ~20,000 lines |
| Runtime dependencies | **2** — `react`, `react-dom` |
| Build output | 9 static files, 595 KB of JavaScript |
| Completeness catalogue | 66 requirements, mapped per level with inheritance |
| Risk catalogue | 9 domains, **57** factor definitions |
| Processing states | 8, five of them derived from the record's own content |
| Mandatory items by level | Y2 8 · Y5 22 · Y6 34 · SDH 54 |

## 8. Reproducing this

```bash
npm ci
npm test
npm run build
npx serve dist        # or any static server at a /clerkmate-yhgd/ subpath on :4191
npm run verify:app
npm run verify:capture
npm run verify:print
npm run verify:profiles
```

The four browser suites need Google Chrome at the standard macOS path and a static server on
`http://localhost:4191/clerkmate-yhgd/`. `VERIFY_BASE=<url> npm run verify:app` points the same suite
at the deployed site.

## 9. Status

**READY FOR SUBMISSION.** 292 checks passing on commit `22af5f0`, deployed, and the live bundle
confirmed identical to the verified build.
