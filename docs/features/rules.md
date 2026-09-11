# Rules that carry everywhere

Some values are sensitive in every project — a client's name that no detector
would recognise — and some never are — the agency you work at, a product name
the detectors keep mistaking for a person. The **Rules** screen, reached from
the side menu, keeps both lists, and they apply across every workspace and
project.

The **blacklist** takes a value and the kind of thing it is; it is masked
wherever it appears, whether or not a detector finds it. The **whitelist**
takes a value the detectors get wrong; it is left alone even when one flags it.
**Custom patterns** are regular expressions of your own — a case-number format,
a licence plate, a customer id — with the kind their matches carry. Try a
pattern against a sample text right in the form before you add it.

Neither list is only reachable from that screen. Every row in a document's
review carries a blacklist and a whitelist button beside its type picker, so
the moment you spot a value the detectors will keep getting wrong you can
settle it for good without leaving the review. A value belongs to one list at
a time: listing it leaves just the button that takes it back off.
