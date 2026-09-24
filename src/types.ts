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
  pic?: string; // Pilot In Command (PIC)
  std: string; // Scheduled Time of Departure
  dc: string; // Door Close LT
  co: string; // Chocks Off LT
  ab: string; // Airborne LT
  status: string; // ONTIME / DELAY / EARLY calculation text
  delayReason?: string; // Reason for flight delay if applicable
  delayRemarks?: string; // Manual remarks / situation details for delay

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
  firstBusPax?: string; // FIRST BUS/PAX REPORT
  pax: string; // LAST PAX ONBOARD
  trimSubmitted?: string; // TRIM SUBMITTED
  trimSigned?: string; // TRIM SIGNED

  // Additional Passenger & Baggage Fields (Outstation & Hub)
  vipPax?: string; // VIP PAX (VIP Passenger Numbers)
  vipBag?: string; // VIP BAG (Only number)
  maasPax?: string; // MAAS/PRIORITY PAX (Passenger Numbers)
  priorityBag?: string; // PRIORITY BAG (Only number)
  fireArms?: string; // FIRE ARMS (Number of fire arms)
  rushBag?: string; // RUSH BAG (Number of rush bags)
  offloadBag?: string; // OFFLOAD BAG (Optional)

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

export interface DailyAnalyticalSnapshot {
  id: string; // e.g. "SNAPSHOT_2026-08-18_DAC"
  dateIso: string; // "2026-08-18"
  dateDisplay: string; // "18 AUG 26"
  station: string; // "DAC"
  savedAt: number; // timestamp ms
  savedBy: {
    name: string;
    id: string;
  };
  expiresAt: number; // savedAt + 30 * 24 * 60 * 60 * 1000
  totalReportsCount: number;
  reportsSnapshot: SavedReport[];
  executiveAnalyticalData?: {
    totalReportsCount: number;
    delayedCount: number;
    onTimeCount: number;
    otpRate: string;
    delayRate: string;
    topDelayItem?: { code: string; count: number; flights: string[] };
    activeCategoryBreakdown?: Array<{ catName: string; count: number; pct: string }>;
    delayBreakdown?: Array<{ code: string; count: number; flights: string[] }>;
  };
  timeAnalyticalData?: {
    totalFlights: number;
    avgGround: string;
    avgSecurity: string;
    avgCleaning: string;
    avgCatering: string;
    avgBoarding: string;
  };
  crewAnalyticalData?: {
    totalFlights: number;
    lateReportCount: number;
    paxHoldCount: number;
    mostLatePicSummary?: string;
    paxHoldSummary?: string;
    latePicList?: Array<{
      rank: number;
      pic: string;
      lateMinutes: number;
      lateReport: string;
      flightNo: string;
      text: string;
    }>;
    monthlyPICSummaries?: Array<{
      captain: string;
      totalFlights: number;
      reportedLate: number;
      flightDataStr: string;
    }>;
  };
  outstationAnalyticalData?: {
    totalFlights: number;
    otpRate: string;
    avgGround: string;
    totalVipPax: number;
    totalVipBags: number;
    totalMaasPax: number;
    totalPriorityBags: number;
    totalFireArms: number;
    totalRushBags: number;
  };
}
