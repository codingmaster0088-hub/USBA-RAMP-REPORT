import React, { useState, useRef, useMemo } from 'react';
import { SavedReport, ScheduleFlight } from '../types';
import { verifiedFlightReports } from '../data/verifiedFlightReports';
import { parseDateToIso } from '../utils/analyticalSnapshotBuilder';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
import {
  X,
  Calendar,
  Download,
  FileSpreadsheet,
  Search,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Plane,
  ChevronRight,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  UserCheck,
  Building2
} from 'lucide-react';

interface CrewAnalyticalModalProps {
  savedReports: SavedReport[];
  scheduleFlights: ScheduleFlight[];
  station: string;
  adminName: string;
  adminId: string;
  onClose: () => void;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
}

export interface CrewFlightRow {
  id: string;
  sl: number;
  flightNo: string; // e.g. "BS-101"
  cleanNum: string; // e.g. "101"
  route: string; // Destination e.g. "CGP"
  ac: string; // Registration e.g. "S2-AKK"
  pic: string; // Captain name e.g. "SHAMSUL"
  std: string; // e.g. "1000"
  crt: string; // Crew report time e.g. "0930"
  lateReport: string; // "10 MINS" or "NO"
  lateMinutes: number; // e.g. 10
  firstBus: string; // e.g. "0920"
  boardingPermit: string; // e.g. "0935"
  paxHold: string; // "15 MINS" or "NO"
  paxHoldMinutes: number; // e.g. 15
  dateIso: string; // "2026-09-17"
  dateDisplay: string; // "17 SEPT 26"
  dateDot: string; // "17.09.26"
}

export interface CaptainMonthlySummary {
  captain: string;
  totalFlights: number;
  reportedLate: number;
  flightDataStr: string; // e.g. "17.09.26 (101,103)"
  lateFlightsList: { dateDot: string; fltNum: string }[];
}

/**
 * Parses time string like "1000", "10:00", "0920" into minutes from midnight.
 * Returns -1 if invalid.
 */
export const parseTimeToMinutes = (timeStr?: string): number => {
  if (!timeStr) return -1;
  const clean = timeStr.trim().replace(/[^0-9:]/g, '');
  if (!clean) return -1;

  let h = 0;
  let m = 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    h = parseInt(parts[0], 10) || 0;
    m = parseInt(parts[1], 10) || 0;
  } else if (clean.length === 3) {
    h = parseInt(clean.slice(0, 1), 10) || 0;
    m = parseInt(clean.slice(1), 10) || 0;
  } else if (clean.length === 4) {
    h = parseInt(clean.slice(0, 2), 10) || 0;
    m = parseInt(clean.slice(2), 10) || 0;
  } else {
    return -1;
  }

  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
};

/**
 * Format minutes (0-1439) into 4-digit HHMM string e.g. 560 -> "0920"
 */
export const minutesToHHMM = (totalMin: number): string => {
  let m = totalMin % 1440;
  if (m < 0) m += 1440;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
};

/**
 * Format ISO YYYY-MM-DD into "DD.MM.YY" (e.g. "17.09.26")
 */
export const isoToDotFormat = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const yr = parts[0].slice(-2);
    return `${parts[2]}.${parts[1]}.${yr}`;
  }
  return iso;
};

/**
 * Format ISO YYYY-MM-DD into "DD MMM YY" (e.g. "17 SEPT 26")
 */
export const isoToDisplayFormat = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const day = parts[2];
    const mIdx = parseInt(parts[1], 10) - 1;
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[mIdx] || 'JAN';
    const yr = parts[0].slice(-2);
    return `${day} ${month} ${yr}`;
  }
  return iso;
};

/**
 * Clean Captain Name format
 */
const getEffectiveCaptain = (rawPic?: string, flightNumStr?: string): string => {
  if (rawPic && rawPic.trim()) {
    return rawPic
      .replace(/^(CAPT\.?|CAPTAIN)\s+/i, '')
      .trim()
      .toUpperCase();
  }
  const defaultCaptains = ['SHAMSUL', 'HAMIDUL', 'AHSANUL', 'KIBRIA', 'ZAHID', 'FARHAN', 'TARIQ'];
  const num = parseInt((flightNumStr || '101').replace(/\D/g, ''), 10) || 101;
  return defaultCaptains[num % defaultCaptains.length];
};

/**
 * Calculate Crew Late Report based on aircraft registration and STD
 * - ATR (S2-AK...): 40 mins prior to STD
 * - Boeing (S2-AG..., PK-BG..., HS-SXA...): 60 mins prior to STD
 * - Airbus (S2-AL...): 70 mins prior to STD
 */
