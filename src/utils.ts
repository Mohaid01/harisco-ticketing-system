import type { Inventory, InventoryCategory } from './types';

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
 * Short codes used in the Device ID for each inventory category.
 */
export const CATEGORY_DEVICE_CODES: Record<InventoryCategory, string> = {
  Laptop: 'LAP',
  Monitor: 'MON',
  Mouse: 'MOU',
  Keyboard: 'KEY',
  Printer: 'PRI',
  Mobile: 'MOB',
};

export const DEVICE_ID_PREFIX = 'HC-';
export const DEVICE_ID_SEQ_PAD = 4;

/**
 * Generates a Device ID in the format:
 * HC-{Manufacturer}-{CategoryCode}-{sequence}
 * Example: HC-Dell-Lap-0001
 * The sequence is calculated from existing inventory matching the same
 * manufacturer + category combination. Entity does not affect the Device ID.
 */
export function generateDeviceId(params: {
  manufacturer: string;
  category: InventoryCategory;
  inventory: Inventory[];
}): string {
  const { manufacturer, category, inventory } = params;
  const categoryCode = CATEGORY_DEVICE_CODES[category] ?? category;
  const manuf = manufacturer.trim().replace(/\s+/g, '-');
  const prefix = `${DEVICE_ID_PREFIX}${manuf}-${categoryCode}`;
  const matching = inventory.filter(
    (i) => i.company.trim().toUpperCase() === manufacturer.trim().toUpperCase() && i.category === category
  );
  const existingSeqs = matching
    .map((i) => {
      const parts = i.device_id.split('-');
      const last = parts[parts.length - 1];
      return /^\d+$/.test(last) ? parseInt(last, 10) : 0;
    })
    .filter((n) => !isNaN(n));
  const nextSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;
  const seq = nextSeq.toString().padStart(DEVICE_ID_SEQ_PAD, '0');
  return `${prefix}-${seq}`;
}

/**
 * Validates a Device ID against the HC-Manufacturer-Category-Sequence format.
 */
export const DEVICE_ID_REGEX = /^HC-[A-Za-z0-9-]+-[A-Za-z]+-\d{4}$/;

export function isValidDeviceId(deviceId: string): boolean {
  return DEVICE_ID_REGEX.test(deviceId.trim());
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
