#!/usr/bin/env node
// Build the detector dictionaries under src/app/detectors/data/ from public
// sources, so the name and locality lists are real data rather than a guess:
//
//   given names + surnames  SCB's "Samtliga folkbokförda … med minst två
//                           bärare" (population register, 31 Dec 2020), as
//                           re-published in CSV by peterdalle/svensktext.
//   localities              klintan/swedish-gazetteers `swedish-cities.csv`
//                           (Swedish tätorter, roughly by population; CC BY 4.0).
//   word filter             the LibreOffice Swedish spelling dictionary (DSSO,
//                           LGPL 3) — used only here, at build time, to tell
//                           which names are also everyday words ("Berg",
//                           "Liv", "Maj"), so the detector never anchors on
//                           one of those alone.
//
// Sources download into .cache/dictionaries/ (gitignored) on first run; the
// generated .ts files are committed. Re-run with `make dictionaries` (or
// `npm run dictionaries`) after changing a threshold or a manual list below.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cache = join(root, ".cache", "dictionaries");
const out = join(root, "src", "app", "detectors", "data");
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const SOURCES = {
  women:
    "https://raw.githubusercontent.com/peterdalle/svensktext/master/namn/tilltalsnamn-kvinnor.csv",
  men: "https://raw.githubusercontent.com/peterdalle/svensktext/master/namn/tilltalsnamn-man.csv",
  surnames:
    "https://raw.githubusercontent.com/peterdalle/svensktext/master/namn/efternamn.csv",
  localities:
    "https://raw.githubusercontent.com/klintan/swedish-gazetteers/master/swedish-cities.csv",
  words:
    "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/sv_SE/dictionaries/sv_SE.dic",
};

// Minimum number of bearers for a name to make the list. 100 keeps ~90% of
// the population's given names and ~68% of surnames (the -sson / -berg
// ending rule in surnames.ts catches most of the rest) at ~100 KB of data.
const MIN_BEARERS = 100;
// Localities: this many of the largest are kept even when their name is an
// everyday word ("Lund"); smaller word-like ones are dropped.
const LOCALITY_WORDLIKE_KEEP = 300;

// Names the spelling dictionary does not list as words but that still read
// as one in running text (the possessive "hans", the god "Tor", "Love", the
// imperative "Finn") — plus particles that appear in surnames.
const EXTRA_WORDLIKE = new Set([
  "hans",
  "tor",
  "love",
  "finn",
  "von",
  "de",
  "van",
  "der",
  "al",
  "el",
  "bin",
  "ben",
  "abu",
  "mac",
  "vi",
  "ni",
  "man",
  "min",
  "din",
  "sin",
  "var",
  "har",
  "ung",
  "stor",
  "lilla",
  "unge",
  "true",
  "bella",
  "sol",
  "mars",
  "juni",
  "juli",
  "april",
  "may",
  "lo",
  "my",
  "hen",
  "sam",
  "max",
  "mona",
  "nova",
]);

async function fetchCached(name, url) {
  const file = join(cache, `${name}.txt`);
  if (!existsSync(file)) {
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, "utf8");
}

function parseCounts(csv) {
  const rows = [];
  for (const line of csv.split("\n").slice(1)) {
    const at = line.lastIndexOf(",");
    if (at < 0) continue;
    const name = line.slice(0, at).trim();
    const n = Number(line.slice(at + 1));
    if (name && Number.isFinite(n)) rows.push([name, n]);
  }
  return rows;
}

// The hunspell .dic: one "word/FLAGS" per line; keep the lower-case stems.
function parseWords(dic) {
  const words = new Set();
  for (const line of dic.split("\n").slice(1)) {
    const stem = line.split("/")[0].trim();
    if (stem && /^[a-zåäöéü]+$/u.test(stem)) words.add(stem);
  }
  return words;
}

const isWordLike = (words, name) => {
  const lower = name.toLowerCase();
  return words.has(lower) || EXTRA_WORDLIKE.has(lower);
};

// A surname that ends the way Swedish surnames do reads as a name even when
// the spelling dictionary happens to list it ("Bergström", "Backman").
const SURNAME_ENDINGS = [
  "sson",
  "son",
  "berg",
  "ström",
  "lund",
  "gren",
  "qvist",
  "kvist",
  "quist",
  "man",
  "dahl",
  "holm",
  "stedt",
  "feldt",
  "vall",
  "hammar",
  "bäck",
  "blad",
  "löv",
  "sjö",
  "mark",
  "borg",
];
const surnameShaped = (name) => {
  const lower = name.toLowerCase();
  return SURNAME_ENDINGS.some(
    (e) => lower.endsWith(e) && lower.length - e.length >= 3,
  );
};

