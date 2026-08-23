import { DailyAnalyticalSnapshot, SavedReport } from '../types';
import { DELAY_CODES } from '../constants/delayCodes';

/**
 * Parses any date string format (e.g. "21 AUG 26", "21-AUG-2026", "2026-08-21", "TODAY") into ISO "YYYY-MM-DD"
 */
export const parseDateToIso = (dateStr?: string): string => {
  const currentYear = new Date().getFullYear();

  if (!dateStr || !dateStr.trim()) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const clean = dateStr.trim().toUpperCase();
  if (clean.includes('TODAY')) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 1. ISO format YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 2. Alpha format DD MMM YY or DD-MMM-YYYY e.g. "23 AUG 26", "23-AUG-2026", "23AUG"
  const alphaMatch = clean.match(/(\d{1,2})\s*[-/ ]?\s*([A-Za-z]{3})(?:\s*[-/ ]?\s*(\d{2,4}))?/i);
  if (alphaMatch) {
    const day = String(parseInt(alphaMatch[1], 10)).padStart(2, '0');
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const mIdx = monthNames.indexOf(alphaMatch[2].toUpperCase());
    const m = String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, '0');

    let yrStr = alphaMatch[3];
    let yr = currentYear;
    if (yrStr) {
      const yrNum = parseInt(yrStr, 10);
      if (yrStr.length === 4 && yrNum >= 2020 && yrNum <= 2040) {
        yr = yrNum;
      } else if (yrStr.length === 2 && yrNum >= 20 && yrNum <= 40) {
        yr = 2000 + yrNum;
      }
      // If yrNum < 20 (e.g. 01, 07 from time/tokens), it defaults safely to currentYear
    }
    return `${yr}-${m}-${day}`;
  }

  // 3. Numeric format DD/MM/YYYY or DD-MM-YYYY e.g. "22/08/2026"
  const numMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numMatch) {
    const day = String(parseInt(numMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(numMatch[2], 10)).padStart(2, '0');
    let yrStr = numMatch[3];
    let yr = currentYear;
    if (yrStr) {
      const yrNum = parseInt(yrStr, 10);
      if (yrStr.length === 4 && yrNum >= 2020 && yrNum <= 2040) {
        yr = yrNum;
      } else if (yrStr.length === 2 && yrNum >= 20 && yrNum <= 40) {
        yr = 2000 + yrNum;
      }
    }
    return `${yr}-${m}-${day}`;
  }

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Cleans flight number strings to pure standardized digits (e.g. "BS-361" -> "361", "BS 0115" -> "115")
 */
export const cleanFlightNum = (str?: string): string => {
  if (!str) return '';
  const digits = str.replace(/BS/gi, '').replace(/[^0-9]/g, '').trim();
  if (digits) {
    const num = parseInt(digits, 10);
    if (!isNaN(num)) return num.toString();
  }
  return str.replace(/BS/gi, '').replace(/[^0-9a-zA-Z]/g, '').trim().toUpperCase();
};

/**
 * Formats ISO "YYYY-MM-DD" to Display "DD MMM YY" (e.g. "21 AUG 26")
 */
export const formatIsoToDisplay = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const day = parts[2];
    const mIdx = parseInt(parts[1], 10) - 1;
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[mIdx] || 'JAN';
    const yr = parts[0].slice(-2);
    return `${day} ${month} ${yr}`.toUpperCase();
  }
  return isoStr;
};

// Helper to convert time string to minutes
const parseTimeToMinutes = (tStr?: string): number | null => {
  if (!tStr) return null;
  const clean = tStr.trim().replace(/[^0-9:]/g, '');
  let hh = 0;
  let mm = 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    hh = parseInt(parts[0], 10);
    mm = parseInt(parts[1], 10);
  } else if (clean.length === 4) {
    hh = parseInt(clean.slice(0, 2), 10);
    mm = parseInt(clean.slice(2, 4), 10);
  } else if (clean.length === 3) {
    hh = parseInt(clean.slice(0, 1), 10);
    mm = parseInt(clean.slice(1, 3), 10);
  } else {
    return null;
  }

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
};