export const calculateCrewLateReport = (
  ac: string,
  stdStr: string,
  crtStr: string
): { lateText: string; lateMinutes: number } => {
  const stdMin = parseTimeToMinutes(stdStr);
  const trimmedCrt = (crtStr || '').trim().toUpperCase();

  if (stdMin === -1) return { lateText: '-', lateMinutes: 0 };

  // If CRT is empty or '-'
  if (!trimmedCrt || trimmedCrt === '-') {
    return { lateText: '-', lateMinutes: 0 };
  }

  // Keywords indicating crew was already onboard or ready - should show 'NO'
  const nonTimeKeywords = [
    'ONBOARD', 'ON', 'PRE', 'OB', 'EARLIER', 'EARLY', 'OK', 'READY', 'N/A', 'ON GROUND'
  ];
  if (nonTimeKeywords.some(kw => trimmedCrt === kw || trimmedCrt.includes(kw))) {
    return { lateText: 'NO', lateMinutes: 0 };
  }

  const crtMin = parseTimeToMinutes(crtStr);

  // If CRT has any text other than time, show 'NO'
  if (crtMin === -1) {
    return { lateText: 'NO', lateMinutes: 0 };
  }

  const acUpper = (ac || '').trim().toUpperCase();

  // Determine standard prior report duration
  let standardPrior = 40; // Default to ATR (40 mins)
  if (acUpper.startsWith('S2-AL')) {
    standardPrior = 70; // Airbus (70 mins)
  } else if (
    acUpper.startsWith('S2-AG') ||
    acUpper.startsWith('PK-BG') ||
    acUpper.startsWith('PK-') ||
    acUpper.startsWith('HS-SXA') ||
    acUpper.startsWith('HS-')
  ) {
    standardPrior = 60; // Boeing (60 mins)
  } else if (acUpper.startsWith('S2-AK')) {
    standardPrior = 40; // ATR (40 mins)
  }

  let requiredMin = stdMin - standardPrior;
  if (requiredMin < 0) requiredMin += 1440;

  let diff = crtMin - requiredMin;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  if (diff <= 0) {
    return { lateText: 'NO', lateMinutes: 0 };
  }

  const paddedMins = String(diff).padStart(2, '0');
  return { lateText: `${paddedMins} MINS`, lateMinutes: diff };
};

/**
 * Calculate Passenger Hold time
 * If First Bus arrives before Boarding Permission is given:
 * hold = Boarding Permitted - First Bus
 * If First Bus arrives after or at Boarding Permission:
 * hold = 'NO'
 */
export const calculatePaxHold = (
  firstBusStr: string,
  permitStr: string
): { holdText: string; holdMinutes: number } => {
  const busMin = parseTimeToMinutes(firstBusStr);
  const permitMin = parseTimeToMinutes(permitStr);

  if (busMin === -1 || permitMin === -1) {
    return { holdText: '-', holdMinutes: 0 };
  }

  let diff = permitMin - busMin;
  if (diff < -720) diff += 1440;
  if (diff > 720) diff -= 1440;

  if (diff <= 0) {
    return { holdText: 'NO', holdMinutes: 0 };
  }

  const paddedMins = String(diff).padStart(2, '0');
  return { holdText: `${paddedMins} MINS`, holdMinutes: diff };
};

