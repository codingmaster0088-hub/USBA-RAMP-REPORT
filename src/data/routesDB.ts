import { StationCode, SavedReport } from '../types';

export const routesDB: Record<string, number[]> = {
  'DAC-CGP': [101, 103, 105, 107, 109, 111, 113, 115, 117, 119],
  'CGP-DAC': [102, 104, 106, 108, 110, 112, 114, 116, 118, 120],
  'DAC-ZYL': [531, 533, 535, 537, 539, 541],
  'ZYL-DAC': [532, 534, 536, 538, 540, 542],
  'DAC-CXB': [141, 143, 145, 147, 149, 151, 153, 155, 157, 159, 171, 173, 175, 177, 179],
  'CXB-DAC': [142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 172, 174, 176, 178, 180],
  'DAC-RJH': [161, 163, 165, 167, 169],
  'RJH-DAC': [162, 164, 166, 168, 170],
  'DAC-SPD': [181, 183, 185, 187, 189, 191, 193, 195, 197, 199],
  'SPD-DAC': [182, 184, 186, 188, 190, 192, 194, 196, 198],
  'DAC-JSR': [121, 123, 125, 127, 129],
  'JSR-DAC': [122, 124, 126, 128, 130],
  'DAC-BZL': [131, 133, 135, 137, 139],
  'BZL-DAC': [132, 134, 136, 138, 140],
  'DAC-DXB': [341, 343],
  'DXB-DAC': [342, 344],
  'DAC-SHJ': [345, 347],
  'SHJ-DAC': [346, 348],
  'DAC-AUH': [349, 351],
  'AUH-DAC': [350, 352],
  'DAC-RUH': [381, 383],
  'RUH-DAC': [382, 384],
  'DAC-JED': [361, 363],
  'JED-DAC': [362, 364],
  'DAC-MLE': [337, 339],
  'MLE-DAC': [338, 340],
  'DAC-BKK': [217, 219],
  'BKK-DAC': [218, 220],
  'DAC-MCT': [321, 323],
  'MCT-DAC': [322, 324],
  'DAC-DOH': [333, 335],
  'DOH-DAC': [334, 336],
  'DAC-CCU': [201, 203],
  'CCU-DAC': [202, 204],
  'DAC-MAA': [205, 207, 209],
  'MAA-DAC': [206, 208, 210],
  'DAC-CAN': [325, 327],
  'CAN-DAC': [326, 328],
  'DAC-SIN': [307, 309],
  'SIN-DAC': [308, 310],
  'DAC-KUL': [315, 317, 319],
  'KUL-DAC': [316, 318, 320]
};

export const stationList: { code: StationCode; name: string; city: string }[] = [
  { code: 'DAC', name: 'Hazrat Shahjalal Int. Airport', city: 'Dhaka' },
  { code: 'CGP', name: 'Shah Amanat Int. Airport', city: 'Chattogram' },
  { code: 'SPD', name: 'Saidpur Airport', city: 'Saidpur' },
  { code: 'CXB', name: "Cox's Bazar Airport", city: "Cox's Bazar" },
  { code: 'ZYL', name: 'Osmani Int. Airport', city: 'Sylhet' },
  { code: 'JSR', name: 'Jashore Airport', city: 'Jashore' },
  { code: 'RJH', name: 'Shah Makhdum Airport', city: 'Rajshahi' },
  { code: 'BZL', name: 'Barishal Airport', city: 'Barishal' }
];

export function lookupRoute(flightNumberStr: string): string {
  const num = parseInt(flightNumberStr.replace(/[^0-9]/g, ''), 10);
  if (!num || isNaN(num)) return '';

  for (const [route, numbers] of Object.entries(routesDB)) {
    if (numbers.includes(num)) {
      return route;
    }
  }
  return '';
}

export interface ParityValidationResult {
  isValid: boolean;
  station: string;
  fltNum: number;
  expectedParity: 'ODD' | 'EVEN';
  actualParity: 'ODD' | 'EVEN';
  suggestedFlt: string;
  warningBangla: string;
  warningEnglish: string;
}

/**
 * Odd/Even flight number rule:
 * - For DAC station:
 *     Departure is ALWAYS ODD (e.g. 101, 141, 183)
 *     Arrival is ALWAYS EVEN (e.g. 102, 142, 184)
 * - For Outstations (CXB, SPD, CGP, ZYL, JSR, RJH, BZL, etc.):
 *     Arrival is ALWAYS ODD (e.g. 101, 141, 183)
 *     Departure is ALWAYS EVEN (e.g. 102, 142, 184)
 */
