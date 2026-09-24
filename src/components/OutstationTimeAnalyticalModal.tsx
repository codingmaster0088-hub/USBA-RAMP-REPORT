import React, { useState, useRef, useMemo, useEffect } from 'react';
import { SavedReport, ScheduleFlight, DailyAnalyticalSnapshot } from '../types';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';
import {
  parseDateToIso,
  formatIsoToDisplay,
  cleanFlightNum,
  buildOutstationAnalyticalSnapshot
} from '../utils/analyticalSnapshotBuilder';
import {
  subscribeToDailyAnalyticalSnapshots,
  saveDailyAnalyticalSnapshotToFirestore
} from '../lib/firebase';
import aircraftImage from '../assets/images/airplane_flying_sky_1788975401314.jpg';
import {
  X,
  Clock,
  Download,
  Calendar,
  FileSpreadsheet,
  Plane,
  Search,
  CheckCircle2,
  Activity,
  Image as ImageIcon,
  Eye,
  Table as TableIcon,
  Trash2,
  AlertTriangle,
  MapPin,
  Users,
  Briefcase,
  Shield,
  RotateCcw,
  Sparkles,
  Database,
  Check
} from 'lucide-react';

interface OutstationTimeAnalyticalModalProps {
  savedReports: SavedReport[];
  scheduleFlights: ScheduleFlight[];
  station: string;
  adminName: string;
  adminId: string;
  onClose: () => void;
  showToast: (title: string, subtitle?: string, type?: 'success' | 'info' | 'error') => void;
  onDeleteReport?: (id: string) => void;
}

