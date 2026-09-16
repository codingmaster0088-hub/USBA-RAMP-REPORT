import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Calendar,
  Plane,
  Clock,
  User,
  MapPin,
  Users,
  Bus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { SavedReport, UserProfile } from '../types';
import { verifiedFlightReports } from '../data/verifiedFlightReports';

interface SpecificFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedReports: SavedReport[];
  user: UserProfile;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

// The 5 Target Flights with canonical route headers as shown in Attachment 3
export const TARGET_SPECIFIC_FLIGHTS = [
  { fltNum: '101', header: 'BS-101 (CGP)', route: 'CGP' },
  { fltNum: '531', header: 'BS-531 (ZYL)', route: 'ZYL' },
  { fltNum: '141', header: 'BS-141 (CXB)', route: 'CXB' },
  { fltNum: '161', header: 'BS-161 (RJH)', route: 'RJH' },
  { fltNum: '183', header: 'BS-183 (SPD)', route: 'SPD' }
] as const;

// 10 Specific Row Metrics as designated in Attachment 3
export const SPECIFIC_ROW_FIELDS = [
  { id: 'std', label: 'STD', icon: Clock },
  { id: 'acft', label: 'ACFT', icon: Plane },
  { id: 'pic', label: 'PIC', icon: User },
  { id: 'bay', label: 'BAY', icon: MapPin },
  { id: 'crew', label: 'CREW REPORTING', icon: Users },
  { id: 'bus', label: '1st BUS REPORTING', icon: Bus },
  { id: 'boarding', label: 'ACFT BOARDING', icon: ShieldCheck },
  { id: 'allBoarded', label: 'ALL BOARDED', icon: CheckCircle2 },
  { id: 'fltStatus', label: 'FLT STATUS', icon: Clock },
  { id: 'dlyReason', label: 'DLY REASON', icon: AlertTriangle }
] as const;

// Helper to extract clean flight number (e.g. 'BS-101' -> '101')
function cleanFlightNum(val: string): string {
  if (!val) return '';
  const m = val.match(/\d{3,4}/);
  return m ? m[0] : val.replace(/[^0-9]/g, '');
}

// Robust date parser into normalized ISO (YYYY-MM-DD), display (DD.MM.YY), and timestamp
function parseDateDetails(rawDate: string): { iso: string; display: string; timestamp: number } {
  if (!rawDate) {
    const d = new Date();
    const iso = d.toISOString().split('T')[0];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return { iso, display: `${dd}.${mm}.${yy}`, timestamp: d.getTime() };
  }

  const str = rawDate.trim().toUpperCase();

  // Handle DD.MM.YY or DD.MM.YYYY
  const dotParts = str.split('.');
  if (dotParts.length === 3) {
    const day = parseInt(dotParts[0], 10);
    const month = parseInt(dotParts[1], 10);
    let year = parseInt(dotParts[2], 10);
    if (year < 100) year += 2000;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
    return { iso, display, timestamp: new Date(year, month - 1, day).getTime() };
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map((n) => parseInt(n, 10));
    const display = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${String(y).slice(-2)}`;
    return { iso: str, display, timestamp: new Date(y, m - 1, d).getTime() };
  }

  // Handle DD MMM YY (e.g., 13 SEP 26)
  const monthMap: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };
  const spaceParts = str.split(/[\s-]+/);
  if (spaceParts.length >= 3) {
    const day = parseInt(spaceParts[0], 10);
    const mStr = spaceParts[1].slice(0, 3);
    const month = monthMap[mStr];
    let year = parseInt(spaceParts[2], 10);
    if (year < 100) year += 2000;
    if (month && !isNaN(day) && !isNaN(year)) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const display = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${String(year).slice(-2)}`;
      return { iso, display, timestamp: new Date(year, month - 1, day).getTime() };
    }
  }

  // Fallback
  const parsedTime = Date.parse(rawDate);
  if (!isNaN(parsedTime)) {
    const d = new Date(parsedTime);
    const iso = d.toISOString().split('T')[0];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return { iso, display: `${dd}.${mm}.${yy}`, timestamp: d.getTime() };
  }

  return { iso: '2026-09-13', display: '13.09.26', timestamp: Date.now() };
}

