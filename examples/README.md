# Examples

- [`sample-letter.txt`](sample-letter.txt) — a fictional Swedish building-permit
  letter carrying every kind of value the detectors know: names, a personal
  identity number, street addresses, postal codes with localities, phone
  numbers in national and `+46` form, an e-mail address, and an organisation
  number. The app's **Load a sample letter** button loads this exact file, so
  it doubles as the smoke-test fixture.

To try it: create a project, load the sample (or drop the file onto the
project), review what the detectors found, confirm, and copy the masked text.
Paste any answer that mentions the placeholders into the **Restore** tab to see
them turn back into the original values.

Every name, number and address in the sample is invented; the identity and
organisation numbers merely pass the Luhn check.
