import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The suite runs without a DOM, so the module gets the smallest `document` /
// `window` it actually touches: create an input, mount it, focus it, and take
// it back down again. Each test re-imports the module so the primer it caches
// doesn't leak into the next one.

type FakeInput = {
  type: string;
  tabIndex: number;
  style: { cssText: string };
  attributes: Record<string, string>;
  isConnected: boolean;
  setAttribute: (name: string, value: string) => void;
  focus: (options?: { preventScroll?: boolean }) => void;
  blur: () => void;
  remove: () => void;
};

let created: FakeInput[] = [];
let mounted: FakeInput[] = [];
let active: FakeInput | null = null;
let blurred = 0;

function makeInput(): FakeInput {
  const el: FakeInput = {
    type: "",
    tabIndex: 0,
    style: { cssText: "" },
    attributes: {},
    isConnected: false,
    setAttribute: (name, value) => {
      el.attributes[name] = value;
    },
    focus: () => {
      active = el;
    },
    blur: () => {
      blurred += 1;
      if (active === el) active = null;
    },
    remove: () => {
      el.isConnected = false;
      mounted = mounted.filter((child) => child !== el);
    },
  };
  created.push(el);
  return el;
}

/** Stub the globals, then load a module instance that hasn't primed yet. */
async function load(coarse: boolean) {
  vi.stubGlobal("document", {
    createElement: () => makeInput(),
    body: {
      appendChild: (el: FakeInput) => {
        el.isConnected = true;
        mounted.push(el);
      },
    },
    get activeElement() {
      return active;
    },
  });
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
    }),
  });
  vi.resetModules();
  return await import("../src/generic/softKeyboard.ts");
}

beforeEach(() => {
  created = [];
  mounted = [];
  active = null;
  blurred = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("primeSoftKeyboard", () => {
  it("focuses a mounted text field on a coarse pointer", async () => {
    const { primeSoftKeyboard } = await load(true);
    primeSoftKeyboard();

    expect(created).toHaveLength(1);
    const el = created[0];
    expect(el.type).toBe("text");
    expect(el.tabIndex).toBe(-1);
    expect(el.attributes["aria-hidden"]).toBe("true");
    // A keyboard only opens for a field that is really laid out, and a
    // sub-16px one makes iOS zoom the page as it takes focus.
    expect(el.style.cssText).toContain("font-size:16px");
    expect(mounted).toEqual([el]);
    expect(active).toBe(el);
  });

  it("does nothing away from a coarse pointer", async () => {
    const { primeSoftKeyboard } = await load(false);
    primeSoftKeyboard();

    expect(created).toHaveLength(0);
    expect(active).toBeNull();
  });

  it("gives the keyboard back when no field claims it", async () => {
    const { primeSoftKeyboard } = await load(true);
    primeSoftKeyboard();
    vi.runAllTimers();

    expect(blurred).toBe(1);
    expect(mounted).toHaveLength(0);
  });

  it("leaves the real field alone once it has taken focus", async () => {
    const { primeSoftKeyboard } = await load(true);
    primeSoftKeyboard();
    const real = makeInput();
    real.focus();
    vi.runAllTimers();

    expect(blurred).toBe(0);
    expect(active).toBe(real);
    expect(mounted).toHaveLength(0);
  });

  it("reuses and re-mounts the primer across taps", async () => {
    const { primeSoftKeyboard } = await load(true);
    primeSoftKeyboard();
    vi.runAllTimers();
    primeSoftKeyboard();

    expect(created).toHaveLength(1);
    expect(mounted).toEqual([created[0]]);
    expect(active).toBe(created[0]);
  });
});

describe("PLAIN_TEXT_KEYBOARD_PROPS", () => {
  it("asks for a committing keyboard and no autocorrect", async () => {
    const { PLAIN_TEXT_KEYBOARD_PROPS } = await load(true);

    expect(PLAIN_TEXT_KEYBOARD_PROPS).toEqual({
      autoCorrect: "off",
      spellcheck: false,
      enterKeyHint: "done",
    });
  });
});
