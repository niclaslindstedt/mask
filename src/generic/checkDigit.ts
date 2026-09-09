// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Check-digit arithmetic. Luhn (mod 10) is the scheme behind payment card
// numbers, national identity numbers in several countries, and organisation
// numbers; a scanner uses it to tell a real identifier from a run of digits
// that merely has the right shape.

/** `true` when a string of decimal digits (nothing else) passes the Luhn mod-10
 *  check, its last digit being the check digit. Non-digit input fails. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}
