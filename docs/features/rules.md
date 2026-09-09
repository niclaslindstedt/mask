# Rules that carry everywhere

Some values are sensitive in every project — a client's name that no detector
would recognise — and some never are — the agency you work at, a product name
the detectors keep mistaking for a person. The **Rules** screen, reached from
the side menu, keeps both lists, and they apply across every workspace and
project.

**Always mask** takes a value and the kind of thing it is; it is replaced with a
placeholder wherever it appears. **Never mask** takes a value the detectors get
wrong; it is left alone even when a detector flags it. **Custom patterns** are
regular expressions of your own — a case-number format, a licence plate, a
customer id — with the kind their matches carry. Try a pattern against a
sample text right in the form before you add it.
