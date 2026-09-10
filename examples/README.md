# Examples

Fictional Swedish documents to try the app on. Every name, number and address
in them is invented; the identity and organisation numbers merely pass the
Luhn check.

- [`sample-letter.txt`](sample-letter.txt) — a building-permit letter carrying
  every kind of value the detectors know: names, a personal identity number,
  street addresses, postal codes with localities, phone numbers in national and
  `+46` form, an e-mail address, and an organisation number.
- [`sample-case-note.txt`](sample-case-note.txt) — a social-services journal
  note: two identity numbers, a mobile and two landline numbers, an e-mail
  address, and a supplier's organisation number.
- [`sample-school-letter.txt`](sample-school-letter.txt) — a school decision
  addressed to two guardians, sharing a person and a locality with the case
  note.
- [`sample-procurement-email.txt`](sample-procurement-email.txt) — a two-turn
  procurement e-mail thread: addresses in `From:` / `To:` headers, two
  organisation numbers, and no identity numbers at all.

To try one: create a project, drop the file onto the intake (or press **Paste
text** and paste its contents), review what the detectors found, confirm, and
copy the masked text. Paste any answer that mentions the placeholders into the
**Restore** tab to see them turn back into the original values.

These same files back the developer **Test data** toggle (Settings →
Developer), which opens the app on sample projects already holding them — see
[`src/app/dev/`](../src/app/dev/). They double as the masking smoke-test
fixtures (`tests/testData_test.ts`).
