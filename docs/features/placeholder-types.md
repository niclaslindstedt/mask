# Placeholders that carry the role, not just the slot

`NAME1` tells a language model that something was masked. `JUDGE1` tells it
_who_ — and an answer that reasons about the judge, the plaintiff and the car
is a better answer than one juggling three interchangeable names.

Every kind picker in the app — in a review, on the Placeholders tab, in the
rules — now ends in **Custom type…**. Choose it, type a name, and that value
is masked under it: "Judge" becomes `JUDGE1`, `JUDGE2`, and so on, counted
separately from every other type. A name typed this way belongs to that value
alone; nothing else has to be set up first.

For the words you reach for again and again, **Settings → Masking →
Placeholder types** keeps a list. A type added there is offered in every
picker, and each one shows the placeholders it will produce so there are no
surprises. New types land where **New types apply to** says: _This workspace_,
so a case load's own vocabulary stays with it and doesn't follow you when you
switch, or _Every workspace_. The picker on a type's row moves it between the
two at any time.

Re-typing a placeholder renames it when the app was the one that named it — a
value moved from Name to Judge goes from `NAME1` to `JUDGE1`. A placeholder you
typed by hand keeps the name you gave it.
