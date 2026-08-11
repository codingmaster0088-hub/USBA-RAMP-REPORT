export type StationCode = 'DAC' | 'CGP' | 'SPD' | 'CXB' | 'ZYL' | 'JSR' | 'RJH' | 'BZL';

export interface UserProfile {
  name: string;
  id: string;
  station: StationCode;
}

export type ActiveTab = 'live' | 'form' | 'saved' | 'admin';

export type ReportType = 'DOMESTIC' | 'INTERNATIONAL';
export type FlightMode = 'ROUND' | 'DIRECT';

export interface ScheduleFlight {
  id: string;
  flightNum: string; // e.g. "101"
  flightFull: string; // e.g. "BS-101"
  sector: string; // e.g. "CGP"
  dateStr: string; // e.g. "01AUG"
  timeStr: string; // e.g. "07:00"
  aircraft: string; // e.g. "S2-AKJ"
  paxLoad: string; // e.g. "71"
  isDeparture: boolean; // true = departure (odd), false = arrival (even)
  formattedDisplay: string; // "BS-101-CGP-S2-AKJ-71-07:00"
  rawLine?: string;
}

export interface RampReportFormData {
  // General Info
  date: string;
  ac: string; // Registration e.g. S2-AKO, HS-SXA, PK-BBG
  bay: string; // Bay No in Domestic, Gate No in Int'l
  docin?: string; // Int'l LT
  docout?: string; // Int'l LT

  // Arrival Info
  arvFlt: string; // e.g. 121
  arvRoute: string; // e.g. DAC-JSR
  con: string; // Chocks On LT
  do: string; // Door Open LT
  disem: string; // All Disembark LT

  // Departure Info
  deptFlt: string; // e.g. 122
  deptRoute: string; // e.g. JSR-DAC
  std: string; // Scheduled Time of Departure
  dc: string; // Door Close LT
  co: string; // Chocks Off LT
  ab: string; // Airborne LT
  status: string; // ONTIME / DELAY / EARLY calculation text
  delayReason?: string; // Reason for flight delay if applicable

  // Turnaround Timings (13 fields requested)
  securitySt?: string; // SECURITY CHECK ST
  securityEnd?: string; // SECURITY CHECK END
  cleaningSt?: string; // CLEANING START
  cleaningEnd?: string; // CLEANING END
  cateringSt?: string; // CATERING START
  cateringEnd?: string; // CATERING END
  crew: string; // CREW REPORT
  refuel: string; // REFUELING DONE
  lbag: string; // LAST BAGGAGE REPORT
  permit: string; // BOARDING PERMITTED
  pax: string; // LAST PAX ONBOARD
  trimSubmitted?: string; // TRIM SUBMITTED
  trimSigned?: string; // TRIM SIGNED

  // Additional Optional Baggage Fields
  priorityBag?: string; // 14. PRIORITY BAG
  vipBag?: string; // 15. VIP BAG
  offloadBag?: string; // 16. OFFLOAD BAG

  // Ground Time (Auto calculated if ROUND, "ON GROUND" if DIRECT)
  ground: string;

  station: StationCode;
}

export interface SavedReport {
  id: string;
  type: ReportType;
  mode: FlightMode;
  flight: string; // e.g. BS-122
  date: string;
  route: string;
  timestamp: string;
  createdAt?: number;
  formData: RampReportFormData;
  officerName: string;
  officerId: string;
}

export interface AdminNotice {
  id: string;
  message: string;
  timestamp: string;
  author: string;
  authorName?: string;
  authorId?: string;
  createdAt?: number;
}

export type UserActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SAVE_REPORT'
  | 'UPDATE_SCHEDULE'
  | 'BROADCAST_NOTICE'
  | 'DELETE_REPORT'
  | 'OTHER';

export interface UserLog {
  id: string;
  timestamp: string;
  createdAt: number;
  userName: string;
  userId: string;
  station: StationCode;
  action: UserActionType;
  details: string;
}

export interface TurnaroundMilestone {
  key: string;
  label: string;
  time: string;
  status: 'pending' | 'active' | 'completed';
}
