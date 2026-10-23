/**
 * Demo sign-in validation. Nothing is sent anywhere; this only keeps the
 * stored name and number tidy so the planner can greet the traveller.
 */

export type FieldError = 'nameShort' | 'phoneInvalid';

/** Accepts "+91 98765 43210", "098765-43210", "9876543210" → "9876543210". */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9. */
export function isIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits);
}

export function validateDemoUser(
  name: string,
  phone: string,
): Partial<Record<'name' | 'phone', FieldError>> {
  const errors: Partial<Record<'name' | 'phone', FieldError>> = {};
  if (name.trim().length < 2) errors.name = 'nameShort';
  if (!isIndianMobile(normalizePhone(phone))) errors.phone = 'phoneInvalid';
  return errors;
}

/** "9876543210" → "+91 98765 43210" for display. */
export function formatPhone(digits: string): string {
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
