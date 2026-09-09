import { beforeAll, describe, expect, it } from "vitest";

import {
  DETECTOR_BY_ID,
  isOrgNumber,
  normalizePhone,
  normalizePin,
} from "../src/app/detectors/index.ts";
import { loadDictionaries } from "../src/app/detectors/dictionaries.ts";
import { scanNames, sentenceInitial } from "../src/app/detectors/name.ts";
import { looksLikeSurname } from "../src/app/detectors/surnames.ts";

beforeAll(async () => {
  await loadDictionaries();
});

const values = (id: Parameters<typeof DETECTOR_BY_ID.get>[0], text: string) =>
  DETECTOR_BY_ID.get(id)!
    .scan(text)
    .map((s) => s.value);

describe("pin", () => {
  it("accepts valid personnummer in every written form", () => {
    expect(normalizePin("811218-9876")).toBe("8112189876");
    expect(normalizePin("8112189876")).toBe("8112189876");
    expect(normalizePin("19811218-9876")).toBe("8112189876");
    expect(normalizePin("198112189876")).toBe("8112189876");
    expect(normalizePin("811218+9876")).toBe("8112189876");
    // coordination number: day + 60
    expect(normalizePin("811278-9873")).toBe("8112789873");
  });
  it("rejects a bad check digit, month, or day", () => {
    expect(normalizePin("811218-9877")).toBeNull();
    expect(normalizePin("811318-9876")).toBeNull();
    expect(normalizePin("811232-9876")).toBeNull();
    expect(normalizePin("12345")).toBeNull();
  });
  it("finds them in running text but not inside longer numbers", () => {
    expect(
      values(
        "pin",
        "Sökande 19811218-9876 (och 811218-9876) samt 1234567890123",
      ),
    ).toEqual(["19811218-9876", "811218-9876"]);
  });
});

describe("org", () => {
  it("tells an organisation number from a personnummer", () => {
    expect(isOrgNumber("556012-5790")).toBe(true);
    expect(isOrgNumber("5560125790")).toBe(true);
    expect(isOrgNumber("165560125790")).toBe(true);
    expect(isOrgNumber("811218-9876")).toBe(false);
    expect(isOrgNumber("556012-5791")).toBe(false);
    expect(values("org", "Bolaget AB, 556012-5790, äger…")).toEqual([
      "556012-5790",
    ]);
  });
});

describe("phone", () => {
  it("normalises the common Swedish spellings", () => {
    expect(normalizePhone("070-123 45 67")).toBe("0701234567");
    expect(normalizePhone("+46 70 123 45 67")).toBe("0701234567");
    expect(normalizePhone("+46 (0)70-123 45 67")).toBe("0701234567");
    expect(normalizePhone("0046701234567")).toBe("0701234567");
    expect(normalizePhone("08-123 456 78")).toBe("0812345678");
    expect(normalizePhone("031-12 34 56")).toBe("031123456");
  });
  it("rejects dates and short digit runs", () => {
    expect(normalizePhone("01-02-2024")).toBeNull();
    expect(normalizePhone("0123")).toBeNull();
  });
  it("finds numbers in text", () => {
    expect(
      values(
        "phone",
        "Ring 070-123 45 67 eller +46 8 123 456 78. Ärende 2024-01-02.",
      ),
    ).toEqual(["070-123 45 67", "+46 8 123 456 78"]);
  });
});

describe("email", () => {
  it("finds addresses", () => {
    expect(values("email", "Skriv till anna.svensson@example.se idag")).toEqual(
      ["anna.svensson@example.se"],
    );
  });
});

describe("postal", () => {
  it("needs a locality, an SE- prefix, or a label", () => {
    expect(values("postal", "Storgatan 1, 123 45 Storstad")).toEqual([
      "123 45",
    ]);
    expect(values("postal", "SE-12345")).toEqual(["SE-12345"]);
    expect(values("postal", "Postnummer: 41101")).toEqual(["41101"]);
    expect(values("postal", "Summa 123 45 kronor")).toEqual([]);
    expect(values("postal", "ordernummer 12345.")).toEqual([]);
  });
});