const singleWord = (name) => /^[\p{L}]+(?:-[\p{L}]+)?$/u.test(name);

function titleCase(name) {
  return name
    .split(/(\s|-)/)
    .map((part) =>
      /^[\p{L}]/u.test(part) ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join("");
}

function emit(file, header, entries) {
  const names = [...entries].sort((a, b) => a.localeCompare(b, "sv"));
  const body = names.map((n) => `  "${n}",`).join("\n");
  writeFileSync(
    join(out, file),
    `// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0\n// GENERATED by scripts/dictionaries/build.mjs — do not edit by hand.\n// oss-spec:allow-large-file: generated dictionary data, one entry per line\n${header}\nexport default [\n${body}\n] as const;\n`,
  );
  console.log(`${file}: ${names.length} entries`);
}

const words = parseWords(await fetchCached("words", SOURCES.words));

const given = new Set();
const givenWordLike = new Set();
for (const key of ["women", "men"]) {
  for (const [name, n] of parseCounts(await fetchCached(key, SOURCES[key]))) {
    if (n < MIN_BEARERS || !singleWord(name)) continue;
    (isWordLike(words, name) ? givenWordLike : given).add(name);
  }
}
for (const n of givenWordLike) given.delete(n);

const surnames = new Set();
const surnamesWordLike = new Set();
for (const [name, n] of parseCounts(
  await fetchCached("surnames", SOURCES.surnames),
)) {
  if (n < MIN_BEARERS || !singleWord(name)) continue;
  const wordLike = isWordLike(words, name) && !surnameShaped(name);
  (wordLike ? surnamesWordLike : surnames).add(name);
}

const localities = new Set();
const localitiesWordLike = new Set();
const seen = new Set();
let rank = 0;
for (const raw of (await fetchCached("localities", SOURCES.localities)).split(
  "\n",
)) {
  const name = titleCase(raw.trim());
  if (!name || seen.has(name)) continue;
  seen.add(name);
  rank++;
  const wordLike = name.split(/[\s-]/).every((part) => isWordLike(words, part));
  if (!wordLike) localities.add(name);
  else if (rank <= LOCALITY_WORDLIKE_KEEP) localitiesWordLike.add(name);
}

emit(
  "givenNames.ts",
  `// Given names (tilltalsnamn) with at least ${MIN_BEARERS} bearers in Sweden on\n// 31 Dec 2020 (SCB via peterdalle/svensktext), excluding names that are also\n// everyday Swedish words — see givenNamesWordLike.ts for those.`,
  given,
);
emit(
  "givenNamesWordLike.ts",
  `// Given names with at least ${MIN_BEARERS} bearers that are also everyday Swedish\n// words (per the DSSO spelling dictionary) — "Björn", "Liv", "Maj". A name\n// detector only trusts these when a surname follows.`,
  givenWordLike,
);
emit(
  "surnames.ts",
  `// Surnames with at least ${MIN_BEARERS} bearers in Sweden on 31 Dec 2020 (SCB via\n// peterdalle/svensktext), excluding names that are also everyday Swedish\n// words — see surnamesWordLike.ts for those.`,
  surnames,
);
emit(
  "surnamesWordLike.ts",
  `// Surnames with at least ${MIN_BEARERS} bearers that are also everyday Swedish\n// words — "Berg", "Lund", "Ek", "Strand". A name detector only trusts these\n// when a given name precedes them.`,
  surnamesWordLike,
);
emit(
  "localities.ts",
  `// Swedish localities (tätorter) from klintan/swedish-gazetteers (CC BY 4.0),\n// excluding names that are also everyday words — see localitiesWordLike.ts.`,
  localities,
);
emit(
  "localitiesWordLike.ts",
  `// The ${LOCALITY_WORDLIKE_KEEP} largest localities whose name is also an everyday\n// Swedish word ("Lund", "Bro", "Vara"); smaller ones are dropped. A detector\n// only trusts these mid-sentence, where an ordinary word is not capitalised.`,
  localitiesWordLike,
);