export const OutstationTimeAnalyticalModal: React.FC<OutstationTimeAnalyticalModalProps> = ({
  savedReports,
  adminName,
  adminId,
  onClose,
  showToast,
  onDeleteReport
}) => {
  const printCardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'HUD_TABLE' | 'PHOTO_CARD'>('HUD_TABLE');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('ALL');
  const [selectedReportDetail, setSelectedReportDetail] = useState<SavedReport | null>(null);

  // Custom Plane Photo state with local storage persistence
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(() => {
    try {
      return localStorage.getItem('usb_custom_outstation_plane_photo') || null;
    } catch {
      return null;
    }
  });

  // Default date to today's ISO date (YYYY-MM-DD)
  const getTodayIso = () => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(getTodayIso);

  // 30-Day Firestore daily analytical snapshots state
  const [backendSnapshots, setBackendSnapshots] = useState<DailyAnalyticalSnapshot[]>([]);

  useEffect(() => {
    const unsub = subscribeToDailyAnalyticalSnapshots(
      (list) => {
        setBackendSnapshots(list);
      },
      (err) => console.warn('Snapshot subscription error:', err)
    );
    return () => unsub();
  }, []);

  // Active Snapshot for Outstations
  const activeBackendSnapshot = useMemo(() => {
    return backendSnapshots.find((s) => {
      const isDateMatch = s.dateIso === selectedIsoDate || s.dateDisplay === formatIsoToDisplay(selectedIsoDate);
      const isOutstationSnap = s.station === 'OUTSTATION' || s.id.includes('OUTSTATION');
      return isDateMatch && isOutstationSnap;
    });
  }, [backendSnapshots, selectedIsoDate]);

  // Available outstation filter list
  const OUTSTATIONS = ['ALL', 'CXB', 'CGP', 'SPD', 'ZYL', 'JSR', 'RJH', 'BZL'];

  // Track deleted flight IDs in local state
  const [deletedFlightIds, setDeletedFlightIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('usb_deleted_outstation_report_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleDeleteFlight = (reportId: string, flightNo: string) => {
    if (!window.confirm(`Are you sure you want to remove ${flightNo} from Out Station Time Analytics?`)) {
      return;
    }

    setDeletedFlightIds((prev) => {
      const next = new Set(prev);
      next.add(reportId);
      try {
        localStorage.setItem('usb_deleted_outstation_report_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    if (onDeleteReport) {
      onDeleteReport(reportId);
    }

    showToast('Flight Removed', `${flightNo} report removed from Out Station Time Analytics`, 'info');
  };

  // Helper: Normalize any date string to DDMMM format for comparison
  const parseDayMonthKey = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim().toUpperCase();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    const alphaMatch = cleanStr.match(/\b(\d{1,2})\s*[-/]?\s*([A-Za-z]{3})\b/i);
    if (alphaMatch) {
      const day = String(parseInt(alphaMatch[1], 10)).padStart(2, '0');
      const month = alphaMatch[2].toUpperCase();
      return `${day}${month}`;
    }

    const isoMatch = cleanStr.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (isoMatch) {
      const mIdx = parseInt(isoMatch[2], 10) - 1;
      const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      const month = monthNames[mIdx] || 'JAN';
      return `${day}${month}`;
    }

    const numMatch = cleanStr.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
    if (numMatch) {
      const day = String(parseInt(numMatch[1], 10)).padStart(2, '0');
      const mIdx = parseInt(numMatch[2], 10) - 1;
      const month = monthNames[mIdx] || 'JAN';
      return `${day}${month}`;
    }

    return cleanStr.replace(/[^0-9A-Z]/g, '').slice(0, 5);
  };

  const isReportMatchingSelectedDate = (r: SavedReport, targetIso: string): boolean => {
    if (!targetIso) return true;
    const normalizedTargetIso = parseDateToIso(targetIso);
    const targetDmKey = parseDayMonthKey(normalizedTargetIso);

    const fDate = r.formData?.date || r.date || '';
    const fDateIso = parseDateToIso(fDate);
    const fDateDmKey = parseDayMonthKey(fDate);

    if (fDateIso && fDateIso === normalizedTargetIso) return true;
    if (fDateDmKey && targetDmKey && fDateDmKey === targetDmKey) return true;

    if (r.createdAt) {
      const cDate = new Date(r.createdAt);
      const cIso = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, '0')}-${String(
        cDate.getDate()
      ).padStart(2, '0')}`;
      if (cIso === targetIso) return true;
    }

    return false;
  };

  // Helper: parse "HHMM" or "HH:MM" into total minutes
  const parseTimeToMinutes = (str?: string): number | null => {
    if (!str) return null;
    const clean = str.trim().replace(/[^0-9:]/g, '');
    if (!clean) return null;

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

  // Calculate duration between start and end
  const calculateTurnaroundDuration = (
    startStr?: string,
    endStr?: string
  ): { durationText: string; minutes: number | null; isPre: boolean } => {
    const sClean = (startStr || '').trim().toUpperCase();
    const eClean = (endStr || '').trim().toUpperCase();

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
      return { durationText: 'PRE', minutes: null, isPre: true };
    }

    if (!sClean && !eClean) {
      return { durationText: '-', minutes: null, isPre: false };
    }

    const startMin = parseTimeToMinutes(sClean);
    const endMin = parseTimeToMinutes(eClean);

    if (startMin === null || endMin === null) {
      return { durationText: sClean || eClean || '-', minutes: null, isPre: false };
    }

    let diff = endMin - startMin;
    if (diff < 0) {
      diff += 1440;
    }

    return {
      durationText: `${diff} MIN`,
      minutes: diff,
      isPre: false
    };
  };

  // Helper: Get Ground Time
  const getGroundTimeDisplay = (
    groundStr?: string,
    conStr?: string,
    coStr?: string
  ): { text: string; minutes: number | null } => {
    const clean = (groundStr || '').trim().toUpperCase();
    if (!clean || clean.includes('GROUND') || clean === '0 MIN' || clean === '0' || clean === 'N/A') {
      const conMin = parseTimeToMinutes(conStr);
      const coMin = parseTimeToMinutes(coStr);
      if (conMin !== null && coMin !== null) {
        let diff = coMin - conMin;
        if (diff < 0) diff += 1440;
        if (diff > 0) return { text: `${diff} MIN`, minutes: diff };
      }
      return { text: 'ON GROUND', minutes: null };
    }

    const numMatch = clean.match(/(\d+)\s*MIN/);
    if (numMatch) {
      const mins = parseInt(numMatch[1], 10);
      return { text: `${mins} MIN`, minutes: mins };
    }

    return { text: clean, minutes: null };
  };

  // Detect outstation from report
  const getReportStation = (r: SavedReport): string => {
    const explicitStation = (r.formData?.station || (r as any).station || '').toUpperCase().trim();
    if (explicitStation && explicitStation !== 'DAC') return explicitStation;

    // Detect from deptRoute (e.g. CXB-DAC -> CXB)
    const dRoute = (r.formData?.deptRoute || r.route || '').toUpperCase().trim();
    if (dRoute.includes('-')) {
      const origin = dRoute.split('-')[0].trim();
      if (origin && origin !== 'DAC') return origin;
    }

    // Detect from arvRoute if turnaround (e.g. DAC-CXB -> CXB station)
    const aRoute = (r.formData?.arvRoute || '').toUpperCase().trim();
    if (aRoute.includes('-')) {
      const dest = aRoute.split('-')[1].trim();
      if (dest && dest !== 'DAC') return dest;
    }

    return explicitStation || 'OUTSTATION';
  };

  // Check if a report belongs to an Outstation departure
  const isOutstationReport = (r: SavedReport): boolean => {
    const stn = getReportStation(r);
    if (stn === 'DAC') return false;

    // Make sure it has departure information or is from an outstation
    const dRoute = (r.formData?.deptRoute || r.route || '').toUpperCase().trim();
    if (dRoute.startsWith('DAC-')) {
      // Originates from DAC, but wait: if user is at outstation and saved round, deptRoute is CXB-DAC
      return false;
    }
    return true;
  };

  // Filter raw saved reports for outstations + merge snapshots for previous dates
  const rawOutstationReports = useMemo(() => {
    const list: SavedReport[] = [];
    const seen = new Set<string>();

    const candidateReports = [
      ...savedReports,
      ...(activeBackendSnapshot?.reportsSnapshot || [])
    ];

    candidateReports.forEach((r) => {
      if (r.id && deletedFlightIds.has(r.id)) return;
      if (!isOutstationReport(r)) return;
      if (!isReportMatchingSelectedDate(r, selectedIsoDate)) return;

      const stn = getReportStation(r);
      if (selectedStationFilter !== 'ALL' && stn !== selectedStationFilter) return;

      const fNum = cleanFlightNum(r.formData?.deptFlt || r.flight || '');
      const key = r.id || `${fNum}_${r.date}_${stn}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push(r);
    });

    return list;
  }, [savedReports, activeBackendSnapshot, selectedIsoDate, selectedStationFilter, deletedFlightIds]);

  // Save Outstation Analytical Snapshot to Firestore (30-Day Database Retention)
  const handleSaveToBackend = async (showModal = true) => {
    try {
      const snap = buildOutstationAnalyticalSnapshot(rawOutstationReports, selectedIsoDate, {
        name: adminName || 'Super Admin',
        id: adminId || 'SUPER_ADMIN'
      });
      await saveDailyAnalyticalSnapshotToFirestore(snap);
      if (showModal) {
        showToast(
          'Saved to Database',
          `Out Station records for ${activeDateDisplay} archived for 30-day retention`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to save outstation snapshot:', err);
      if (showModal) {
        showToast('Save Failed', 'Could not archive outstation snapshot to database', 'error');
      }
    }
  };

  // Auto-sync today's outstation reports so database save starts from today immediately
  useEffect(() => {
    if (selectedIsoDate === getTodayIso() && rawOutstationReports.length > 0) {
      handleSaveToBackend(false);
    }
  }, [selectedIsoDate, rawOutstationReports.length]);

  // Process rows for table & photo card
  const processedRows = useMemo(() => {
    return rawOutstationReports
      .map((r) => {
        const formData = r.formData || ({} as any);
        const stn = getReportStation(r);
        const flightNum = formData.deptFlt || r.flight || formData.arvFlt || 'N/A';
        const displayFlight = flightNum.toUpperCase().startsWith('BS-')
          ? flightNum.toUpperCase()
          : `BS-${flightNum}`;
        const route = (formData.deptRoute || r.route || `${stn}-DAC`).toUpperCase();
        const dateDisplay = (formData.date || r.date || formatIsoToDisplay(selectedIsoDate)).toUpperCase();

        const conVal = formData.con || '-';
        const dcVal = formData.dc || '-';
        const coVal = formData.co || '-';
        const groundTime = getGroundTimeDisplay(formData.ground, conVal, coVal);

        const securitySt = formData.securitySt || '-';
        const securityEnd = formData.securityEnd || '-';
        const securityDuration = calculateTurnaroundDuration(formData.securitySt, formData.securityEnd);

        const cleaningSt = formData.cleaningSt || '-';
        const cleaningEnd = formData.cleaningEnd || '-';
        const cleaningDuration = calculateTurnaroundDuration(formData.cleaningSt, formData.cleaningEnd);

        const crewReport = formData.crew || '-';
        const firstBusPax = formData.firstBusPax || '-';
        const permit = formData.permit || '-';
        const pax = formData.pax || '-';
        const boardingDuration = calculateTurnaroundDuration(formData.permit, formData.pax);

        const trimSubmitted = formData.trimSubmitted || '-';
        const trimSigned = formData.trimSigned || '-';

        // Outstation Passenger & Baggage data
        const vipPax = formData.vipPax || '0';
        const vipBag = formData.vipBag || '0';
        const maasPax = formData.maasPax || '0';
        const priorityBag = formData.priorityBag || '0';
        const fireArms = formData.fireArms || '0';
        const rushBag = formData.rushBag || '0';
        const offloadBag = formData.offloadBag || '0';

        const rawStatus = (formData.status || 'ON TIME').toUpperCase();
        let status = 'ON TIME';
        let statusType: 'EARLY' | 'ONTIME' | 'DELAY' = 'ONTIME';

        if (rawStatus.includes('DELAY')) {
          status = 'DELAY';
          statusType = 'DELAY';
        } else if (rawStatus.includes('EARLY')) {
          status = 'EARLY';
          statusType = 'EARLY';
        } else {
          status = 'ON TIME';
          statusType = 'ONTIME';
        }

        const delayReason = formData.delayReason || formData.delayRemarks || '';
        const officer = (r.officerName || (r as any).userName || (r as any).userId || adminName || 'DUTY OFFICER').toUpperCase();

        return {
          id: r.id || `${flightNum}_${dateDisplay}_${stn}`,
          originalReport: r,
          date: dateDisplay,
          station: stn,
          flight: displayFlight,
          rawFlightNum: cleanFlightNum(flightNum),
          route,
          ac: (formData.ac || 'S2-').toUpperCase(),
          std: formData.std || '-',
          bay: (formData.bay || '-').toUpperCase(),
          conVal,
          dcVal,
          coVal,
          groundTime,
          securitySt,
          securityEnd,
          securityDuration,
          cleaningSt,
          cleaningEnd,
          cleaningDuration,
          crewReport,
          firstBusPax,
          permit,
          pax,
          boardingDuration,
          trimSubmitted,
          trimSigned,
          vipPax,
          vipBag,
          maasPax,
          priorityBag,
          fireArms,
          rushBag,
          offloadBag,
          status,
          statusType,
          delayReason,
          officer
        };
      })
      .filter((row) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          row.flight.toLowerCase().includes(q) ||
          row.route.toLowerCase().includes(q) ||
          row.station.toLowerCase().includes(q) ||
          row.ac.toLowerCase().includes(q) ||
          row.bay.toLowerCase().includes(q) ||
          row.officer.toLowerCase().includes(q) ||
          row.delayReason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Sort by station then STD
        if (a.station !== b.station) return a.station.localeCompare(b.station);
        const aMin = parseTimeToMinutes(a.std) || 0;
        const bMin = parseTimeToMinutes(b.std) || 0;
        return aMin - bMin;
      });
  }, [rawOutstationReports, searchQuery, selectedIsoDate, adminName]);

  // Summary Metrics
  const summaryKPIs = useMemo(() => {
    const total = processedRows.length;
    let ontimeCount = 0;
    let delayCount = 0;
    let earlyCount = 0;
    let totalGroundMins = 0;
    let groundCount = 0;
    let totalVipPax = 0;
    let totalVipBags = 0;
    let totalMaasPax = 0;
    let totalPriorityBags = 0;
    let totalFireArms = 0;
    let totalRushBags = 0;

    processedRows.forEach((r) => {
      if (r.statusType === 'DELAY') delayCount++;
      else if (r.statusType === 'EARLY') {
        earlyCount++;
        ontimeCount++;
      } else {
        ontimeCount++;
      }

      if (r.groundTime.minutes) {
        totalGroundMins += r.groundTime.minutes;
        groundCount++;
      }

      totalVipPax += parseInt(r.vipPax, 10) || 0;
      totalVipBags += parseInt(r.vipBag, 10) || 0;
      totalMaasPax += parseInt(r.maasPax, 10) || 0;
      totalPriorityBags += parseInt(r.priorityBag, 10) || 0;
      totalFireArms += parseInt(r.fireArms, 10) || 0;
      totalRushBags += parseInt(r.rushBag, 10) || 0;
    });

    const otpPct = total > 0 ? Math.round((ontimeCount / total) * 100) : 100;
    const avgGround = groundCount > 0 ? Math.round(totalGroundMins / groundCount) : 0;

    return {
      total,
      ontimeCount,
      delayCount,
      earlyCount,
      otpPct,
      avgGround,
      totalVipPax,
      totalVipBags,
      totalMaasPax,
      totalPriorityBags,
      totalFireArms,
      totalRushBags
    };
  }, [processedRows]);

  const activeDateDisplay = useMemo(() => {
    return formatIsoToDisplay(selectedIsoDate).toUpperCase();
  }, [selectedIsoDate]);

  // Export CSV
  const handleExportCSV = async () => {
    if (processedRows.length === 0) {
      showToast('No Reports', 'No outstation departure reports available to export', 'error');
      return;
    }

    // Auto-save snapshot to 30-day database
    await handleSaveToBackend(false);

    const headers = [
      'SL',
      'Date',
      'Station',
      'Flight',
      'Route',
      'A/C Reg',
      'STD',
      'Bay',
      'C/ON',
      'D/C',
      'C/OFF',
      'Ground Time',
      'Security ST',
      'Security END',
      'Security Duration',
      'Cleaning ST',
      'Cleaning END',
      'Cleaning Duration',
      'First Bus/Pax',
      'Boarding Permit',
      'Pax Onboard',
      'Boarding Duration',
      'Trim Submitted',
      'Trim Signed',
      'VIP PAX',
      'VIP BAG',
      'MAAS/PRIORITY PAX',
      'PRIORITY BAG',
      'FIRE ARMS',
      'RUSH BAG',
      'OFFLOAD BAG',
      'Flight Status',
      'Delay Reason',
      'Duty Officer'
    ];

    const rows = processedRows.map((r, i) => [
      i + 1,
      `"${r.date}"`,
      `"${r.station}"`,
      `"${r.flight}"`,
      `"${r.route}"`,
      `"${r.ac}"`,
      `"${r.std}"`,
      `"${r.bay}"`,
      `"${r.conVal}"`,
      `"${r.dcVal}"`,
      `"${r.coVal}"`,
      `"${r.groundTime.text}"`,
      `"${r.securitySt}"`,
      `"${r.securityEnd}"`,
      `"${r.securityDuration.durationText}"`,
      `"${r.cleaningSt}"`,
      `"${r.cleaningEnd}"`,
      `"${r.cleaningDuration.durationText}"`,
      `"${r.firstBusPax}"`,
      `"${r.permit}"`,
      `"${r.pax}"`,
      `"${r.boardingDuration.durationText}"`,
      `"${r.trimSubmitted}"`,
      `"${r.trimSigned}"`,
      `"${r.vipPax}"`,
      `"${r.vipBag}"`,
      `"${r.maasPax}"`,
      `"${r.priorityBag}"`,
      `"${r.fireArms}"`,
      `"${r.rushBag}"`,
      `"${r.offloadBag}"`,
      `"${r.status}"`,
      `"${(r.delayReason || '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`,
      `"${r.officer}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        `US-BANGLA AIRLINES - OUT STATION TIME & TURNAROUND ANALYTICAL REPORT (${activeDateDisplay} - Station: ${selectedStationFilter})`,
        `Application build by USBA-20088 | Generated by Super Admin | 30-Day Database Retention Active`,
        '',
        headers.join(','),
        ...rows.map((e) => e.join(','))
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `US_BANGLA_OUTSTATION_TIME_ANALYTICS_${selectedStationFilter}_${activeDateDisplay.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Excel/CSV Exported', 'Outstation Time Analytical data exported successfully', 'success');
  };

  // Download High-Resolution JPG Photo Card (Guaranteed to work in both HUD_TABLE and PHOTO_CARD)
  const handleDownloadJPG = async () => {
    try {
      setIsDownloading(true);
      showToast('Generating High-Res JPG...', 'Rendering official Out Station analytical card at 1200px', 'info');

      // Auto archive snapshot to 30-day database
      handleSaveToBackend(false).catch(() => {});

      // If card ref is temporarily unavailable, ensure it mounts
      if (!printCardRef.current) {
        setViewMode('PHOTO_CARD');
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      await new Promise((resolve) => setTimeout(resolve, 250));

      if (!printCardRef.current) {
        showToast('Error', 'Canvas card element not found', 'error');
        return;
      }

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
      link.download = `US_BANGLA_OUTSTATION_TIME_ANALYTICAL_${selectedStationFilter}_${activeDateDisplay.replace(
        /\s+/g,
        '_'
      )}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Official JPG Downloaded!', 'High-resolution photo card saved to your device', 'success');
    } catch (e) {
      console.error('Failed to download JPG', e);
      showToast('Download Failed', 'Could not generate JPG file', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const url = event.target.result as string;
          setCustomPhotoUrl(url);
          try {
            localStorage.setItem('usb_custom_outstation_plane_photo', url);
          } catch (err) {
            console.warn('Storage quota exceeded:', err);
          }
          showToast('Plane Photo Updated', 'Aircraft photo uploaded successfully for official card', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Step dates
  const handleStepDay = (step: number) => {
    const [y, m, d] = selectedIsoDate.split('-').map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d + step);
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    setSelectedIsoDate(`${yr}-${mo}-${da}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-2 sm:p-4 overflow-hidden animate-fadeIn">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-3.5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-white uppercase tracking-wide">
                7. OUT STATION TIME ANALYTICAL
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wider uppercase">
                ALL OUT STATIONS DEPARTURE REPORT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Turnaround milestones, VIP/Priority passenger & baggage analysis for non-DAC outstations.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Plane Photo Upload Button (Visible across all tabs) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCustomPhotoUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 text-amber-200 font-extrabold text-[11px] rounded-xl border border-amber-500/50 shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Upload custom aircraft photo for official card"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{customPhotoUrl ? 'CHANGE PLANE PHOTO' : 'UPLOAD PLANE PHOTO'}</span>
          </button>
          {customPhotoUrl && (
            <button
              onClick={() => {
                setCustomPhotoUrl(null);
                try {
                  localStorage.removeItem('usb_custom_outstation_plane_photo');
                } catch {}
                showToast('Reset Complete', 'Default US-Bangla HD aircraft photo restored', 'info');
              }}
              className="px-2 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 font-bold text-[11px] rounded-xl border border-rose-500/40 active:scale-95 transition-all cursor-pointer"
              title="Reset to default US-Bangla aircraft photo"
            >
              RESET
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('HUD_TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'HUD_TABLE'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              HUD TABLE
            </button>
            <button
              onClick={() => setViewMode('PHOTO_CARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'PHOTO_CARD'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              PHOTO CARD
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DOWNLOAD</span> EXCEL/CSV
          </button>

          <button
            onClick={handleDownloadJPG}
            disabled={isDownloading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Download High-Resolution Official JPG Card"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">DOWNLOAD</span> {isDownloading ? 'SAVING...' : 'JPG'}
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Out Station Selector & Date Control Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 my-2.5 space-y-2.5 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Out Station Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1 mr-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              STATION:
            </span>
            {OUTSTATIONS.map((stn) => {
              const isSelected = selectedStationFilter === stn;
              return (
                <button
                  key={stn}
                  onClick={() => setSelectedStationFilter(stn)}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 ring-2 ring-amber-300'
                      : 'bg-slate-950 text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {stn === 'ALL' ? '🌐 ALL OUT STATIONS' : stn}
                </button>
              );
            })}
          </div>

          {/* Date Selector & Search Input */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-2 py-1">
              <button
                onClick={() => handleStepDay(-1)}
                className="px-1.5 py-0.5 text-slate-400 hover:text-amber-400 text-xs font-bold"
                title="Previous Day"
              >
                ◀
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <input
                  type="date"
                  value={selectedIsoDate}
                  onChange={(e) => setSelectedIsoDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-amber-300 outline-none cursor-pointer font-mono"
                />
              </div>
              <button
                onClick={() => handleStepDay(1)}
                className="px-1.5 py-0.5 text-slate-400 hover:text-amber-400 text-xs font-bold"
                title="Next Day"
              >
                ▶
              </button>
              <button
                onClick={() => setSelectedIsoDate(getTodayIso())}
                className="ml-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                TODAY
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flight, reg, bay, officer..."
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 w-52 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Summary KPI Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">OUTSTATION FLTS</div>
              <div className="text-base font-black text-white font-mono">{summaryKPIs.total}</div>
            </div>
            <Plane className="w-5 h-5 text-amber-400 opacity-60" />
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">OUTSTATION OTP</div>
              <div className="text-base font-black text-emerald-400 font-mono">{summaryKPIs.otpPct}%</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-60" />
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">STATUS</div>
              <div className="text-xs font-black text-slate-200 font-mono">
                <span className="text-emerald-400">{summaryKPIs.ontimeCount} OT</span> /{' '}
                <span className="text-rose-400">{summaryKPIs.delayCount} DL</span>
              </div>
            </div>
            <Activity className="w-5 h-5 text-blue-400 opacity-60" />
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">AVG GROUND</div>
              <div className="text-base font-black text-cyan-400 font-mono">
                {summaryKPIs.avgGround > 0 ? `${summaryKPIs.avgGround}M` : 'ON GROUND'}
              </div>
            </div>
            <Clock className="w-5 h-5 text-cyan-400 opacity-60" />
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">VIP PAX / BAGS</div>
              <div className="text-xs font-black text-amber-300 font-mono">
                {summaryKPIs.totalVipPax} PAX / {summaryKPIs.totalVipBags} BAGS
              </div>
            </div>
            <Users className="w-5 h-5 text-amber-400 opacity-60" />
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">PRIORITY / FIREARMS</div>
              <div className="text-xs font-black text-cyan-300 font-mono">
                {summaryKPIs.totalPriorityBags} BAGS / {summaryKPIs.totalFireArms} FA
              </div>
            </div>
            <Shield className="w-5 h-5 text-cyan-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Main Content Area: HUD TABLE vs PHOTO CARD */}
      <div className="flex-1 overflow-auto rounded-2xl bg-slate-900 border border-slate-800 p-2 sm:p-3 relative space-y-3">
        {/* 30-DAY CLOUD DATABASE RETENTION STATUS BANNER */}
        <div className="bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-3 shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  30-DAY DATABASE RETENTION
                </span>
                <span className="text-xs font-black text-white font-mono">
                  AUTOMATED 23:55 ARCHIVE <span className="text-emerald-400">ACTIVE</span> • 30 DAYS RETENTION
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Every day at 23:55 all outstation departure reports are saved automatically in database for 30 days retention (saving starts from today). Admin can check previous days' data and download JPG/Excel anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeBackendSnapshot ? (
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-sm">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>DATABASE ARCHIVED ({rawOutstationReports.length} FLTS)</span>
              </span>
            ) : (
              <button
                onClick={() => handleSaveToBackend(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Archive current outstation reports to 30-day database now"
              >
                <Database className="w-3.5 h-3.5" />
                <span>SAVE TO DATABASE</span>
              </button>
            )}
          </div>
        </div>

        {viewMode === 'HUD_TABLE' && (
          <div className="overflow-x-auto">
            {processedRows.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Plane className="w-10 h-10 text-slate-600 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  No outstation departure reports recorded for {activeDateDisplay} ({selectedStationFilter})
                </p>
                <p className="text-[11px] text-slate-600">
                  Reports saved from CXB, CGP, SPD, ZYL, JSR, RJH, BZL will automatically appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse font-sans min-w-[1700px]">
                <thead className="bg-slate-950 text-slate-400 font-black uppercase text-[10px] sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">SL</th>
                    <th className="py-2.5 px-3">STATION</th>
                    <th className="py-2.5 px-3">FLIGHT</th>
                    <th className="py-2.5 px-3">ROUTE</th>
                    <th className="py-2.5 px-3">A/C REG</th>
                    <th className="py-2.5 px-3">STD</th>
                    <th className="py-2.5 px-3">BAY</th>
                    <th className="py-2.5 px-3">C/ON</th>
                    <th className="py-2.5 px-3">D/C</th>
                    <th className="py-2.5 px-3">C/OFF</th>
                    <th className="py-2.5 px-3">GROUND TIME</th>
                    <th className="py-2.5 px-3">SECURITY (ST/END/DUR)</th>
                    <th className="py-2.5 px-3">CLEANING (ST/END/DUR)</th>
                    <th className="py-2.5 px-3">BOARDING (PRMT/PAX/DUR)</th>
                    <th className="py-2.5 px-3">TRIM (SUB/SGN)</th>
                    <th className="py-2.5 px-3">VIP (PAX/BAG)</th>
                    <th className="py-2.5 px-3">MAAS / PRIORITY</th>
                    <th className="py-2.5 px-3">FIRE ARMS / RUSH</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">DELAY REASON</th>
                    <th className="py-2.5 px-3">OFFICER</th>
                    <th className="py-2.5 px-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {processedRows.map((r, i) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-800/60 transition-colors font-medium text-slate-200 text-xs"
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-black border border-amber-500/40 text-[10px]">
                          {r.station}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-black text-amber-400">{r.flight}</td>
                      <td className="py-2 px-3 font-mono font-bold text-white">{r.route}</td>
                      <td className="py-2 px-3 font-mono font-bold text-cyan-300">{r.ac}</td>
                      <td className="py-2 px-3 font-mono">{r.std}</td>
                      <td className="py-2 px-3 font-mono">{r.bay}</td>
                      <td className="py-2 px-3 font-mono">{r.conVal}</td>
                      <td className="py-2 px-3 font-mono">{r.dcVal}</td>
                      <td className="py-2 px-3 font-mono">{r.coVal}</td>
                      <td className="py-2 px-3 font-mono font-bold text-amber-300">{r.groundTime.text}</td>

                      {/* Security Check */}
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span>{r.securitySt}</span> - <span>{r.securityEnd}</span>{' '}
                        <span className="text-cyan-400 font-bold">({r.securityDuration.durationText})</span>
                      </td>

                      {/* Cleaning */}
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span>{r.cleaningSt}</span> - <span>{r.cleaningEnd}</span>{' '}
                        <span className="text-cyan-400 font-bold">({r.cleaningDuration.durationText})</span>
                      </td>

                      {/* Boarding */}
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span>{r.permit}</span> - <span>{r.pax}</span>{' '}
                        <span className="text-cyan-400 font-bold">({r.boardingDuration.durationText})</span>
                      </td>

                      {/* Trim */}
                      <td className="py-2 px-3 font-mono text-[11px]">
                        <span>{r.trimSubmitted}</span> / <span>{r.trimSigned}</span>
                      </td>

                      {/* VIP */}
                      <td className="py-2 px-3 font-mono text-[11px] text-amber-300 font-bold">
                        {r.vipPax} PAX / {r.vipBag} BAG
                      </td>

                      {/* MAAS & Priority */}
                      <td className="py-2 px-3 font-mono text-[11px] text-cyan-300 font-bold">
                        {r.maasPax} MAAS / {r.priorityBag} BAG
                      </td>

                      {/* Fire Arms & Rush */}
                      <td className="py-2 px-3 font-mono text-[11px] text-rose-300 font-bold">
                        {r.fireArms} FA / {r.rushBag} RUSH
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                            r.statusType === 'DELAY'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : r.statusType === 'EARLY'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Delay Reason */}
                      <td className="py-2 px-3 text-slate-300 text-[11px] max-w-xs truncate" title={r.delayReason}>
                        {r.delayReason || '-'}
                      </td>

                      {/* Officer */}
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{r.officer}</td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedReportDetail(r.originalReport)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white transition-colors cursor-pointer"
                            title="View Full Report Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteFlight(r.id, r.flight)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors cursor-pointer"
                            title="Remove flight from analytical list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* PHOTO CARD VIEW CONTAINER - KEPT IN DOM AT ALL TIMES FOR RELIABLE EXPORTS */}
        <div
          className={
            viewMode === 'PHOTO_CARD'
              ? 'flex flex-col items-center justify-start overflow-auto p-4 space-y-4'
              : 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none'
          }
        >
          <div className="flex items-center justify-between w-full max-w-[1200px] px-2 text-xs text-slate-400 font-bold uppercase">
              <span>Official 1200px Photo Card Preview:</span>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCustomPhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 cursor-pointer"
                >
                  📷 Change Aircraft Photo
                </button>
                {customPhotoUrl && (
                  <button
                    onClick={() => setCustomPhotoUrl(null)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-800 text-rose-300 text-[11px] font-bold border border-slate-700 cursor-pointer"
                  >
                    Reset Photo
                  </button>
                )}
              </div>
            </div>

            {/* Canvas Container at 1200px */}
            <div
              ref={printCardRef}
              style={{
                width: '1200px',
                minWidth: '1200px',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: 'Arial, Helvetica, sans-serif',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '4px solid #002244'
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #002244 0%, #003366 100%)',
                  padding: '24px 30px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '4px solid #ffcc00'
                }}
              >
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '1px', color: '#ffcc00' }}>
                    US-BANGLA AIRLINES
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                    OUT STATION TIME & TURNAROUND ANALYTICAL REPORT
                  </div>
                  <div style={{ fontSize: '13px', color: '#99bbdd', marginTop: '4px', fontWeight: 600 }}>
                    STATION SCOPE: {selectedStationFilter === 'ALL' ? 'ALL OUT STATIONS (CXB, CGP, SPD, ZYL, JSR, RJH, BZL)' : selectedStationFilter}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff' }}>{activeDateDisplay}</div>
                  <div style={{ fontSize: '12px', color: '#ffcc00', fontWeight: 800, marginTop: '2px' }}>
                    APP BUILD BY USBA-20088
                  </div>
                  <div style={{ fontSize: '11px', color: '#cccccc', marginTop: '2px' }}>
                    SUPER ADMIN MASTER REPORT
                  </div>
                </div>
              </div>

              {/* Aircraft Photo Banner */}
              <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden' }}>
                <img
                  src={customPhotoUrl || aircraftImage}
                  alt="US-Bangla Aircraft"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to right, rgba(0,34,68,0.85) 0%, rgba(0,34,68,0.2) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 30px'
                  }}
                >
                  <div style={{ color: '#ffffff' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffcc00' }}>
                      OUT STATION DEPARTURE FLIGHTS ANALYSIS
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e0e0e0', marginTop: '4px' }}>
                      Official Operational Ramp Monitoring & Milestone Durations
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary KPIs Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  backgroundColor: '#f4f6f9',
                  borderBottom: '2px solid #002244',
                  padding: '12px 20px',
                  textAlign: 'center'
                }}
              >
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>TOTAL DEPARTURES</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#002244' }}>{summaryKPIs.total}</div>
                </div>
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>ON-TIME PERF (OTP)</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#008800' }}>{summaryKPIs.otpPct}%</div>
                </div>
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>STATUS RATIO</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#002244', marginTop: '6px' }}>
                    <span style={{ color: '#008800' }}>{summaryKPIs.ontimeCount} OT</span> /{' '}
                    <span style={{ color: '#cc0000' }}>{summaryKPIs.delayCount} DL</span>
                  </div>
                </div>
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>AVG GROUND TIME</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#0055aa' }}>
                    {summaryKPIs.avgGround > 0 ? `${summaryKPIs.avgGround} MIN` : 'ON GROUND'}
                  </div>
                </div>
                <div style={{ borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>VIP TOTALS</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#b8860b', marginTop: '6px' }}>
                    {summaryKPIs.totalVipPax} PAX / {summaryKPIs.totalVipBags} BAGS
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#666' }}>MAAS & FIRE ARMS</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#002244', marginTop: '6px' }}>
                    {summaryKPIs.totalPriorityBags} PR / {summaryKPIs.totalFireArms} FA
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div style={{ padding: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#002244', color: '#ffffff' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>SL</th>
                      <th style={{ padding: '8px 6px' }}>STN</th>
                      <th style={{ padding: '8px 6px' }}>FLIGHT</th>
                      <th style={{ padding: '8px 6px' }}>ROUTE</th>
                      <th style={{ padding: '8px 6px' }}>REG</th>
                      <th style={{ padding: '8px 6px' }}>STD</th>
                      <th style={{ padding: '8px 6px' }}>BAY</th>
                      <th style={{ padding: '8px 6px' }}>GROUND</th>
                      <th style={{ padding: '8px 6px' }}>SECURITY</th>
                      <th style={{ padding: '8px 6px' }}>CLEANING</th>
                      <th style={{ padding: '8px 6px' }}>BOARDING</th>
                      <th style={{ padding: '8px 6px' }}>TRIM</th>
                      <th style={{ padding: '8px 6px' }}>VIP</th>
                      <th style={{ padding: '8px 6px' }}>MAAS/PR</th>
                      <th style={{ padding: '8px 6px' }}>FA/RUSH</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>STATUS</th>
                      <th style={{ padding: '8px 6px' }}>OFFICER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedRows.map((r, i) => (
                      <tr
                        key={`card-row-${r.id}`}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fbfd',
                          borderBottom: '1px solid #e1e8ed'
                        }}
                      >
                        <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 800 }}>{i + 1}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 900, color: '#002244' }}>{r.station}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 900, color: '#b8860b' }}>{r.flight}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 800 }}>{r.route}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 800, color: '#0055aa' }}>{r.ac}</td>
                        <td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{r.std}</td>
                        <td style={{ padding: '6px 4px' }}>{r.bay}</td>
                        <td style={{ padding: '6px 4px', fontWeight: 800, color: '#002244' }}>{r.groundTime.text}</td>
                        <td style={{ padding: '6px 4px', fontSize: '10px' }}>
                          {r.securitySt}-{r.securityEnd} ({r.securityDuration.durationText})
                        </td>
                        <td style={{ padding: '6px 4px', fontSize: '10px' }}>
                          {r.cleaningSt}-{r.cleaningEnd} ({r.cleaningDuration.durationText})
                        </td>
                        <td style={{ padding: '6px 4px', fontSize: '10px' }}>
                          {r.permit}-{r.pax} ({r.boardingDuration.durationText})
                        </td>
                        <td style={{ padding: '6px 4px', fontSize: '10px' }}>
                          {r.trimSubmitted}/{r.trimSigned}
                        </td>
                        <td style={{ padding: '6px 4px', fontWeight: 800, color: '#b8860b' }}>
                          {r.vipPax}P/{r.vipBag}B
                        </td>
                        <td style={{ padding: '6px 4px', fontWeight: 800, color: '#0055aa' }}>
                          {r.maasPax}M/{r.priorityBag}B
                        </td>
                        <td style={{ padding: '6px 4px', fontWeight: 800, color: '#aa0000' }}>
                          {r.fireArms}FA/{r.rushBag}R
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 900,
                              backgroundColor:
                                r.statusType === 'DELAY' ? '#ffebee' : r.statusType === 'EARLY' ? '#e8f0fe' : '#e8f5e9',
                              color:
                                r.statusType === 'DELAY' ? '#cc0000' : r.statusType === 'EARLY' ? '#0055aa' : '#008800'
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 4px', fontSize: '10px', color: '#555' }}>{r.officer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Card Footer */}
              <div
                style={{
                  backgroundColor: '#002244',
                  color: '#ffffff',
                  padding: '16px 30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '3px solid #ffcc00'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800 }}>US-BANGLA AIRLINES RAMP OPERATIONS</div>
                  <div style={{ fontSize: '10px', color: '#aaaaaa' }}>
                    Generated on {new Date().toLocaleString()} | Official Analytical Document
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800 }}>
                    DUTY OFFICER / SUPER ADMIN: {adminName || 'USBA MASTER'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#ffcc00' }}>
                    APPLICATION BUILD BY USBA-20088
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Report Detail Modal */}
      {selectedReportDetail && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-lg w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  FLIGHT DETAILS: BS-{selectedReportDetail.formData?.deptFlt || selectedReportDetail.flight}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">STATION</span>
                <span className="text-amber-400 font-bold font-mono">
                  {getReportStation(selectedReportDetail)}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">DATE</span>
                <span className="text-white font-bold">{selectedReportDetail.formData?.date}</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">ROUTE</span>
                <span className="text-white font-bold">{selectedReportDetail.formData?.deptRoute}</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">A/C REG</span>
                <span className="text-cyan-400 font-bold">{selectedReportDetail.formData?.ac}</span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">STD / BAY</span>
                <span className="text-white font-bold">
                  {selectedReportDetail.formData?.std} / Bay {selectedReportDetail.formData?.bay}
                </span>
              </div>
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">GROUND TIME</span>
                <span className="text-amber-300 font-bold">{selectedReportDetail.formData?.ground}</span>
              </div>
            </div>

            {/* Outstation Passenger & Baggage breakdown */}
            <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 space-y-1.5">
              <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider block">
                OUTSTATION PASSENGER & BAGGAGE STATS
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[9px] block">VIP PAX</span>
                  <span className="text-amber-300 font-bold">{selectedReportDetail.formData?.vipPax || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">VIP BAG</span>
                  <span className="text-amber-300 font-bold">{selectedReportDetail.formData?.vipBag || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">MAAS PAX</span>
                  <span className="text-cyan-300 font-bold">{selectedReportDetail.formData?.maasPax || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">PRIORITY BAG</span>
                  <span className="text-cyan-300 font-bold">{selectedReportDetail.formData?.priorityBag || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">FIRE ARMS</span>
                  <span className="text-rose-400 font-bold">{selectedReportDetail.formData?.fireArms || '0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[9px] block">RUSH BAG</span>
                  <span className="text-purple-300 font-bold">{selectedReportDetail.formData?.rushBag || '0'}</span>
                </div>
              </div>
            </div>

            {selectedReportDetail.formData?.delayReason && (
              <div className="bg-slate-950 p-2.5 rounded-xl border border-rose-500/30">
                <span className="text-[10px] font-bold text-rose-400 uppercase block">DELAY REASON:</span>
                <p className="text-xs text-slate-300 mt-0.5">{selectedReportDetail.formData?.delayReason}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
