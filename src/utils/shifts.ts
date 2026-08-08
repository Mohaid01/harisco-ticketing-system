import type { AttendanceLog } from '../types';

export type ShiftCode = 'headquarters' | 'day' | 'night' | 'extended';

export interface ShiftDefinition {
  code: ShiftCode;
  label: string;
  weekdayStart: { h: number; m: number };
  weekdayEnd: { h: number; m: number };
  saturdayStart?: { h: number; m: number };
  saturdayEnd?: { h: number; m: number };
  sundayOff: boolean;
  graceMinutes: number;
  baseHours: number;
  maxOtHours: number;
}

export const SHIFTS: Record<ShiftCode, ShiftDefinition> = {
  headquarters: {
    code: 'headquarters',
    label: 'General Shift (HQ)',
    weekdayStart: { h: 9, m: 30 },
    weekdayEnd: { h: 18, m: 0 },
    saturdayStart: { h: 10, m: 0 },
    saturdayEnd: { h: 16, m: 0 },
    sundayOff: true,
    graceMinutes: 30,
    baseHours: 8,
    maxOtHours: 0,
  },
  day: {
    code: 'day',
    label: 'Day Shift (Factory)',
    weekdayStart: { h: 8, m: 0 },
    weekdayEnd: { h: 17, m: 0 },
    saturdayStart: { h: 8, m: 0 },
    saturdayEnd: { h: 17, m: 0 },
    sundayOff: true,
    graceMinutes: 15,
    baseHours: 9,
    maxOtHours: 3,
  },
  night: {
    code: 'night',
    label: 'Night Shift (Factory)',
    weekdayStart: { h: 20, m: 0 },
    weekdayEnd: { h: 5, m: 0 },
    saturdayStart: { h: 20, m: 0 },
    saturdayEnd: { h: 5, m: 0 },
    sundayOff: true,
    graceMinutes: 15,
    baseHours: 9,
    maxOtHours: 3,
  },
  extended: {
    code: 'extended',
    label: 'General Shift (Factory)',
    weekdayStart: { h: 9, m: 0 },
    weekdayEnd: { h: 20, m: 0 },
    saturdayStart: { h: 9, m: 0 },
    saturdayEnd: { h: 20, m: 0 },
    sundayOff: true,
    graceMinutes: 15,
    baseHours: 11,
    maxOtHours: 0,
  },
};

export function getEffectiveShift(
  defaultShift: string,
  overrides?: Record<string, string>,
  dateStr?: string
): ShiftDefinition {
  let shiftCode = defaultShift as ShiftCode;
  if (dateStr && overrides && overrides[dateStr]) {
    shiftCode = overrides[dateStr] as ShiftCode;
  }
  if ((shiftCode as string) === 'general') {
    shiftCode = 'extended';
  }
  return SHIFTS[shiftCode] || SHIFTS.headquarters;
}

export function hasShiftStartedForUser(shift: ShiftDefinition): boolean {
  const now = new Date();
  const pktNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const currentH = pktNow.getUTCHours();
  const currentM = pktNow.getUTCMinutes();
  const dayOfWeek = pktNow.getUTCDay();
  const isSat = dayOfWeek === 6;

  if (shift.code === 'night') {
    return currentH >= shift.weekdayStart.h || currentH < shift.weekdayEnd.h;
  }

  const start = isSat && shift.saturdayStart ? shift.saturdayStart : shift.weekdayStart;
  return currentH > start.h || (currentH === start.h && currentM >= start.m);
}

export function getShiftDateForPunch(punchTime: string, shift: ShiftDefinition): string {
  const normalizedTime = punchTime.replace(/-T/g, 'T').replace(' ', 'T');
  const [datePart, timePart] = normalizedTime.split('T');
  if (!timePart) return datePart;

  const [hour] = timePart.split(':').map(Number);

  if (shift.code === 'night' && hour < shift.weekdayEnd.h + shift.maxOtHours + 1) {
    const prev = new Date(datePart + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().split('T')[0];
  }

  return datePart;
}

export function getLogShiftDate(
  log: AttendanceLog,
  shift: ShiftDefinition,
  parseLogPKT?: (log: AttendanceLog) => { date: string; time: string; timestamp: string }
): string {
  if (parseLogPKT) {
    const parsed = parseLogPKT(log);
    if (parsed.date) {
      return getShiftDateForPunch(parsed.timestamp || parsed.date, shift);
    }
  }
  const punchTime = log.ioTime || log.timestamp || '';
  if (!punchTime) return '';
  return getShiftDateForPunch(punchTime, shift);
}

export function isLateArrival(
  checkInTime: string, // "HH:MM"
  shift: ShiftDefinition,
  date: Date
): boolean {
  const [hour, min] = checkInTime.split(':').map(Number);
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;

  if (isSunday && shift.sundayOff) return false;

  let start = shift.weekdayStart;
  if (isSaturday && shift.saturdayStart) {
    start = shift.saturdayStart;
  }

  const graceTotalMinutes = start.h * 60 + start.m + shift.graceMinutes;
  const graceHour = Math.floor(graceTotalMinutes / 60);
  const graceMin = graceTotalMinutes % 60;

  return hour > graceHour || (hour === graceHour && min >= graceMin);
}

export function calculateOvertime(
  actualHours: number,
  shift: ShiftDefinition,
  isHoliday: boolean,
  isSunday: boolean,
  isSaturday: boolean
): { otHours: number; baseHours: number } {
  if (isHoliday) {
    return { otHours: 0, baseHours: actualHours };
  }
  if (isSunday && shift.sundayOff) {
    return { otHours: 0, baseHours: actualHours };
  }

  const baseHours = isSaturday && shift.code === 'headquarters' ? 6 : shift.baseHours;

  if (actualHours <= baseHours) {
    return { otHours: 0, baseHours };
  }

  const rawOt = actualHours - baseHours;
  const otHours = shift.maxOtHours === 0 ? 0 : Math.min(rawOt, shift.maxOtHours);

  return { otHours, baseHours };
}
