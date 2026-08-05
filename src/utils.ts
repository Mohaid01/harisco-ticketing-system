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

/**
 * Formats decimal hours into a string like "1h 30m".
 * Example: 1.5 -> "1h 30m"
 */
export function formatHours(decimalHours: number | string): string {
  const hoursNum = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(hoursNum) || hoursNum < 0) return '0h 0m';

  const h = Math.floor(hoursNum);
  const m = Math.round((hoursNum - h) * 60);

  // Handle edge case where m rounds up to 60
  if (m === 60) {
    return `${h + 1}h 0m`;
  }

  return `${h}h ${m}m`;
}