// Helper: Calculate duration between start and end times
const calculateDurationMins = (startStr?: string, endStr?: string): number | null => {
  const sClean = (startStr || '').trim().toUpperCase();
  const eClean = (endStr || '').trim().toUpperCase();

  if (!sClean || !eClean) return null;
  if (
    sClean === 'EARLIER' ||
    sClean === 'EARLY' ||
    sClean === 'N/A' ||
    sClean === 'NA' ||
    sClean === 'OB' ||
    sClean === 'PRE' ||
    eClean === 'EARLIER' ||
    eClean === 'EARLY' ||
    eClean === 'N/A' ||
    eClean === 'NA' ||
    eClean === 'OB' ||
    eClean === 'PRE'
  ) {
    return null;
  }

  const sMin = parseTimeToMinutes(sClean);
  const eMin = parseTimeToMinutes(eClean);
  if (sMin === null || eMin === null) return null;

  let diff = eMin - sMin;
  if (diff < 0) diff += 1440;
  return diff;
};

// Helper: Calculate Ground Time Minutes
const calculateGroundMins = (groundStr?: string, conStr?: string, coStr?: string, mode?: string): number | null => {
  if (mode === 'DIRECT') return null;
  const clean = (groundStr || '').trim().toUpperCase();
  if (!clean || clean.includes('GROUND') || clean === '0 MIN' || clean === '0' || clean === 'N/A' || clean === 'EARLIER') {
    const conMin = parseTimeToMinutes(conStr);
    const coMin = parseTimeToMinutes(coStr);
    if (conMin !== null && coMin !== null) {
      let diff = coMin - conMin;
      if (diff < 0) diff += 1440;
      if (diff > 0) return diff;
    }
    return null;
  }

  const numMatch = clean.match(/(\d+)\s*MIN/);
  if (numMatch) return parseInt(numMatch[1], 10);

  const hmMatch = clean.match(/(\d+)H\s*(\d+)M/);
  if (hmMatch) return parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10);

  return null;
};

/**
 * Builds a unified DailyAnalyticalSnapshot for a given date from an array of SavedReports
 */