export const SpecificFlightModal: React.FC<SpecificFlightModalProps> = ({
  isOpen,
  onClose,
  savedReports,
  user,
  showToast
}) => {
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC'); // Serial order (Attachment 3 shows chronological ascending)
  const [flightFilter, setFlightFilter] = useState<'ALL' | '101' | '531' | '141' | '161' | '183'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 30 Days Retention Window
  const thirtyDaysAgoTimestamp = useMemo(() => {
    return Date.now() - 30 * 24 * 60 * 60 * 1000;
  }, []);

  // Combine and deduplicate reports from savedReports and verifiedFlightReports
  const processedData = useMemo(() => {
    const targetFlightNumbers = new Set<string>(TARGET_SPECIFIC_FLIGHTS.map((t) => t.fltNum));

    // Combine all reports
    const allReports: SavedReport[] = [...savedReports, ...(verifiedFlightReports as SavedReport[])];

    // Map by: dateDisplay -> { fltNum -> report }
    const dateMap = new Map<
      string,
      {
        iso: string;
        display: string;
        timestamp: number;
        flights: Record<string, SavedReport>;
      }
    >();

    allReports.forEach((rep) => {
      const fltNum = cleanFlightNum(rep.formData?.deptFlt || rep.flight || rep.formData?.arvFlt || '');
      if (!targetFlightNumbers.has(fltNum)) return;

      const rawDate = rep.formData?.date || rep.date || '';
      const dateDetails = parseDateDetails(rawDate);

      // Check 30-day retention constraint
      if (dateDetails.timestamp < thirtyDaysAgoTimestamp) {
        return; // Auto-erase from report older than 30 days
      }

      if (!dateMap.has(dateDetails.display)) {
        dateMap.set(dateDetails.display, {
          iso: dateDetails.iso,
          display: dateDetails.display,
          timestamp: dateDetails.timestamp,
          flights: {}
        });
      }

      const dayGroup = dateMap.get(dateDetails.display)!;
      // Overwrite or set (favor latest or most complete data)
      if (!dayGroup.flights[fltNum] || rep.createdAt! > (dayGroup.flights[fltNum].createdAt || 0)) {
        dayGroup.flights[fltNum] = rep;
      }
    });

    // Convert map to sorted date groups
    const groups = Array.from(dateMap.values())
      .filter((group) => {
        // Must have at least one of the 5 specific flights
        const availableFlts = Object.keys(group.flights);
        return availableFlts.length > 0;
      })
      .sort((a, b) => {
        return sortOrder === 'ASC' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      });

    return groups;
  }, [savedReports, thirtyDaysAgoTimestamp, sortOrder]);

  // Filtered groups based on search & flight filter
  const filteredGroups = useMemo(() => {
    return processedData.filter((group) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDate = group.display.toLowerCase().includes(q) || group.iso.toLowerCase().includes(q);
        const flightList = Object.values(group.flights) as SavedReport[];
        const matchesFlight = flightList.some((r) => {
          const pic = (r.formData?.pic || '').toLowerCase();
          const ac = (r.formData?.ac || '').toLowerCase();
          const status = (r.formData?.status || '').toLowerCase();
          return pic.includes(q) || ac.includes(q) || status.includes(q);
        });
        if (!matchesDate && !matchesFlight) return false;
      }

      if (flightFilter !== 'ALL') {
        if (!group.flights[flightFilter]) return false;
      }

      return true;
    });
  }, [processedData, searchQuery, flightFilter]);

  // Extract cell value according to row field and report
  const getCellValue = (fieldId: string, rep: SavedReport | undefined): string => {
    if (!rep || !rep.formData) return '';
    const form = rep.formData;

    switch (fieldId) {
      case 'std':
        return form.std || '';
      case 'acft':
        // Clean aircraft registration as shown in Attachment 3 (e.g. 'AKH', 'AKK')
        return (form.ac || '').replace(/^S2-?/i, '').trim();
      case 'pic':
        return (form.pic || '').trim();
      case 'bay':
        return (form.bay || '').trim();
      case 'crew':
        return (form.crew || '').trim();
      case 'bus':
        return (form.firstBusPax || '').trim();
      case 'boarding':
        return (form.permit || '').trim();
      case 'allBoarded':
        return (form.pax || '').trim();
      case 'fltStatus':
        return (form.status || '').trim();
      case 'dlyReason': {
        const status = (form.status || '').toUpperCase();
        const isEarlyOrOnTime =
          status.includes('EARLY') ||
          status.includes('ONTIME') ||
          status.includes('ON TIME') ||
          status.includes('ON-TIME');
        const isDelay =
          (status.includes('DLY') || status.includes('DELAY')) && !isEarlyOrOnTime;

        // If the flight is ONTIME or EARLY, the delay reason row will be empty
        if (!isDelay) {
          return '';
        }
        return (form.delayRemarks || form.delayReason || '').trim();
      }
      default:
        return '';
    }
  };

  // Helper to colorize status (EARLY / ON TIME in green, DLY in amber/rose)
  const renderCellContent = (fieldId: string, value: string) => {
    if (fieldId === 'dlyReason') {
      if (!value) return null;
      return (
        <span className="text-amber-300 font-sans text-[10px] leading-tight block max-w-[220px]">
          {value}
        </span>
      );
    }

    if (!value) return <span className="text-slate-600 font-mono">-</span>;

    if (fieldId === 'fltStatus') {
      const isDelay = value.toUpperCase().includes('DLY') || value.toUpperCase().includes('DELAY');
      const isEarly = value.toUpperCase().includes('EARLY') || value.toUpperCase().includes('ON TIME');
      return (
        <span
          className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
            isDelay
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : isEarly
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-200'
          }`}
        >
          {value}
        </span>
      );
    }

    if (fieldId === 'pic') {
      return <span className="font-bold text-cyan-300 uppercase tracking-wide">{value}</span>;
    }

    if (fieldId === 'acft') {
      return <span className="font-mono font-extrabold text-amber-400">{value}</span>;
    }

    return <span className="font-mono text-slate-200">{value}</span>;
  };

  // Download Excel in exact layout as Attachment 3
  const handleDownloadExcel = () => {
    if (processedData.length === 0) {
      showToast('No Data', 'No specific flight records available for the last 30 days', 'info');
      return;
    }

    try {
      // Build HTML spreadsheet (.xls) with styling that Microsoft Excel opens seamlessly
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
                  <x:Name>Specific Flight 30 Days</x:Name>
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
            th, td { border: 1px solid #000000; padding: 6px 10px; font-size: 11pt; text-align: center; vertical-align: middle; }
            .date-cell { background-color: #E2EFDA; font-weight: bold; font-size: 13pt; text-align: center; }
            .header-flt { background-color: #BDD7EE; font-weight: bold; font-size: 11pt; }
            .metric-label { background-color: #F2F2F2; font-weight: bold; text-align: left; }
            .status-dly { background-color: #FCE4D6; color: #C00000; font-weight: bold; }
            .status-ok { background-color: #E2EFDA; color: #375623; font-weight: bold; }
            .reason-cell { text-align: left; font-size: 10pt; }
            .blank-row { border: none; height: 16px; }
          </style>
        </head>
        <body>
          <h2 style="font-family: Arial; margin-bottom: 4px;">US-BANGLA AIRLINES - SPECIFIC FLIGHT REPORT (LAST 30 DAYS)</h2>
          <p style="font-family: Arial; font-size: 10pt; color: #555; margin-top: 0;">BS-101 (CGP), BS-531 (ZYL), BS-141 (CXB), BS-161 (RJH), BS-183 (SPD)</p>
          <br/>
      `;

      processedData.forEach((group) => {
        // Active target flights on this specific date
        const activeFlightsOnDay = TARGET_SPECIFIC_FLIGHTS.filter((t) => group.flights[t.fltNum]);
        if (activeFlightsOnDay.length === 0) return;

        xml += `
          <table>
            <thead>
              <tr>
                <th class="date-cell" rowspan="11">${group.display}</th>
                <th class="metric-label">FLT NO</th>
                ${activeFlightsOnDay.map((t) => `<th class="header-flt">${t.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
        `;

        SPECIFIC_ROW_FIELDS.forEach((row) => {
          xml += `<tr><td class="metric-label">${row.label}</td>`;
          activeFlightsOnDay.forEach((t) => {
            const rep = group.flights[t.fltNum];
            const val = getCellValue(row.id, rep);
            let cls = '';
            if (row.id === 'fltStatus') {
              if (val.toUpperCase().includes('DLY') || val.toUpperCase().includes('DELAY')) {
                cls = 'class="status-dly"';
              } else if (val.toUpperCase().includes('EARLY') || val.toUpperCase().includes('ON TIME')) {
                cls = 'class="status-ok"';
              }
            } else if (row.id === 'dlyReason') {
              cls = 'class="reason-cell"';
            }
            xml += `<td ${cls}>${val || ''}</td>`;
          });
          xml += `</tr>`;
        });

        xml += `
            </tbody>
          </table>
          <br/>
        `;
      });

      xml += `
        </body>
        </html>
      `;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `US_BANGLA_SPECIFIC_FLIGHTS_30DAYS_${new Date().toISOString().split('T')[0]}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Excel Downloaded', 'Specific flight report exported with 30-day serial format', 'success');
    } catch (err) {
      console.error('Excel Export Error:', err);
      showToast('Export Failed', 'Unable to export Excel file', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto fade-in">
      <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  SPECIFIC FLIGHT REPORT (30-DAY RETENTION)
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  BS-101, 531, 141, 161, 183
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Serial date-wise turnaround performance for target morning departures (Auto-purges &gt;30 days)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Download Excel Report for last 30 days"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>DOWNLOAD EXCEL</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono font-bold text-white">{processedData.length} DATES RECORDED</span>
            </div>

            {/* Flight Filter */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
              <Filter className="w-3 h-3 text-slate-400 ml-1" />
              <button
                onClick={() => setFlightFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-colors ${
                  flightFilter === 'ALL' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL
              </button>
              {TARGET_SPECIFIC_FLIGHTS.map((f) => (
                <button
                  key={f.fltNum}
                  onClick={() => setFlightFilter(f.fltNum as any)}
                  className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-colors ${
                    flightFilter === f.fltNum ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.fltNum}
                </button>
              ))}
            </div>

            {/* Sort Toggle (Defaults to OLD - NEW) */}
            <button
              onClick={() => setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors cursor-pointer select-none"
              title="Toggle sort order between OLD - NEW and NEW - OLD"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono font-bold">
                {sortOrder === 'ASC' ? 'OLD - NEW' : 'NEW - OLD'}
              </span>
            </button>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search date, PIC, ACFT or status..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-400 outline-none font-mono"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-8">
              <Plane className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-300 uppercase">NO SPECIFIC FLIGHT DATA AVAILABLE</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No reports for BS-101, BS-531, BS-141, BS-161, or BS-183 within the last 30 days matched your filter.
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              // Active flights operating on this specific date
              const activeFlightsOnDay = TARGET_SPECIFIC_FLIGHTS.filter((t) => {
                if (flightFilter !== 'ALL' && t.fltNum !== flightFilter) return false;
                return group.flights[t.fltNum];
              });

              if (activeFlightsOnDay.length === 0) return null;

              return (
                <div
                  key={group.display}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-2xl overflow-hidden shadow-xl transition-colors"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/90 text-xs">
                          {/* Date Column Header (Rotated vertical label on desktop or side badge) */}
                          <th className="w-28 p-3 text-center border-r border-slate-800 bg-emerald-950/40 text-emerald-300 font-mono font-black text-sm tracking-wider">
                            {group.display}
                          </th>
                          <th className="w-44 p-3 font-black text-slate-400 uppercase tracking-wider text-[11px] border-r border-slate-800">
                            FLT NO
                          </th>
                          {activeFlightsOnDay.map((t) => (
                            <th
                              key={t.fltNum}
                              className="p-3 font-mono font-black text-cyan-300 uppercase text-xs border-r border-slate-800 last:border-r-0 min-w-[150px] bg-slate-900/60"
                            >
                              <div className="flex items-center justify-between">
                                <span>{t.header}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                  {t.route}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {SPECIFIC_ROW_FIELDS.map((row) => {
                          const IconComp = row.icon;
                          return (
                            <tr key={row.id} className="hover:bg-slate-900/50 transition-colors">
                              {/* Empty date cell spacer on rows so date header spans visually */}
                              <td className="p-2 border-r border-slate-800 text-center bg-emerald-950/20">
                                <span className="text-[10px] font-mono text-emerald-500/40 select-none">•</span>
                              </td>

                              <td className="p-2.5 font-mono font-bold text-slate-300 flex items-center gap-2 border-r border-slate-800">
                                <IconComp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{row.label}</span>
                              </td>

                              {activeFlightsOnDay.map((t) => {
                                const rep = group.flights[t.fltNum];
                                const cellValue = getCellValue(row.id, rep);
                                return (
                                  <td
                                    key={t.fltNum}
                                    className="p-2.5 border-r border-slate-800 last:border-r-0 align-middle"
                                  >
                                    {renderCellContent(row.id, cellValue)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Target Group: BS-101, BS-531, BS-141, BS-161, BS-183</span>
          </div>
          <div>30-Day Rolling Storage Active</div>
        </div>
      </div>
    </div>
  );
};