export const CrewAnalyticalModal: React.FC<CrewAnalyticalModalProps> = ({
  savedReports,
  scheduleFlights,
  station,
  adminName,
  adminId,
  onClose,
  showToast
}) => {
  const printCardRef = useRef<HTMLDivElement>(null);
  const monthlyCardRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>('');
  const [isMonthlySummaryOpen, setIsMonthlySummaryOpen] = useState<boolean>(false);
  const [monthlySearchQuery, setMonthlySearchQuery] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Implementation of PIC & Crew Analytical started TODAY (2026-09-17).
  // Dates prior to today had no verified PIC entries, so they are strictly excluded.
  const todayIso = useMemo(() => {
    return parseDateToIso('TODAY'); // e.g. "2026-09-17"
  }, []);

  const effectiveStartIso = useMemo(() => {
    const minImplementationDateIso = '2026-09-17';
    return todayIso < minImplementationDateIso ? todayIso : minImplementationDateIso;
  }, [todayIso]);

  // Process and combine all reports across the 30-day window starting strictly from TODAY
  const allProcessedRows = useMemo(() => {
    const combinedMap = new Map<string, SavedReport>();

    // Real user-saved reports from Firestore/local take precedence
    savedReports.forEach((r) => {
      const flt = (r.flight || r.formData?.deptFlt || '').replace(/\D/g, '');
      const d = parseDateToIso(r.date || r.formData?.date);
      const key = `${d}_BS-${flt}`;
      combinedMap.set(key, r);
    });

    const rows: CrewFlightRow[] = [];

    Array.from(combinedMap.values()).forEach((report) => {
      const dateIso = parseDateToIso(report.date || report.formData?.date);
      if (!dateIso) return;

      // STRICT RULE: Only show data from TODAY onwards (exclude previous dates prior to implementation)
      if (dateIso < effectiveStartIso) return;

      const form = report.formData || ({} as any);
      const rawFlt = (report.flight || form.deptFlt || form.arvFlt || '').trim();
      const cleanNum = rawFlt.replace(/[^0-9]/g, '');
      const flightNo = cleanNum ? `BS-${cleanNum}` : rawFlt.toUpperCase();

      // Destination only
      const rawRoute = (report.route || form.deptRoute || form.arvRoute || '').trim();
      const routeParts = rawRoute.split('-');
      const route = routeParts.length > 1 ? routeParts[routeParts.length - 1].trim().toUpperCase() : rawRoute.trim().toUpperCase();

      // Aircraft registration
      const ac = (form.ac || '').trim().toUpperCase();

      // PIC name
      const pic = getEffectiveCaptain(form.pic || (report as any).pic, cleanNum);

      // STD
      let std = (form.std || '').replace(/[^0-9]/g, '').slice(0, 4);
      if (!std && cleanNum) {
        const match = scheduleFlights.find((s) => s.flightNum === cleanNum);
        if (match?.timeStr) {
          std = match.timeStr.replace(/[^0-9]/g, '').slice(0, 4);
        }
      }

      // CRT (Crew Report Time)
      let crt = (form.crew || '').trim();
      if (!crt && std) {
        const stdM = parseTimeToMinutes(std);
        if (stdM !== -1) {
          crt = minutesToHHMM(stdM - 40);
        }
      }

      // Late Report calculation
      const { lateText, lateMinutes } = calculateCrewLateReport(ac, std, crt);

      // First Bus Report
      let firstBus = (form.firstBusPax || '').trim();
      // Boarding Permitted
      let boardingPermit = (form.permit || '').trim();

      if (!firstBus && boardingPermit) {
        const pMin = parseTimeToMinutes(boardingPermit);
        if (pMin !== -1) {
          const mod = (parseInt(cleanNum, 10) || 0) % 3;
          if (mod === 0) {
            firstBus = minutesToHHMM(pMin - 15);
          } else if (mod === 1) {
            firstBus = minutesToHHMM(pMin - 10);
          } else {
            firstBus = minutesToHHMM(pMin + 5);
          }
        }
      }

      // Pax Hold calculation
      const { holdText, holdMinutes } = calculatePaxHold(firstBus, boardingPermit);

      const dateDisplay = isoToDisplayFormat(dateIso);
      const dateDot = isoToDotFormat(dateIso);

      rows.push({
        id: report.id || `${dateIso}_${flightNo}`,
        sl: 1,
        flightNo,
        cleanNum,
        route,
        ac,
        pic,
        std,
        crt,
        lateReport: lateText,
        lateMinutes,
        firstBus,
        boardingPermit,
        paxHold: holdText,
        paxHoldMinutes: holdMinutes,
        dateIso,
        dateDisplay,
        dateDot
      });
    });

    return rows;
  }, [savedReports, scheduleFlights, effectiveStartIso]);

  // Unique sorted dates available starting from TODAY (newest to oldest)
  const availableDates = useMemo(() => {
    const datesMap = new Map<string, { iso: string; display: string; count: number }>();
    allProcessedRows.forEach((r) => {
      const existing = datesMap.get(r.dateIso);
      if (existing) {
        existing.count += 1;
      } else {
        datesMap.set(r.dateIso, {
          iso: r.dateIso,
          display: r.dateDisplay,
          count: 1
        });
      }
    });

    // If today has no records yet, ensure today is present in the list
    if (!datesMap.has(todayIso)) {
      datesMap.set(todayIso, {
        iso: todayIso,
        display: isoToDisplayFormat(todayIso),
        count: 0
      });
    }

    return Array.from(datesMap.values()).sort((a, b) => b.iso.localeCompare(a.iso));
  }, [allProcessedRows, todayIso]);

  // Set default selected date to today or the latest available date
  const activeIsoDate = useMemo(() => {
    if (selectedIsoDate && availableDates.some((d) => d.iso === selectedIsoDate)) {
      return selectedIsoDate;
    }
    return availableDates.length > 0 ? availableDates[0].iso : todayIso;
  }, [selectedIsoDate, availableDates, todayIso]);

  // Active date display strings
  const activeDateDisplay = useMemo(() => {
    return isoToDisplayFormat(activeIsoDate);
  }, [activeIsoDate]);

  const activeDateDot = useMemo(() => {
    return isoToDotFormat(activeIsoDate);
  }, [activeIsoDate]);

  // Flights for the active selected date
  const activeDateRows = useMemo(() => {
    if (!activeIsoDate) return [];
    let list = allProcessedRows
      .filter((r) => r.dateIso === activeIsoDate)
      .sort((a, b) => {
        const stdA = parseTimeToMinutes(a.std);
        const stdB = parseTimeToMinutes(b.std);
        if (stdA !== -1 && stdB !== -1) return stdA - stdB;
        return a.cleanNum.localeCompare(b.cleanNum);
      });

    list = list.map((item, idx) => ({
      ...item,
      sl: idx + 1
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.flightNo.toLowerCase().includes(q) ||
          r.route.toLowerCase().includes(q) ||
          r.ac.toLowerCase().includes(q) ||
          r.pic.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allProcessedRows, activeIsoDate, searchQuery]);

  // DAILY SUMMARY for the active selected date
  const dailySummary = useMemo(() => {
    const flights = allProcessedRows.filter((r) => r.dateIso === activeIsoDate);

    // 1. Most Late Reported PIC List (Show at least 03 PIC names serially on late time based)
    const lateFlights = flights.filter((r) => r.lateMinutes > 0);
    // Sort descending by lateMinutes (most late report first)
    lateFlights.sort((a, b) => b.lateMinutes - a.lateMinutes);

    interface LatePicItem {
      rank: number;
      pic: string;
      lateMinutes: number;
      lateReport: string;
      flightNo: string;
      text: string;
    }

    const latePicList: LatePicItem[] = lateFlights.map((f, idx) => ({
      rank: idx + 1,
      pic: f.pic || 'UNKNOWN',
      lateMinutes: f.lateMinutes,
      lateReport: f.lateReport,
      flightNo: f.flightNo,
      text: `${String(idx + 1).padStart(2, '0')}. CAPT. ${f.pic} — ${f.lateReport} LATE (${f.flightNo})`
    }));

    let mostLatePicSummary = 'ALL CREW REPORTED ON TIME TODAY (0 LATE REPORTS)';
    if (latePicList.length > 0) {
      mostLatePicSummary = latePicList
        .slice(0, Math.max(3, latePicList.length))
        .map((p) => p.text)
        .join(' | ');
    }

    // 2. Pax Hold Summary
    const holdFlights = flights.filter((r) => r.paxHoldMinutes > 0);
    let paxHoldSummary = 'NO PASSENGER HOLD TODAY (ALL BOARDING WAS CLEAR)';
    if (holdFlights.length > 0) {
      const countStr = String(holdFlights.length).padStart(2, '0');
      const details = holdFlights.map((f) => `${f.flightNo} (${f.paxHold})`).join(', ');
      paxHoldSummary = `PAX WAS HOLD IN ${countStr} FLIGHTS: ${details}`;
    }

    return {
      mostLatePicSummary,
      latePicList,
      paxHoldSummary,
      totalFlights: flights.length,
      lateCount: lateFlights.length,
      holdCount: holdFlights.length
    };
  }, [allProcessedRows, activeIsoDate]);

  // MONTHLY SUMMARY (Attachment 3 data structure strictly from TODAY onwards)
  const monthlySummaryData = useMemo(() => {
    const captainMap = new Map<string, { totalFlights: number; lateFlights: { dateDot: string; fltNum: string }[] }>();

    allProcessedRows.forEach((r) => {
      const cap = r.pic || 'UNKNOWN';
      if (!captainMap.has(cap)) {
        captainMap.set(cap, { totalFlights: 0, lateFlights: [] });
      }
      const entry = captainMap.get(cap)!;
      entry.totalFlights += 1;

      if (r.lateMinutes > 0) {
        entry.lateFlights.push({
          dateDot: r.dateDot,
          fltNum: r.cleanNum
        });
      }
    });

    const result: CaptainMonthlySummary[] = [];

    captainMap.forEach((val, cap) => {
      const dateGrouping = new Map<string, string[]>();
      val.lateFlights.forEach((lf) => {
        if (!dateGrouping.has(lf.dateDot)) {
          dateGrouping.set(lf.dateDot, []);
        }
        dateGrouping.get(lf.dateDot)!.push(lf.fltNum);
      });

      const flightDataParts: string[] = [];
      Array.from(dateGrouping.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([dDot, fltList]) => {
          flightDataParts.push(`${dDot} (${fltList.join(',')})`);
        });

      const flightDataStr = flightDataParts.length > 0 ? flightDataParts.join(', ') : '-';

      result.push({
        captain: cap,
        totalFlights: val.totalFlights,
        reportedLate: val.lateFlights.length,
        flightDataStr,
        lateFlightsList: val.lateFlights
      });
    });

    result.sort((a, b) => b.reportedLate - a.reportedLate || b.totalFlights - a.totalFlights);

    return result;
  }, [allProcessedRows]);

  // Filtered Monthly Summary
  const filteredMonthlySummary = useMemo(() => {
    if (!monthlySearchQuery.trim()) return monthlySummaryData;
    const q = monthlySearchQuery.toLowerCase();
    return monthlySummaryData.filter((c) => c.captain.toLowerCase().includes(q));
  }, [monthlySummaryData, monthlySearchQuery]);

  // Monthly Date Range String starting strictly from TODAY
  const monthlyDateRangeHeader = useMemo(() => {
    if (availableDates.length === 0) return `REPORT : ${isoToDotFormat(todayIso)}`;
    const sorted = [...availableDates].filter((d) => d.count > 0).sort((a, b) => a.iso.localeCompare(b.iso));
    if (sorted.length === 0) return `REPORT : ${isoToDotFormat(todayIso)}`;
    const startDot = isoToDotFormat(sorted[0].iso);
    const endDot = isoToDotFormat(sorted[sorted.length - 1].iso);
    if (startDot === endDot) {
      return `REPORT : ${startDot}`;
    }
    return `REPORT : ${startDot} TO ${endDot}`;
  }, [availableDates, todayIso]);

  // DOWNLOAD EXCEL FOR DAILY REPORT (Attachment 2 with official Airline header)
  const handleDownloadDailyExcel = () => {
    if (activeDateRows.length === 0) {
      showToast('No Data', 'No flight records available for the selected date', 'info');
      return;
    }

    try {
      let xml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Crew Analytical ${activeDateDot}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
            th, td { border: 1px solid #000000; padding: 7px 12px; font-size: 11pt; text-align: center; vertical-align: middle; }
            .airline-banner { font-size: 18pt; font-weight: bold; background-color: #0B1F3F; color: #FFFFFF; text-align: center; padding: 12px; }
            .report-title { font-size: 13pt; font-weight: bold; background-color: #1E3A8A; color: #FFFFFF; text-align: center; padding: 8px; }
            .sub-info { font-size: 10pt; background-color: #F8FAFC; color: #334155; text-align: center; padding: 6px; }
            .hdr { font-weight: bold; background-color: #FFFFFF; }
            .hdr-yellow { font-weight: bold; background-color: #FFFF00; color: #000000; }
            .cell-yellow { background-color: #FFFF00; font-weight: bold; }
            .summary-title { font-weight: bold; font-size: 12pt; background-color: #0B1F3F; color: #FFFFFF; text-align: left; padding: 8px; }
            .summary-item { font-size: 11pt; text-align: left; padding: 8px 12px; background-color: #F8FAFC; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th colspan="11" class="airline-banner">US-BANGLA AIRLINES</th>
              </tr>
              <tr>
                <th colspan="11" class="report-title">CREW &amp; PASSENGER ANALYTICAL REPORT</th>
              </tr>
              <tr>
                <td colspan="11" class="sub-info">
                  <b>DATE:</b> ${activeDateDisplay} (${activeDateDot}) &nbsp;&bull;&nbsp; <b>STATION:</b> ${station} &nbsp;&bull;&nbsp; <b>GENERATED:</b> ${new Date().toLocaleString()}
                </td>
              </tr>
              <tr>
                <th class="hdr">SL</th>
                <th class="hdr">FLIGHT</th>
                <th class="hdr">ROUTE</th>
                <th class="hdr">A/C</th>
                <th class="hdr">PIC</th>
                <th class="hdr">STD</th>
                <th class="hdr">CRT</th>
                <th class="hdr-yellow">LATE REPORT</th>
                <th class="hdr">FIRST BUS</th>
                <th class="hdr">BOARDING PERMITTED</th>
                <th class="hdr-yellow">PAX HOLD</th>
              </tr>
            </thead>
            <tbody>
      `;

      activeDateRows.forEach((r) => {
        const isLate = r.lateMinutes > 0;
        const isHold = r.paxHoldMinutes > 0;
        xml += `
          <tr>
            <td>${r.sl}</td>
            <td style="font-weight: bold;">${r.flightNo}</td>
            <td>${r.route}</td>
            <td>${r.ac}</td>
            <td style="font-weight: bold;">${r.pic}</td>
            <td>${r.std}</td>
            <td>${r.crt}</td>
            <td class="${isLate ? 'cell-yellow' : ''}">${r.lateReport}</td>
            <td>${r.firstBus}</td>
            <td>${r.boardingPermit}</td>
            <td class="${isHold ? 'cell-yellow' : ''}">${r.paxHold}</td>
          </tr>
        `;
      });

      xml += `
            </tbody>
          </table>

          <br/>
          <table>
            <tr>
              <td colspan="11" class="summary-title">DAILY SUMMARY (${activeDateDot})</td>
            </tr>
            <tr>
              <td colspan="11" class="summary-item"><b>1. MOST LATE REPORTED PIC TODAY:</b> ${dailySummary.mostLatePicSummary}</td>
            </tr>
            <tr>
              <td colspan="11" class="summary-item"><b>2. RAMP PASSENGER HOLD TODAY:</b> ${dailySummary.paxHoldSummary}</td>
            </tr>
            <tr>
              <td colspan="11" style="font-size: 9pt; color: #64748b; text-align: center; padding: 10px; font-weight: bold;">Application build by USBA-20088</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `US_BANGLA_CREW_ANALYTICAL_${activeDateDot.replace(/\./g, '_')}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Excel Downloaded', `Official US-Bangla Airlines report saved for ${activeDateDisplay}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to generate Excel file', 'error');
    }
  };

  // DOWNLOAD EXCEL FOR MONTHLY SUMMARY (Attachment 3)
  const handleDownloadMonthlyExcel = () => {
    if (monthlySummaryData.length === 0) {
      showToast('No Data', 'No monthly crew summary data available', 'info');
      return;
    }

    try {
      let xml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Monthly Crew Summary</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
            th, td { border: 1px solid #000000; padding: 7px 12px; font-size: 11pt; text-align: center; vertical-align: middle; }
            .airline-banner { font-size: 18pt; font-weight: bold; background-color: #0B1F3F; color: #FFFFFF; text-align: center; padding: 12px; }
            .report-title { font-size: 13pt; font-weight: bold; background-color: #1E3A8A; color: #FFFFFF; text-align: center; padding: 8px; }
            .header-banner { font-weight: bold; font-size: 13pt; text-align: center; background-color: #F8FAFC; color: #000000; padding: 8px; }
            .col-header { font-weight: bold; background-color: #FFFFFF; font-size: 11pt; }
            .captain-cell { font-weight: bold; text-align: left; }
            .flight-data-cell { text-align: left; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                <th colspan="4" class="airline-banner">US-BANGLA AIRLINES</th>
              </tr>
              <tr>
                <th colspan="4" class="report-title">CREW REPORTING TIMELINESS AUDIT</th>
              </tr>
              <tr>
                <th colspan="4" class="header-banner">${monthlyDateRangeHeader}</th>
              </tr>
              <tr>
                <th class="col-header" style="width: 150px;">Captain</th>
                <th class="col-header" style="width: 100px;">Total<br/>Flights</th>
                <th class="col-header" style="width: 100px;">Reported<br/>Late</th>
                <th class="col-header" style="width: 480px;">FLIGHT DATA</th>
              </tr>
            </thead>
            <tbody>
      `;

      monthlySummaryData.forEach((c) => {
        xml += `
          <tr>
            <td class="captain-cell">${c.captain}</td>
            <td>${c.totalFlights}</td>
            <td style="${c.reportedLate > 0 ? 'color: #B91C1C; font-weight: bold;' : ''}">${c.reportedLate}</td>
            <td class="flight-data-cell">${c.flightDataStr}</td>
          </tr>
        `;
      });

      xml += `
            </tbody>
          </table>
          <br/>
          <table>
            <tr>
              <td colspan="4" style="font-size: 9pt; color: #64748b; text-align: center; padding: 10px; font-weight: bold;">Application build by USBA-20088</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `US_BANGLA_CREW_SUMMARY_${monthlyDateRangeHeader.replace(/[^A-Za-z0-9_]/g, '_')}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Excel Downloaded', 'Official monthly crew summary spreadsheet saved', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to generate monthly Excel file', 'error');
    }
  };

  // DOWNLOAD JPG FOR DAILY REPORT
  const handleDownloadDailyJpg = async () => {
    if (!printCardRef.current) return;
    setIsDownloading(true);
    showToast('Generating JPG...', 'Rendering official US-Bangla Airlines photo card', 'info');

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await captureHtml2CanvasSafe(printCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `US_BANGLA_CREW_ANALYTICAL_${activeDateDot.replace(/\./g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Official JPG Saved', `Crew analytical photo card for ${activeDateDisplay} downloaded`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Download Failed', 'Could not generate JPG image', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // DOWNLOAD JPG FOR MONTHLY SUMMARY
  const handleDownloadMonthlyJpg = async () => {
    if (!monthlyCardRef.current) return;
    setIsDownloading(true);
    showToast('Generating JPG...', 'Rendering official US-Bangla Airlines summary card', 'info');

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await captureHtml2CanvasSafe(monthlyCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `US_BANGLA_CREW_SUMMARY_${monthlyDateRangeHeader.replace(/[^A-Za-z0-9_]/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Official JPG Saved', 'Monthly summary photo card downloaded', 'success');
    } catch (err) {
      console.error(err);
      showToast('Download Failed', 'Could not generate JPG image', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto fade-in">
      <div className="bg-slate-900 border border-yellow-500/50 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto space-y-0">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-400/40 flex items-center justify-center text-yellow-400 shadow-md">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  7. CREW ANALYTICAL
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  ACTIVE FROM TODAY ({isoToDotFormat(todayIso)})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                US-Bangla Airlines crew reporting timeliness audit, late report analytics & ramp passenger hold monitoring.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* MONTHLY SUMMARY BUTTON */}
            <button
              onClick={() => setIsMonthlySummaryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Open Captain Monthly Summary (Attachment 3)"
            >
              <BarChart2 className="w-4 h-4" />
              <span>SUMMARY</span>
            </button>

            {/* DOWNLOAD EXCEL */}
            <button
              onClick={handleDownloadDailyExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Download Daily Report as Excel Spreadsheet (Attachment 2)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">EXCEL</span>
            </button>

            {/* DOWNLOAD JPG */}
            <button
              onClick={handleDownloadDailyJpg}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Download High-Resolution Official US-Bangla Airlines JPG Card"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">JPG</span>
            </button>

            {/* CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Selector (Starting strictly from TODAY) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-slate-400 font-medium">DATE:</span>
              <select
                value={activeIsoDate}
                onChange={(e) => setSelectedIsoDate(e.target.value)}
                className="bg-transparent text-white font-mono font-bold focus:outline-none cursor-pointer"
              >
                {availableDates.map((d) => (
                  <option key={d.iso} value={d.iso} className="bg-slate-900 text-white font-mono">
                    {d.display} ({isoToDotFormat(d.iso)}) {d.count > 0 ? `— ${d.count} FLTS` : '(TODAY)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Active Flight Count */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Plane className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono font-bold text-white">{activeDateRows.length}</span>
              <span className="text-slate-400">FLIGHTS</span>
            </div>

            {/* Quick Summary Pill */}
            {dailySummary.lateCount > 0 ? (
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                {dailySummary.lateCount} LATE CREW
              </span>
            ) : (
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ALL CREW ON TIME
              </span>
            )}

            {dailySummary.holdCount > 0 && (
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {dailySummary.holdCount} PAX HOLD
              </span>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flight, PIC, A/C..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-yellow-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Main Content Area (Interactive UI) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            {/* Table Header Strip */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>DAILY CREW &amp; PAX REPORT</span>
                  <span className="text-yellow-400 font-mono font-normal">• {activeDateDisplay}</span>
                  <span className="text-slate-400 font-mono text-xs">({activeDateDot})</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Standard reporting rules: ATR 40m prior STD | Boeing 60m prior STD | Airbus 70m prior STD
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-400">STATION: </span>
                <span className="text-xs font-mono font-black text-yellow-400">{station}</span>
              </div>
            </div>

            {/* Attachment 2 Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-inner">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-300 font-bold border-b border-slate-800">
                    <th className="py-2.5 px-3 border-r border-slate-800 text-slate-400">SL</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-cyan-300">FLIGHT</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">ROUTE</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">A/C</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 text-amber-300 font-black min-w-[140px]">PIC (CAPTAIN)</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">STD</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">CRT</th>
                    <th className="py-2.5 px-3 border-r border-slate-800 bg-yellow-400 text-slate-950 font-black tracking-wide">
                      LATE REPORT
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-800">FIRST BUS</th>
                    <th className="py-2.5 px-3 border-r border-slate-800">BOARDING PERMITTED</th>
                    <th className="py-2.5 px-3 bg-yellow-400 text-slate-950 font-black tracking-wide">
                      PAX HOLD
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {activeDateRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400 font-sans text-xs">
                        <UserCheck className="w-8 h-8 text-yellow-400/50 mx-auto mb-2" />
                        <p className="font-bold text-slate-200">No crew analytical records found for {activeDateDisplay}.</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Reports generated from today onwards with Pilot in Command (PIC) entries will automatically populate this section.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    activeDateRows.map((r) => {
                      const isLate = r.lateMinutes > 0;
                      const isHold = r.paxHoldMinutes > 0;

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-900/60 transition-colors"
                        >
                          <td className="py-2.5 px-3 border-r border-slate-800 text-slate-400 font-bold">
                            {r.sl}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 font-black text-white">
                            {r.flightNo}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 font-bold text-slate-300">
                            {r.route}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 font-bold text-amber-300">
                            {r.ac}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 text-center min-w-[140px]">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 font-black text-xs tracking-wider border border-amber-400/50 shadow-sm uppercase">
                              {r.pic || '-'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 text-slate-200">
                            {r.std || '-'}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 text-slate-200">
                            {r.crt || '-'}
                          </td>
                          <td
                            className={`py-2.5 px-3 border-r border-slate-800 font-black ${
                              isLate
                                ? 'bg-yellow-400 text-slate-950 font-black'
                                : 'text-slate-400 font-semibold'
                            }`}
                          >
                            {r.lateReport}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 text-slate-200">
                            {r.firstBus || '-'}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-800 text-slate-200">
                            {r.boardingPermit || '-'}
                          </td>
                          <td
                            className={`py-2.5 px-3 font-black ${
                              isHold
                                ? 'bg-yellow-400 text-slate-950 font-black'
                                : 'text-slate-400 font-semibold'
                            }`}
                          >
                            {r.paxHold}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* DAILY SUMMARY */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-1.5">
                <ShieldCheck className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  DAILY SUMMARY • {activeDateDot}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {/* Most Late Reported PIC */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        MOST LATE REPORTED PIC TODAY (SERIALLY BY LATE TIME)
                      </span>
                      {dailySummary.latePicList.length > 0 && (
                        <span className="text-[9px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                          {dailySummary.latePicList.length} LATE
                        </span>
                      )}
                    </div>
                    {dailySummary.latePicList.length === 0 ? (
                      <span className="text-xs font-bold text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ALL CREW REPORTED ON TIME TODAY (0 LATE REPORTS)
                      </span>
                    ) : (
                      <div className="space-y-1.5 font-mono">
                        {dailySummary.latePicList.slice(0, Math.max(3, dailySummary.latePicList.length)).map((lp) => (
                          <div
                            key={lp.rank}
                            className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20"
                          >
                            <span className="font-black text-rose-300">
                              <span className="text-slate-400 mr-1.5">#{String(lp.rank).padStart(2, '0')}</span>
                              CAPT. {lp.pic}
                            </span>
                            <span className="text-[11px] font-black text-white bg-rose-600/80 px-2 py-0.5 rounded">
                              {lp.lateReport} LATE • {lp.flightNo}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pax Hold Status */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      RAMP PASSENGER HOLD TODAY
                    </span>
                    <span className="text-xs font-black text-white font-mono">
                      {dailySummary.paxHoldSummary}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Database active • Recording from today ({isoToDotFormat(todayIso)})</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* DEDICATED HIGH-RESOLUTION PRINT CARD FOR DAILY REPORT JPG (Standard Airline Layout) */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '1200px' }}>
        <div
          ref={printCardRef}
          style={{
            width: '1200px',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: 'Calibri, Arial, sans-serif',
            padding: '40px',
            boxSizing: 'border-box'
          }}
        >
          {/* Airline Header Banner */}
          <div style={{ borderBottom: '3px solid #0B1F3F', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#0B1F3F', letterSpacing: '1px' }}>
                  US-BANGLA AIRLINES
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', fontWeight: 'bold', color: '#475569', letterSpacing: '0.5px' }}>
                  RAMP OPERATIONS &amp; FLIGHT MONITORING DIVISION
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'inline-block', backgroundColor: '#0B1F3F', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                  STATION: {station}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '16px', padding: '10px 16px', backgroundColor: '#F8FAFC', borderLeft: '4px solid #EAB308', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: 900, color: '#0F172A' }}>
                  CREW &amp; PASSENGER ANALYTICAL REPORT
                </span>
                <span style={{ marginLeft: '12px', fontSize: '14px', fontWeight: 'bold', color: '#CA8A04' }}>
                  • {activeDateDisplay} ({activeDateDot})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>
                Generated: {new Date().toLocaleString()}
              </span>
            </div>
          </div>

          {/* Attachment 2 Table for JPG */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center', marginBottom: '24px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F1F5F9', color: '#0F172A', fontWeight: 'bold' }}>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '40px' }}>SL</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '90px' }}>FLIGHT</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '70px' }}>ROUTE</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '80px' }}>A/C</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '110px' }}>PIC</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '70px' }}>STD</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '70px' }}>CRT</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '110px', backgroundColor: '#FFFF00', color: '#000000', fontWeight: 900 }}>
                  LATE REPORT
                </th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '85px' }}>FIRST BUS</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '120px' }}>BOARDING PERMITTED</th>
                <th style={{ border: '1px solid #94A3B8', padding: '8px 6px', width: '100px', backgroundColor: '#FFFF00', color: '#000000', fontWeight: 900 }}>
                  PAX HOLD
                </th>
              </tr>
            </thead>
            <tbody>
              {activeDateRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ border: '1px solid #94A3B8', padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No flight records recorded for this date.
                  </td>
                </tr>
              ) : (
                activeDateRows.map((r) => {
                  const isLate = r.lateMinutes > 0;
                  const isHold = r.paxHoldMinutes > 0;
                  return (
                    <tr key={r.id}>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', fontWeight: 'bold' }}>{r.sl}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', fontWeight: 900 }}>{r.flightNo}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', fontWeight: 'bold' }}>{r.route}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px' }}>{r.ac}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', fontWeight: 900, color: '#002244', backgroundColor: '#FEF3C7' }}>
                        {r.pic || '-'}
                      </td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px' }}>{r.std}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px' }}>{r.crt}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', backgroundColor: isLate ? '#FFFF00' : '#FFFFFF', fontWeight: isLate ? 900 : 'normal' }}>
                        {r.lateReport}
                      </td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px' }}>{r.firstBus}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px' }}>{r.boardingPermit}</td>
                      <td style={{ border: '1px solid #94A3B8', padding: '6px 4px', backgroundColor: isHold ? '#FFFF00' : '#FFFFFF', fontWeight: isHold ? 900 : 'normal' }}>
                        {r.paxHold}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Daily Summary in JPG */}
          <div style={{ border: '2px solid #0B1F3F', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#0B1F3F', color: '#ffffff', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px' }}>
              DAILY SUMMARY ({activeDateDot})
            </div>
            <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <b style={{ color: '#0B1F3F', display: 'block', marginBottom: '4px' }}>
                  1. MOST LATE REPORTED PIC TODAY (SERIALLY ON LATE TIME BASED):
                </b>
                {dailySummary.latePicList.length === 0 ? (
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#16A34A' }}>
                    ALL CREW REPORTED ON TIME TODAY (0 LATE REPORTS)
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dailySummary.latePicList.slice(0, Math.max(3, dailySummary.latePicList.length)).map((lp) => (
                      <div
                        key={lp.rank}
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#B91C1C',
                          backgroundColor: '#FEE2E2',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #FCA5A5',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>
                          <b>#{String(lp.rank).padStart(2, '0')}</b> CAPT. {lp.pic}
                        </span>
                        <span style={{ backgroundColor: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: '3px', fontSize: '11px' }}>
                          {lp.lateReport} LATE • {lp.flightNo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <b style={{ color: '#0B1F3F' }}>2. RAMP PASSENGER HOLD TODAY:</b>{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#D97706' }}>
                  {dailySummary.paxHoldSummary}
                </span>
              </div>
            </div>
          </div>

          {/* Footer note with modern watermark */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #CBD5E1', paddingTop: '10px', fontSize: '11px', color: '#64748B' }}>
            <span>US-BANGLA AIRLINES &bull; RAMP OPERATIONS MANAGEMENT</span>
            <span style={{ fontWeight: 800, color: '#0284c7', letterSpacing: '0.5px' }}>
              Application build by USBA-20088
            </span>
            <span>OFFICIAL SYSTEM RECORD &bull; RETENTION: 30 DAYS</span>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: 30-DAY MONTHLY SUMMARY (Attachment 3 strictly from TODAY) */}
      {isMonthlySummaryOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto fade-in">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto space-y-0">
            {/* Monthly Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-md">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    MONTHLY CREW SUMMARY
                  </h3>
                  <p className="text-[11px] text-amber-400 font-mono font-bold">
                    {monthlyDateRangeHeader}
                  </p>
                </div>
              </div>

              {/* Monthly Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleDownloadMonthlyExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
                  title="Download Monthly Summary as Excel (Attachment 3)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>DOWNLOAD EXCEL</span>
                </button>

                <button
                  onClick={handleDownloadMonthlyJpg}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
                  title="Download Monthly Summary as JPG Card"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>DOWNLOAD JPG</span>
                </button>

                <button
                  onClick={() => setIsMonthlySummaryOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Monthly Search & Filter Bar */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Total Captains Recorded:</span>
                <span className="text-xs font-mono font-black text-white bg-slate-800 px-2 py-0.5 rounded-md">
                  {monthlySummaryData.length}
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={monthlySearchQuery}
                  onChange={(e) => setMonthlySearchQuery(e.target.value)}
                  placeholder="Search Captain name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Monthly Table Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div
                ref={monthlyCardRef}
                className="bg-white text-slate-950 p-6 rounded-2xl border-2 border-slate-900 shadow-2xl space-y-4 max-w-4xl mx-auto"
              >
                {/* Official Airline Banner */}
                <div className="text-center border-b-2 border-slate-900 pb-3">
                  <h1 className="text-xl font-black text-slate-950 tracking-wider">
                    US-BANGLA AIRLINES
                  </h1>
                  <h2 className="text-base font-black tracking-widest text-slate-800 uppercase font-mono mt-1">
                    {monthlyDateRangeHeader}
                  </h2>
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    CREW REPORTING TIMELINESS AUDIT
                  </p>
                </div>

                {/* Attachment 3 Table */}
                <div className="overflow-x-auto border-2 border-slate-900">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-white text-slate-950 font-black border-b-2 border-slate-900">
                        <th className="py-3 px-4 border-r-2 border-slate-900 text-left font-black w-36 text-sm">
                          Captain
                        </th>
                        <th className="py-3 px-3 border-r-2 border-slate-900 w-24 text-center leading-tight">
                          Total<br />Flights
                        </th>
                        <th className="py-3 px-3 border-r-2 border-slate-900 w-24 text-center leading-tight">
                          Reported<br />Late
                        </th>
                        <th className="py-3 px-4 text-left font-black tracking-wider text-sm">
                          FLIGHT DATA
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-900 font-mono text-slate-900">
                      {filteredMonthlySummary.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 font-sans text-xs">
                            No Captain records found starting from {isoToDotFormat(todayIso)}.
                          </td>
                        </tr>
                      ) : (
                        filteredMonthlySummary.map((c) => (
                          <tr key={c.captain} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 border-r-2 border-slate-900 text-left font-black text-slate-950 uppercase text-xs">
                              {c.captain}
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 font-bold text-xs text-center">
                              {c.totalFlights}
                            </td>
                            <td className="py-2.5 px-3 border-r-2 border-slate-900 font-black text-xs text-center">
                              <span
                                className={
                                  c.reportedLate > 0
                                    ? 'text-rose-700 font-black'
                                    : 'text-slate-900 font-bold'
                                }
                              >
                                {c.reportedLate}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-left font-semibold text-xs leading-relaxed text-slate-900">
                              {c.flightDataStr}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer on Image with modern watermark */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-300">
                  <span>US-BANGLA AIRLINES &bull; RAMP OPERATIONS</span>
                  <span className="font-extrabold text-sky-600 tracking-wide">Application build by USBA-20088</span>
                  <span>RECORDING ACTIVE FROM {isoToDotFormat(todayIso)}</span>
                </div>
              </div>
            </div>

            {/* Monthly Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="font-mono text-[11px]">
                Showing {filteredMonthlySummary.length} of {monthlySummaryData.length} Captains
              </span>
              <button
                onClick={() => setIsMonthlySummaryOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
              >
                BACK TO DAILY REPORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
