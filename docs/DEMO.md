# Walkthrough

About ten minutes, one device, no account. All data are fictional.

1. **Open the app.** Fill in the first-run learner profile — name, student ID, level. This is a
   label printed on the exported record, not a login: no password, nothing verified, nothing sent.
   Anything works, e.g. *Ban Giám khảo / BGK01 / SDH*.

2. **Seed a fictional case.** *Dùng thử ca mẫu* → **Bà H., 58 tuổi — đau khớp gối**. The app also
   draws a simulated lab slip for it, deliberately left un-redacted so the redaction tool can be
   tried. (The second case, *Ông T., 74 tuổi*, is the multimorbid one.)

3. **Case list.** Note the level badge, the processing-state badge and the completeness bar.

4. **Quick note** (tab *Ghi nhanh*). Press *Chèn ví dụ mẫu*, then *Sắp xếp vào bệnh án*. Each
   suggestion shows the record field, the proposed value and **the phrase from the note it came
   from**. Items already in the record are marked *đã có*. Nothing is written until *Đưa N mục vào
   bệnh án*.

5. **Structured record** (tab *Bệnh án*). 18 sections, each badged *đủ* / *thiếu N* / *N/M*.

6. **Completeness** (tab *Hoàn chỉnh*). The percentage, the three tiers, and the missing items —
   each one taps through to the section that fixes it. Then use *Xem thử mức khác* to switch the
   **view** between Y2 / Y5 / Y6 / SDH and watch the requirement set change without altering the
   case.

7. **Genogram** (tab *Phả hệ*). Edit a member's age or add a condition and the drawing updates.
   Read the per-condition hatch legend, and the life-cycle suggestion, which states its reasoning
   and must be accepted before it is written.

8. **Risk review** (*Bệnh án* → *Yếu tố nguy cơ*). Domain 1 (emergency) keeps its full checklist at
   every level. At SDH, domain 3 has no checklist at all — the learner lists risks from memory and
   presses *Chốt danh sách* before the catalogue appears as a comparison. Domain 5 has the graded
   falls assessment, with *Mức này được xếp thế nào?* printing the banding rule. The cardiovascular
   block is deliberately empty: the app does not calculate the risk.

9. **Attachments and redaction** (*Bệnh án* → *Hình ảnh đính kèm*). The slip carries a red
   *chưa che* tag. Open it → *Che thông tin trên ảnh* → drag a box, move it, resize it from a
   corner → *Áp dụng*. Re-open the image: the covered area is gone from the image itself, not
   hidden under an overlay.

10. **Export** (tab *Xem trước*) → *Xuất PDF* → Save as PDF. In the file: the numbered sections, the
    learner's identity, the vector genogram, the per-page level watermark and the level stamp.

11. **Submit.** On the *Nộp bài* card: with an un-redacted image the button is disabled and names
    what is missing; once clean, *Nộp bài và khoá sửa* mints a submission code, locks the record and
    downloads a `.json`. Try editing any field afterwards — the value snaps back with an explanation.

12. **Grade it.** Home → *Chấm bài (dành cho giảng viên)* → open the `.json` just downloaded. The
    learner's identity, completeness and the read-only record are shown. Type a name and a comment →
    *Trả lại để bổ sung* → a second file downloads. Then Home → *Mở tệp giảng viên gửi về* → choose
    that file: the case is badged *Trả lại để bổ sung*, the comment appears verbatim, and the record
    unlocks.

13. **Offline** (optional). Install to the home screen, turn on airplane mode, reopen. The app
    starts and cases can still be created and edited.

## Things worth noticing

- Every structuring suggestion quotes the note. Nothing is written without a tap.
- *Chưa khám* is a third examination state and is never treated as normal.
- Past history has one-tap *"asked, nothing there"* switches, so a blank field and a documented
  negative are different things.
- The exported record prints the risks the learner listed **from memory** alongside how much help
  the app gave, so a teacher can see unassisted reasoning rather than only the finished chart.