describe("street", () => {
  it("finds compound and spaced street names with or without numbers", () => {
    expect(values("street", "Bor på Storgatan 12 B i stan")).toEqual([
      "Storgatan 12 B",
    ]);
    expect(values("street", "Norra Långgatan 5, lgh 1102")).toEqual([
      "Norra Långgatan 5, lgh 1102",
    ]);
    expect(values("street", "Karl Johans gata 3")).toEqual([
      "Karl Johans gata 3",
    ]);
    expect(values("street", "adress Kungsvägen")).toEqual(["Kungsvägen"]);
    expect(values("street", "Sankt Eriksgatan 44")).toEqual([
      "Sankt Eriksgatan 44",
    ]);
  });
  it("wants a number after an ambiguous ending and skips common words", () => {
    expect(values("street", "Enligt detaljplan och Handlingsplan")).toEqual([]);
    expect(values("street", "Möt vid Strandvägen")).toEqual(["Strandvägen"]);
    expect(values("street", "vid Sjöparken 3")).toEqual(["Sjöparken 3"]);
    expect(values("street", "vid Sjöparken")).toEqual([]);
    expect(values("street", "Motorvägen 4 var avstängd")).toEqual([]);
  });
});

describe("city", () => {
  it("matches whole capitalised localities, genitive allowed", () => {
    expect(
      values("city", "Flyttade från Stockholms kommun till Upplands Väsby"),
    ).toEqual(["Stockholm", "Upplands Väsby"]);
    expect(values("city", "stockholm och Lundagård")).toEqual([]);
  });
});

describe("name", () => {
  const names = (t: string) => scanNames(t).map((s) => s.value);
  it("anchors on a given name and takes the surname after it", () => {
    // "Lund" is a surname too; the pipeline's overlap ranking hands it to
    // the city detector, but the scanner alone reports it.
    expect(names("Sökanden Anna Svensson bor i Lund.")).toEqual([
      "Anna Svensson",
      "Lund",
    ]);
    expect(names("Hej Anna!")).toEqual(["Anna"]);
    expect(names("Kalle Anka och Musse Pigg")).toEqual(["Kalle Anka", "Musse"]);
    expect(names("Ansvarig: Lars-Erik Berg")).toEqual(["Lars-Erik Berg"]);
  });
  it("anchors on a surname and takes one word before it", () => {
    expect(names("Handläggare Xerxes Andersson")).toEqual(["Xerxes Andersson"]);
    expect(names("Familjen Bergström")).toEqual(["Bergström"]);
    expect(names("Enligt Person 3")).toEqual([]);
    expect(names("Tjänsteman på Länsstyrelsen")).toEqual([]);
  });
  it("leaves a genitive s outside the span", () => {
    expect(names("Annas bil och Svenssons hus")).toEqual(["Anna", "Svensson"]);
    expect(names("Anna Svenssons bil")).toEqual(["Anna Svensson"]);
  });
  it("uses the surname dictionary", () => {
    expect(looksLikeSurname("Nguyen")).toBe(true);
    expect(looksLikeSurname("Danmark")).toBe(false);
    expect(looksLikeSurname("Modell")).toBe(false);
    expect(looksLikeSurname("Åkerlind")).toBe(true);
  });
  it("trusts a name that is also a word only with context", () => {
    expect(sentenceInitial("Hej. Per", 5)).toBe(true);
    expect(sentenceInitial("Namn: Per", 6)).toBe(true);
    expect(sentenceInitial("och Per", 4)).toBe(false);
    // "Per" and "Berg" are everyday words: alone at a sentence start they are
    // not names, but together, or mid-sentence, they are.
    expect(names("Per capsulam beslutades det.")).toEqual([]);
    expect(names("Per Berg beslutade.")).toEqual(["Per Berg"]);
    expect(names("Vi talade med Per igår.")).toEqual(["Per"]);
    expect(names("Berg är högt.")).toEqual([]);
    expect(names("Enligt Berg är det så.")).toEqual(["Berg"]);
    expect(names("Björn sover.")).toEqual([]);
    expect(names("Björn Andersson sover.")).toEqual(["Björn Andersson"]);
  });
});
