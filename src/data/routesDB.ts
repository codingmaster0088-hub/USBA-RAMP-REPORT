import { StationCode, SavedReport } from '../types';

export const routesDB: Record<string, number[]> = {
  'DAC-CGP': [101, 103, 105, 107, 109, 111, 113, 115, 117, 119],
  'CGP-DAC': [102, 104, 106, 108, 110, 112, 114, 116, 118, 120],
  'DAC-ZYL': [531, 533, 535, 537, 539],
  'ZYL-DAC': [532, 534, 536, 538, 540],
  'DAC-CXB': [141, 143, 145, 147, 149, 151, 153, 155, 157, 159, 171, 173, 175, 177, 179],
  'CXB-DAC': [142, 144, 146, 148, 150, 152, 154, 156, 158, 160, 172, 174, 176, 178, 180],
  'DAC-RJH': [161, 163, 165, 167, 169],
  'RJH-DAC': [162, 164, 166, 168, 170],
  'DAC-SPD': [181, 183, 185, 187, 189, 191, 193, 195, 197, 199],
  'SPD-DAC': [182, 184, 186, 188, 190, 192, 194, 196, 198],
  'DAC-JSR': [121, 123, 125, 127, 129],
  'JSR-DAC': [122, 124, 126, 128, 130],
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

export const initialSampleReports: SavedReport[] = [
  {
    id: 'sub-361-11aug',
    type: 'INTERNATIONAL',
    mode: 'ROUND',
    flight: 'BS-361',
    date: '11 AUG 26',
    route: 'DAC-JED',
    timestamp: new Date().toISOString(),
    officerName: 'IKTADAR.ALINDO',
    officerId: '7473',
    formData: {
      date: '11 AUG 26',
      ac: 'S2-ALB',
      bay: 'C8',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '361',
      deptRoute: 'DAC-JED',
      std: '1715',
      dc: '1715',
      co: '1715',
      ab: 'N/A',
      status: 'FLIGHT IS ONTIME',
      securitySt: 'EARLIER',
      securityEnd: 'EARLIER',
      cleaningSt: 'EARLIER',
      cleaningEnd: 'EARLIER',
      cateringSt: 'EARLIER',
      cateringEnd: 'EARLIER',
      crew: '1605',
      refuel: '1611',
      lbag: '1605',
      permit: '1626',
      pax: '1709',
      trimSubmitted: '1708',
      trimSigned: '1708',
      ground: '0',
      station: 'DAC'
    }
  },
  {
    id: 'sub-539-11aug',
    type: 'DOMESTIC',
    mode: 'ROUND',
    flight: 'BS-539',
    date: '11 AUG 2026',
    route: 'DAC-ZYL',
    timestamp: new Date().toISOString(),
    officerName: 'MUJAHIDUL ISLAM',
    officerId: '27957',
    formData: {
      date: '11 AUG 2026',
      ac: 'S2-AKH',
      bay: 'D17',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '539',
      deptRoute: 'DAC-ZYL',
      std: '1700',
      dc: '1658',
      co: '1658',
      ab: '1712',
      status: 'FLIGHT 02 MINS EARLY',
      securitySt: 'EARLIER',
      securityEnd: 'EARLIER',
      cleaningSt: 'EARLIER',
      cleaningEnd: 'EARLIER',
      cateringSt: '1616',
      cateringEnd: '1611',
      crew: '1627',
      refuel: '1616',
      lbag: '1645',
      permit: '1636',
      pax: '1651',
      trimSubmitted: '1652',
      trimSigned: '1657',
      ground: '0',
      station: 'DAC'
    }
  },
  {
    id: 'sub-115-11aug',
    type: 'DOMESTIC',
    mode: 'ROUND',
    flight: 'BS-115',
    date: '11 AUG 2026',
    route: 'DAC-CGP',
    timestamp: new Date().toISOString(),
    officerName: 'MUJAHIDUL ISLAM',
    officerId: '27957',
    formData: {
      date: '11 AUG 2026',
      ac: 'S2-AKK',
      bay: 'D16',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '115',
      deptRoute: 'DAC-CGP',
      std: '1800',
      dc: '1755',
      co: '1756',
      ab: '1807',
      status: 'FLIGHT 04 MINS EARLY',
      securitySt: 'EARLIER',
      securityEnd: 'EARLIER',
      cleaningSt: 'EARLIER',
      cleaningEnd: 'EARLIER',
      cateringSt: 'EARLIER',
      cateringEnd: 'EARLIER',
      crew: '1719',
      refuel: '1725',
      lbag: '1747',
      permit: '1730',
      pax: '1754',
      trimSubmitted: '1751',
      trimSigned: '1754',
      ground: '0',
      station: 'DAC'
    }
  },
  {
    id: 'sub-543-11aug',
    type: 'DOMESTIC',
    mode: 'ROUND',
    flight: 'BS-543',
    date: '11 AUG 2026',
    route: 'DAC-ZYL',
    timestamp: new Date().toISOString(),
    officerName: 'MUJAHIDUL ISLAM',
    officerId: '27957',
    formData: {
      date: '11 AUG 2026',
      ac: 'S2-AKK',
      bay: 'D16',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '543',
      deptRoute: 'DAC-ZYL',
      std: '2000',
      dc: '1958',
      co: '1959',
      ab: '2007',
      status: 'FLIGHT 01 MIN EARLY',
      securitySt: 'EARLIER',
      securityEnd: 'EARLIER',
      cleaningSt: '1938',
      cleaningEnd: '1941',
      cateringSt: '1941',
      cateringEnd: '1944',
      crew: 'OB',
      refuel: '1943',
      lbag: '1945',
      permit: '1944',
      pax: '1955',
      trimSubmitted: '1950',
      trimSigned: '1958',
      ground: '0',
      station: 'DAC'
    }
  },
  {
    id: 'sub-307-11aug',
    type: 'INTERNATIONAL',
    mode: 'ROUND',
    flight: 'BS-307',
    date: '11 AUG 26',
    route: 'DAC-SIN',
    timestamp: new Date().toISOString(),
    officerName: 'IKTADAR.ALINDO',
    officerId: '7473',
    formData: {
      date: '11 AUG 26',
      ac: 'HS-SXA',
      bay: 'C1A',
      arvFlt: '',
      arvRoute: '',
      con: '',
      do: '',
      disem: '',
      deptFlt: '307',
      deptRoute: 'DAC-SIN',
      std: '2230',
      dc: '2224',
      co: '2224',
      ab: 'N/A',
      status: 'FLIGHT 06 MINS EARLY',
      securitySt: 'EARLIER',
      securityEnd: 'EARLIER',
      cleaningSt: 'EARLIER',
      cleaningEnd: 'EARLIER',
      cateringSt: '2137',
      cateringEnd: '2201',
      crew: '2124',
      refuel: '2150',
      lbag: '2201',
      permit: '2202',
      pax: '2223',
      trimSubmitted: '2219',
      trimSigned: '2221',
      ground: '0',
      station: 'DAC'
    }
  },
  {
    id: 'demo-1',
    type: 'DOMESTIC',
    mode: 'ROUND',
    flight: 'BS-122',
    date: '31 JUL 26',
    route: 'JSR-DAC',
    timestamp: new Date().toISOString(),
    officerName: 'RASEL HOSSAIN',
    officerId: '0088',
    formData: {
      date: '31 JUL 26',
      ac: 'S2-AKO',
      bay: '14',
      arvFlt: '121',
      arvRoute: 'DAC-JSR',
      con: '1210',
      do: '1213',
      disem: '1218',
      deptFlt: '122',
      deptRoute: 'JSR-DAC',
      std: '1245',
      dc: '1242',
      co: '1245',
      ab: '1252',
      status: 'FLIGHT IS ONTIME',
      securitySt: '1215',
      securityEnd: '1220',
      cleaningSt: '1220',
      cleaningEnd: '1228',
      cateringSt: 'OB',
      cateringEnd: 'OB',
      crew: '1200',
      refuel: '1225',
      lbag: '1226',
      permit: '1228',
      pax: '1240',
      trimSigned: '1241',
      ground: '35',
      station: 'DAC'
    }
  },
  {
    id: 'demo-2',
    type: 'INTERNATIONAL',
    mode: 'ROUND',
    flight: 'BS-341',
    date: '31 JUL 26',
    route: 'DAC-DXB',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    officerName: 'RASEL HOSSAIN',
    officerId: '0088',
    formData: {
      date: '31 JUL 26',
      ac: 'S2-AJC',
      bay: 'C1',
      docin: '0815',
      docout: '0910',
      arvFlt: '342',
      arvRoute: 'DXB-DAC',
      con: '0800',
      do: '0805',
      disem: '0825',
      deptFlt: '341',
      deptRoute: 'DAC-DXB',
      std: '0915',
      dc: '0922',
      co: '0927',
      ab: '0940',
      status: 'FLIGHT 12 MINS DELAY',
      securitySt: '0805',
      securityEnd: '0815',
      cleaningSt: '0830',
      cleaningEnd: '0840',
      cateringSt: '0835',
      cateringEnd: '0845',
      crew: '0810',
      refuel: '0850',
      lbag: '0842',
      permit: '0848',
      pax: '0918',
      trimSigned: '0920',
      ground: '87',
      station: 'DAC'
    }
  }
];
