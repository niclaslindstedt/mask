import { describe, expect, it } from "vitest";

import {
  commonLeft,
  groupRunsIntoLines,
  layoutDocumentParagraphs,
  layoutDocumentText,
  layoutPageText,
  partitionRunningFurniture,
  type TextRun,
} from "../src/generic/extractText/layout.ts";

// A page of 12pt text on a 14pt leading, left margin at 70, right at 470 —
// the geometry a PDF hands over, in the units it hands it over in.
const FONT = 12;
const PITCH = 14;
const LEFT = 70;
const RIGHT = 470;
const TOP = 700;

function run(
  text: string,
  x: number,
  y: number,
  width: number,
  height = FONT,
): TextRun {
  return { text, x, y, width, height };
}

/** A line of body text at row `row`, reaching `width` points wide (a full
 *  line by default — prose wraps at the margin). */
function line(
  text: string,
  row: number,
  { width = RIGHT - LEFT, x = LEFT, gap = 0 } = {},
): TextRun {
  return run(text, x, TOP - row * PITCH - gap, width);
}

describe("grouping runs into lines", () => {
  it("puts runs sharing a baseline on one line", () => {
    const lines = groupRunsIntoLines([
      run("Högsta", 70, 700, 40),
      run("domstolen", 115, 700, 60),
      run("nästa rad", 70, 686, 55),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["Högsta domstolen", "nästa rad"]);
    expect(lines[0]).toMatchObject({ left: 70, right: 175, height: FONT });
  });

  it("reads a gap the producer drew instead of a space as a space", () => {
    const [only] = groupRunsIntoLines([
      run("HÖGSTA DOMSTOLEN", 68, 774, 126),
      run("B 4808-23", 372, 774, 51),
    ]);
    expect(only!.text).toBe("HÖGSTA DOMSTOLEN B 4808-23");
  });

  it("drops empty runs and collapses whitespace", () => {
    const lines = groupRunsIntoLines([
      run("", 70, 700, 0),
      run("  ", 70, 686, 4),
      run("text", 70, 672, 20),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["text"]);
  });

  it("takes the margin most lines share, not the outlying one", () => {
    const lines = groupRunsIntoLines([
      line("indented first line", 0, { x: 90 }),
      line("body", 1),
      line("body", 2),
    ]);
    expect(commonLeft(lines)).toBe(LEFT);
  });
});

describe("reflowing a page into paragraphs", () => {
  it("joins the lines a paragraph wrapped over", () => {
    const text = layoutPageText([
      line("På eftermiddagen den 14 mars 2023 körde RL, som då var 16 år,", 0),
      line("sin A-traktor på Ekersvägen i Örebro tillsammans med två", 1),
      line("kamrater.", 2, { width: 60 }),
    ]);
    expect(text).toBe(
      "På eftermiddagen den 14 mars 2023 körde RL, som då var 16 år, " +
        "sin A-traktor på Ekersvägen i Örebro tillsammans med två kamrater.",
    );
  });

  it("starts a paragraph where the leading grows", () => {
    const text = layoutPageText([
      line("Första stycket löper vidare på nästa rad och fyller den", 0),
      line("hela vägen ut till marginalen som prosa gör.", 1),
      line("Andra stycket börjar efter ett blankt radavstånd och det", 2, {
        gap: PITCH,
      }),
      line("löper också vidare.", 3, { gap: PITCH, width: 100 }),
    ]);
    expect(text.split("\n\n")).toHaveLength(2);
  });

  it("ends a paragraph on a line that stops short of the margin", () => {
    const text = layoutPageText([
      line("Den här raden går ända ut till högermarginalen.", 0),
      line("Och den här slutar tidigt.", 1, { width: 120 }),
      line("Nästa stycke börjar här och fyller raden helt igen.", 2),
      line("Det fortsätter på nästa rad.", 3, { width: 140 }),
    ]);
    expect(text.split("\n\n")).toEqual([
      "Den här raden går ända ut till högermarginalen. Och den här slutar tidigt.",
      "Nästa stycke börjar här och fyller raden helt igen. Det fortsätter på nästa rad.",
    ]);
  });

  it("starts a paragraph on a first-line indent", () => {
    const text = layoutPageText([
      line("Ett stycke utan extra radavstånd före nästa, som är indraget", 0),
      line("och fortsätter ut till marginalen på den här raden också.", 1),
      line("Det indragna stycket börjar här och löper ut till kanten.", 2, {
        x: LEFT + 14,
        width: RIGHT - LEFT - 14,
      }),
      line("Och slutar här.", 3, { width: 90 }),
    ]);
    expect(text.split("\n\n")).toHaveLength(2);
    expect(text.split("\n\n")[1]).toMatch(/^Det indragna stycket/);
  });

  it("gives a numbered item its own paragraph", () => {
    const text = layoutPageText([
      line("Inledningen fyller raden ut till högermarginalen precis.", 0),
      line("1. Första punkten fyller också raden hela vägen ut hit.", 1),
      line("2. Andra punkten står för sig själv.", 2, { width: 200 }),
    ]);
    expect(text.split("\n\n")).toEqual([
      "Inledningen fyller raden ut till högermarginalen precis.",
      "1. Första punkten fyller också raden hela vägen ut hit.",
      "2. Andra punkten står för sig själv.",
    ]);
  });

  it("rejoins a word the line break split, and leaves a real hyphen alone", () => {
    expect(
      layoutPageText([
        line("Sedan polisen hade sett anledning att stoppa dem ett multi-", 0),
        line("verktyg. Detta innehöll en kniv.", 1, { width: 160 }),
      ]),
    ).toBe(
      "Sedan polisen hade sett anledning att stoppa dem ett multiverktyg. " +
        "Detta innehöll en kniv.",
    );
    expect(
      layoutPageText([
        line("De var på väg hem från gymnasiet i hans A-", 0),
        line("traktor. Det var en tisdag.", 1, { width: 140 }),
      ]),
    ).toContain("A-traktor.");
  });
});

describe("reading order", () => {
  it("reads a footer drawn before the body after it", () => {
    // The producer drew the page furniture first — content order is not
    // reading order.
    const text = layoutPageText([
      run("Postadress: Box 2066, 103 12 Stockholm", LEFT, 60, 200),
      run("PARTER", LEFT, 600, 50),
      run("Klagande RL", LEFT, 586, 70),
    ]);
    expect(text.split("\n\n")).toEqual([
      "PARTER",
      "Klagande RL",
      "Postadress: Box 2066, 103 12 Stockholm",
    ]);
  });

  it("reads two columns one after the other", () => {
    const text = layoutPageText([
      run("Vänster spalt rad ett", 70, 700, 180),
      run("vänster spalt rad två.", 70, 686, 100),
      run("Höger spalt rad ett", 300, 700, 170),
      run("höger spalt rad två.", 300, 686, 90),
    ]);
    expect(text.split("\n\n")).toEqual([
      "Vänster spalt rad ett vänster spalt rad två.",
      "Höger spalt rad ett höger spalt rad två.",
    ]);
  });
});

describe("whole documents", () => {
  const header = (page: number) => line(`HÖGSTA DOMSTOLEN Sida ${page}`, -2);
  const body = (page: number) => [
    line(`Sidan ${page} inleds med ett stycke som fyller raden ut till`, 0),
    line(`marginalen, och stycke nummer ${page} slutar sedan här.`, 1, {
      width: 200,
    }),
  ];

  it("tells a header that repeats on page after page from the body", () => {
    const pages = [1, 2, 3].map((page) => [header(page), ...body(page)]);
    const parts = partitionRunningFurniture(
      pages.map((runs) => groupRunsIntoLines(runs)),
    );
    expect(parts.map((part) => part.head.map((line) => line.text))).toEqual([
      ["HÖGSTA DOMSTOLEN Sida 1"],
      ["HÖGSTA DOMSTOLEN Sida 2"],
      ["HÖGSTA DOMSTOLEN Sida 3"],
    ]);
    expect(parts.every((part) => part.foot.length === 0)).toBe(true);
    expect(parts[0]!.body.map((line) => line.text)).toEqual([
      "Sidan 1 inleds med ett stycke som fyller raden ut till",
      "marginalen, och stycke nummer 1 slutar sedan här.",
    ]);
  });

  it("keeps the header out of the prose it stands over", () => {
    const pages = [1, 2, 3].map((page) => [header(page), ...body(page)]);
    // Laid out, the header is a paragraph of its own, flagged as furniture —
    // never run in with the sentence it was drawn above.
    const laid = layoutDocumentParagraphs(
      pages.map((runs) => groupRunsIntoLines(runs)),
    );
    expect(
      laid
        .filter((paragraph) => paragraph.furniture)
        .map((paragraph) => paragraph.text),
    ).toEqual([
      "HÖGSTA DOMSTOLEN Sida 1",
      "HÖGSTA DOMSTOLEN Sida 2",
      "HÖGSTA DOMSTOLEN Sida 3",
    ]);
    expect(
      laid.some(
        (paragraph) =>
          !paragraph.furniture && paragraph.text.includes("HÖGSTA DOMSTOLEN"),
      ),
    ).toBe(false);
  });

  it("keeps a repeated line in a document too short to call it furniture", () => {
    const text = layoutDocumentText([1, 2].map((p) => [header(p), ...body(p)]));
    expect(text).toContain("HÖGSTA DOMSTOLEN Sida 1");
  });

  it("keeps a detached first line that does not repeat", () => {
    const titles = ["knivar", "fordon", "påföljd"];
    const pages = titles.map((title, index) => [
      line(`Bedömningen av ${title}`, -2),
      ...body(index + 1),
    ]);
    expect(layoutDocumentText(pages)).toContain("Bedömningen av knivar");
  });

  it("puts a sentence cut in half by the page break back together", () => {
    const pages = [
      [
        line("Hovrätten har ansett innehavet som obefogat och dömt RL", 0),
        line("för oaktsamt brott mot lagen. Påföljden bestämdes av", 1),
      ],
      [
        line("hovrätten till dagsböter.", 0, { width: 130 }),
        line("Nästa stycke står för sig.", 1, { gap: PITCH, width: 140 }),
      ],
    ];
    expect(layoutDocumentText(pages).split("\n\n")[0]).toBe(
      "Hovrätten har ansett innehavet som obefogat och dömt RL för oaktsamt " +
        "brott mot lagen. Påföljden bestämdes av hovrätten till dagsböter.",
    );
  });

  it("leaves pages apart when one ends a sentence", () => {
    const pages = [
      [
        line("Sista raden på sidan avslutar sin mening här.", 0, {
          width: 200,
        }),
      ],
      [line("Nästa sida börjar en ny.", 0, { width: 130 })],
    ];
    expect(layoutDocumentText(pages)).toBe(
      "Sista raden på sidan avslutar sin mening här.\n\n" +
        "Nästa sida börjar en ny.",
    );
  });

  it("leaves the lines alone when nothing repeats", () => {
    const pages = [[line("Ensam sida", 0, { width: 60 })]].map((page) =>
      groupRunsIntoLines(page),
    );
    expect(partitionRunningFurniture(pages)).toEqual(
      pages.map((page) => ({ head: [], body: page, foot: [] })),
    );
  });

  it("puts a sentence back together across a footer and the next header", () => {
    // The furniture stands between the two halves on paper; the sentence is
    // still one sentence, and each footer is still at the foot of its page.
    const pages = [1, 2, 3].map((page) => [
      line("HÖGSTA DOMSTOLEN Sida " + page, -2),
      line(`sidan ${page} fortsätter förbi sidbrytningen och hamnar i`, 0),
      line(`samma stycke som nästa sida inleder med ordet`, 1),
      line(`Dok.Id ${page}00 Sida ${page}`, 4, { gap: PITCH * 3, width: 90 }),
    ]);
    const laid = layoutDocumentParagraphs(
      pages.map((runs) => groupRunsIntoLines(runs)),
    );
    expect(laid.map((paragraph) => paragraph.furniture === true)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(laid[1]!.text).toContain("med ordet sidan 2 fortsätter");
    expect(laid[1]!.text).toContain("med ordet sidan 3 fortsätter");
    expect(laid[2]!.text).toBe("Dok.Id 100 Sida 1");
  });
});
