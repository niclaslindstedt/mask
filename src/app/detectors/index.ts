// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cityDetector } from "./city.ts";
import { emailDetector } from "./email.ts";
import { nameDetector } from "./name.ts";
import { orgDetector } from "./org.ts";
import { phoneDetector } from "./phone.ts";
import { pinDetector } from "./pin.ts";
import { postalDetector } from "./postal.ts";
import { streetDetector } from "./street.ts";
import type { Detector, DetectorId } from "./types.ts";

export { DETECTOR_IDS, type Detector, type DetectorId } from "./types.ts";
export { normalizePin } from "./pin.ts";
export { normalizePhone } from "./phone.ts";
export { isOrgNumber } from "./org.ts";
export {
  dictionaries,
  dictionariesLoaded,
  loadDictionaries,
  subscribeDictionaries,
  type Dictionaries,
} from "./dictionaries.ts";

/** Every built-in detector, in the order their spans are ranked. */
export const DETECTORS: readonly Detector[] = [
  emailDetector,
  pinDetector,
  orgDetector,
  postalDetector,
  phoneDetector,
  streetDetector,
  cityDetector,
  nameDetector,
];

export const DETECTOR_BY_ID: ReadonlyMap<DetectorId, Detector> = new Map(
  DETECTORS.map((d) => [d.id, d]),
);

/** Every detector switched on — the app-settings default. */
export const ALL_DETECTORS_ON: Record<DetectorId, boolean> = {
  pin: true,
  org: true,
  phone: true,
  email: true,
  postal: true,
  street: true,
  city: true,
  name: true,
};