export function buildDailyAnalyticalSnapshot(
  reportsForDate: SavedReport[],
  targetDateIso: string,
  station: string = 'DAC',
  savedBy: { name: string; id: string } = { name: 'SYSTEM_AUTO_ARCHIVE', id: '000' }
): DailyAnalyticalSnapshot {
  const dateDisplay = formatIsoToDisplay(targetDateIso);
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = now + THIRTY_DAYS_MS;

  // Deduplicate reports by flight number
  const uniqueReportsMap = new Map<string, SavedReport>();
  reportsForDate.forEach((r) => {
    const fltKey = (r.formData?.deptFlt || r.formData?.arvFlt || r.flight || r.id)
      .replace(/^BS-?/i, '')
      .trim()
      .toUpperCase();
    if (!uniqueReportsMap.has(fltKey)) {
      uniqueReportsMap.set(fltKey, r);
    }
  });
  const dedupedReports = Array.from(uniqueReportsMap.values());

  // 1. Executive Analytical Metrics
  let onTimeCount = 0;
  let delayedCount = 0;
  const delayCodeMap = new Map<string, { count: number; flights: string[] }>();
  const categoryCountMap = new Map<string, number>();

  dedupedReports.forEach((r) => {
    const statusUpper = (r.formData?.status || '').toUpperCase();
    const isDelay =
      statusUpper.includes('DELAY') &&
      !statusUpper.includes('EARLY') &&
      !statusUpper.includes('ON TIME') &&
      !statusUpper.includes('ON-TIME');

    if (isDelay) {
      delayedCount++;
      const rawReason = r.formData.delayReason?.trim() || 'UNSPECIFIED DELAY CODE';
      const codes = rawReason.split(';').map((s) => s.trim()).filter(Boolean);
      const targetCodes = codes.length > 0 ? codes : [rawReason];

      targetCodes.forEach((code) => {
        const fltLabel = `BS-${r.formData?.deptFlt || 'FLT'}`;
        const existing = delayCodeMap.get(code) || { count: 0, flights: [] };
        existing.count += 1;
        if (!existing.flights.includes(fltLabel)) existing.flights.push(fltLabel);
        delayCodeMap.set(code, existing);

        // Find Delay Category
        let matchedCategory = 'Other Operations';
        for (const cat of DELAY_CODES) {
          if (cat.codes.some((c) => code.toUpperCase().includes(c.slice(0, 2)))) {
            matchedCategory = cat.category;
            break;
          }
        }
        categoryCountMap.set(matchedCategory, (categoryCountMap.get(matchedCategory) || 0) + 1);
      });
    } else {
      onTimeCount++;
    }
  });

  const totalReportsCount = dedupedReports.length;
  const otpRate = totalReportsCount > 0 ? ((onTimeCount / totalReportsCount) * 100).toFixed(1) : '100.0';
  const delayRate = totalReportsCount > 0 ? ((delayedCount / totalReportsCount) * 100).toFixed(1) : '0.0';

  const delayBreakdown = Array.from(delayCodeMap.entries())
    .map(([code, data]) => ({ code, count: data.count, flights: data.flights }))
    .sort((a, b) => b.count - a.count);

  const topDelayItem = delayBreakdown[0] || null;

  const totalCategoryIncidents = Array.from(categoryCountMap.values()).reduce((sum, n) => sum + n, 0);
  const activeCategoryBreakdown = Array.from(categoryCountMap.entries())
    .map(([catName, count]) => ({
      catName,
      count,
      pct: totalCategoryIncidents > 0 ? `${Math.round((count / totalCategoryIncidents) * 100)}%` : '0%'
    }))
    .sort((a, b) => b.count - a.count);

  // 2. Time Analytical Metrics
  const securityMinsList: number[] = [];
  const cleaningMinsList: number[] = [];
  const cateringMinsList: number[] = [];
  const boardingMinsList: number[] = [];
  const groundMinsList: number[] = [];

  dedupedReports.forEach((r) => {
    const sec = calculateDurationMins(r.formData?.securitySt, r.formData?.securityEnd);
    if (sec !== null) securityMinsList.push(sec);

    const cln = calculateDurationMins(r.formData?.cleaningSt, r.formData?.cleaningEnd);
    if (cln !== null) cleaningMinsList.push(cln);

    const cat = calculateDurationMins(r.formData?.cateringSt, r.formData?.cateringEnd);
    if (cat !== null) cateringMinsList.push(cat);

    const brd = calculateDurationMins(r.formData?.permit, r.formData?.pax);
    if (brd !== null) boardingMinsList.push(brd);

    const grd = calculateGroundMins(
      r.formData?.ground,
      r.formData?.con || r.formData?.do,
      r.formData?.co,
      r.mode
    );
    if (grd !== null) groundMinsList.push(grd);
  });

  const calcAvg = (list: number[]) => {
    if (list.length === 0) return '0 MIN';
    const sum = list.reduce((a, b) => a + b, 0);
    return `${Math.round(sum / list.length)} MIN`;
  };

  const avgSecurity = calcAvg(securityMinsList);
  const avgCleaning = calcAvg(cleaningMinsList);
  const avgCatering = calcAvg(cateringMinsList);
  const avgBoarding = calcAvg(boardingMinsList);
  const avgGround = calcAvg(groundMinsList);

  return {
    id: `SNAPSHOT_${targetDateIso}_${station || 'ALL'}`,
    dateIso: targetDateIso,
    dateDisplay,
    station: station || 'ALL',
    savedAt: now,
    savedBy,
    expiresAt,
    totalReportsCount,
    reportsSnapshot: dedupedReports,
    executiveAnalyticalData: {
      totalReportsCount,
      delayedCount,
      onTimeCount,
      otpRate,
      delayRate,
      topDelayItem: topDelayItem || undefined,
      activeCategoryBreakdown,
      delayBreakdown
    },
    timeAnalyticalData: {
      totalFlights: totalReportsCount,
      avgSecurity,
      avgCleaning,
      avgCatering,
      avgBoarding,
      avgGround
    }
  };
}
