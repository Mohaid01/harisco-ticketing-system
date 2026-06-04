/**
 * Formats a raw employee code/username into the standard HC-XXXXX format.
 * Pads the numeric portion to 5 digits with leading zeros.
 * Examples: "653" → "HC-00653", "1" → "HC-00001", "12345" → "HC-12345"
 */
export const EMPLOYEE_CODE_PREFIX = 'HC-';
const EMPLOYEE_CODE_PAD_LENGTH = 5;

export function formatEmployeeCode(rawCode: string | undefined): string {
  if (!rawCode) return 'N/A';
  const numericPart = rawCode.replace(/\D/g, '');
  if (!numericPart) return `${EMPLOYEE_CODE_PREFIX}${rawCode}`;
  return `${EMPLOYEE_CODE_PREFIX}${numericPart.padStart(EMPLOYEE_CODE_PAD_LENGTH, '0')}`;
}