export function validateFlightParity(
  station: string,
  flightNumberStr: string,
  type: 'DEPARTURE' | 'ARRIVAL'
): ParityValidationResult | null {
  const fltClean = flightNumberStr.replace(/BS/gi, '').replace(/[^0-9]/g, '');
  const fltNum = parseInt(fltClean, 10);
  if (!fltNum || isNaN(fltNum)) return null;

  const currentStation = (station || 'DAC').toUpperCase();
  const isDac = currentStation === 'DAC';
  const isEven = fltNum % 2 === 0;
  const actualParity: 'ODD' | 'EVEN' = isEven ? 'EVEN' : 'ODD';

  let expectedParity: 'ODD' | 'EVEN';
  if (isDac) {
    expectedParity = type === 'DEPARTURE' ? 'ODD' : 'EVEN';
  } else {
    expectedParity = type === 'ARRIVAL' ? 'ODD' : 'EVEN';
  }

  const isValid = actualParity === expectedParity;
  if (isValid) {
    return {
      isValid: true,
      station: currentStation,
      fltNum,
      expectedParity,
      actualParity,
      suggestedFlt: String(fltNum),
      warningBangla: '',
      warningEnglish: ''
    };
  }

  // Suggest the closest valid flight number
  let suggestedNum: number;
  if (expectedParity === 'EVEN') {
    suggestedNum = fltNum % 2 !== 0 ? fltNum + 1 : fltNum;
  } else {
    suggestedNum = fltNum % 2 === 0 ? (fltNum - 1 > 0 ? fltNum - 1 : fltNum + 1) : fltNum;
  }
  const suggestedFlt = String(suggestedNum);

  const banglaType = type === 'DEPARTURE' ? 'Departure (প্রস্থান)' : 'Arrival (আগমন)';
  const banglaExpected = expectedParity === 'ODD' ? 'ODD (বিজোড়)' : 'EVEN (জোড়)';
  const banglaActual = actualParity === 'ODD' ? 'ODD (বিজোড়)' : 'EVEN (জোড়)';

  const warningBangla = `⚠️ BS-${fltClean} একটি ${banglaActual} নম্বর! ${currentStation} স্টেশনের জন্য ${banglaType} ফ্লাইট নম্বর সর্বদা ${banglaExpected} হতে হবে (যেমন: BS-${suggestedFlt})।`;
  const warningEnglish = `⚠️ BS-${fltClean} is an ${actualParity} number! For ${currentStation} station, ${type} flight must always be an ${expectedParity} number (e.g. BS-${suggestedFlt}).`;

  return {
    isValid: false,
    station: currentStation,
    fltNum,
    expectedParity,
    actualParity,
    suggestedFlt,
    warningBangla,
    warningEnglish
  };
}

/**
 * Returns the paired flight number for round-trip turnarounds:
 * e.g. 141 (Arrival at CXB) -> 142 (Departure at CXB)
 * e.g. 142 (Departure at CXB) -> 141 (Arrival at CXB)
 */
export function getPairedFlightNumber(flightNumberStr: string, toType: 'TO_DEPARTURE' | 'TO_ARRIVAL'): string {
  const fltClean = flightNumberStr.replace(/BS/gi, '').replace(/[^0-9]/g, '');
  const fltNum = parseInt(fltClean, 10);
  if (!fltNum || isNaN(fltNum)) return '';

  if (toType === 'TO_DEPARTURE') {
    // If incoming was odd (e.g. 141), paired departure is fltNum + 1 (142)
    return fltNum % 2 !== 0 ? String(fltNum + 1) : String(fltNum);
  } else {
    // If departure was even (e.g. 142), paired arrival is fltNum - 1 (141)
    return fltNum % 2 === 0 ? String(Math.max(1, fltNum - 1)) : String(fltNum);
  }
}

/**
 * Returns default route for a given station and direction
 */
export function getStationRoute(station: string, direction: 'INBOUND' | 'OUTBOUND'): string {
  const stn = (station || 'DAC').toUpperCase();
  if (stn === 'DAC') return '';
  return direction === 'INBOUND' ? `DAC-${stn}` : `${stn}-DAC`;
}

export function formatAircraftReg(input: string): string {
  const val = input.toUpperCase().trim();
  if (!val) return '';

  if (val.includes('SXA')) return 'HS-SXA';
  if (val.includes('BBG')) return 'PK-BBG';
  if (val.includes('BBH')) return 'PK-BBH';
  if (val.includes('SAU')) return '9H-SAU';

  const clean = val.replace(/^(S2|HS|PK|9H)[-\s]?/i, '');
  return `S2-${clean}`;
}

export function calculateFlightStatus(std: string, co: string): { text: string; color: string; statusType: 'ontime' | 'delay' | 'early' } {
  if (std.length < 4 || co.length < 4) {
    return { text: 'অপেক্ষমাণ (PENDING)', color: '#6b7280', statusType: 'ontime' };
  }

  const stdMin = parseInt(std.substring(0, 2), 10) * 60 + parseInt(std.substring(2, 4), 10);
  let coMin = parseInt(co.substring(0, 2), 10) * 60 + parseInt(co.substring(2, 4), 10);

  // Cross-midnight adjustment
  if (coMin < stdMin - 720) coMin += 1440;

  const diff = coMin - stdMin;
  const absDiff = Math.abs(diff);
  const formattedDiff = absDiff < 10 ? `0${absDiff}` : `${absDiff}`;
  const unit = absDiff === 1 ? 'MIN' : 'MINS';

  if (diff === 0) {
    return { text: 'FLIGHT IS ONTIME', color: '#10b981', statusType: 'ontime' };
  } else if (diff > 0) {
    return { text: `FLIGHT ${formattedDiff} ${unit} DELAY`, color: '#ef4444', statusType: 'delay' };
  } else {
    return { text: `FLIGHT ${formattedDiff} ${unit} EARLY`, color: '#10b981', statusType: 'early' };
  }
}

export function calculateGroundTime(con: string, co: string): string {
  if (con.length < 4 || co.length < 4) return '';
  const conMin = parseInt(con.substring(0, 2), 10) * 60 + parseInt(con.substring(2, 4), 10);
  let coMin = parseInt(co.substring(0, 2), 10) * 60 + parseInt(co.substring(2, 4), 10);

  if (coMin < conMin) coMin += 1440;
  const mins = Math.max(0, coMin - conMin);
  return `${mins}`;
}

export const initialSampleReports: SavedReport[] = [];
