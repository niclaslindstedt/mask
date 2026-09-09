// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { TextSpan } from "../../generic/textScan.ts";
import { dictionaries } from "./dictionaries.ts";
import { NOT_SURNAMES, surnameStrength } from "./surnames.ts";
import type { Detector } from "./types.ts";

// Personal names. There is no list of every person, so the detector anchors
// on two signals inside a run of capitalised words: a known given name (which
// then takes the capitalised words after it as the surname), or a word that
// reads as a surname (which then takes one capitalised word before it as the
// given name). A name that is also an everyday word — "Björn", "Berg", "Per"
// — is trusted mid-sentence, where Swedish capitalises nothing ordinary, and
// at the start of a sentence only when the other half of the name is there
// too. A trailing genitive `s` ("Annas") is recognised and left outside the
// span, so masking keeps the grammar intact.

// A run of one to four capitalised words on one line, single-spaced.
const RUN =
  /(?<![\p{L}\p{N}])[\p{Lu}][\p{L}]+(?:-[\p{Lu}][\p{L}]+)?(?:[ \t][\p{Lu}][\p{L}]+(?:-[\p{Lu}][\p{L}]+)?){0,3}(?![\p{L}\p{N}])/gu;

type Token = { text: string; start: number; end: number };

function tokenize(run: string, offset: number): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(run)) !== null) {
    out.push({
      text: m[0],
      start: offset + m.index,
      end: offset + m.index + m[0].length,
    });
  }
  return out;
}

type Strength = "strong" | "weak" | "none";

function givenStrength(token: string): Strength {
  const d = dictionaries();
  if (d.givenNames.has(token)) return "strong";
  if (d.givenNamesWordLike.has(token)) return "weak";
  return "none";
}

/** The given-name form and strength of a token ("Annas" → "Anna"). */
function givenName(token: string): { form: string; strength: Strength } | null {
  const direct = givenStrength(token);
  if (direct !== "none") return { form: token, strength: direct };
  if (token.endsWith("s")) {
    const base = token.slice(0, -1);
    const s = givenStrength(base);
    if (s !== "none") return { form: base, strength: s };
  }
  return null;
}

function surname(token: string): { form: string; strength: Strength } | null {
  const direct = surnameStrength(token);
  if (direct !== "none") return { form: token, strength: direct };
  if (token.endsWith("s")) {
    const base = token.slice(0, -1);
    const s = surnameStrength(base);
    if (s !== "none") return { form: base, strength: s };
  }
  return null;
}

const isStop = (token: string): boolean => NOT_SURNAMES.has(token);

/** Can this token extend a name that has already started? */
function continues(token: string): boolean {
  if (isStop(token)) return false;
  return /^[\p{Lu}][\p{L}]+(?:-[\p{Lu}][\p{L}]+)?$/u.test(token);
}

/** Is the word at `start` the first of its sentence (or line, or a label)?
 *  Only there can an everyday word be capitalised. */
export function sentenceInitial(text: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;
  if (i < 0) return true;
  return /[.!?:;\n\r"'“”‘’([\-–—•*]/.test(text[i]!);
}

export function scanNames(text: string): TextSpan[] {
  const out: TextSpan[] = [];
  let m: RegExpExecArray | null;
  RUN.lastIndex = 0;
  while ((m = RUN.exec(text)) !== null) {
    const tokens = tokenize(m[0], m.index);
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i]!;
      const given = givenName(tok.text);
      if (given) {
        // Given name first: extend over the capitalised words that follow.
        let j = i;
        let end = tok.start + given.form.length;
        let sawSurname = false;
        if (given.form.length === tok.text.length) {
          while (j + 1 < tokens.length && continues(tokens[j + 1]!.text)) {
            j++;
            const t = tokens[j]!;
            const sur = surname(t.text);
            if (sur) sawSurname = true;
            end = sur ? t.start + sur.form.length : t.end;
            if (sur && sur.form.length < t.text.length) break; // genitive ends it
          }
        }
        const trusted =
          given.strength === "strong" ||
          sawSurname ||
          j > i ||
          !sentenceInitial(text, tok.start);
        if (trusted) push(out, text, tok.start, end);
        i = j + 1;
        continue;
      }
      const sur = surname(tok.text);
      if (sur) {
        // Surname-looking word: take one capitalised word before it as the
        // given name when there is one that isn't a stop word.
        const prev = i > 0 ? tokens[i - 1] : undefined;
        const hasGiven = !!prev && continues(prev.text);
        const trusted =
          sur.strength === "strong" ||
          hasGiven ||
          !sentenceInitial(text, tok.start);
        if (trusted) {
          push(
            out,
            text,
            hasGiven ? prev.start : tok.start,
            tok.start + sur.form.length,
          );
        }
        i++;
        continue;
      }
      i++;
    }
  }
  return out;
}

function push(out: TextSpan[], text: string, start: number, end: number) {
  const value = text.slice(start, end);
  if (value.length < 2) return;
  out.push({ start, end, value, kind: "name", source: "name", priority: 2 });
}

export const nameDetector: Detector = {
  id: "name",
  kind: "name",
  priority: 2,
  scan: scanNames,
};
