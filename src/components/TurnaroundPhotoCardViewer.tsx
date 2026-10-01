import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  X,
  Calendar,
  Plane,
  Clock,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { SavedReport, RampReportFormData, ReportType, FlightMode, UserProfile } from '../types';
import { captureHtml2CanvasSafe } from '../utils/html2canvasHelper';

interface TurnaroundPhotoCardViewerProps {
  report: SavedReport;
  onClose: () => void;
  onDownloadJPG?: (report: SavedReport) => void;
  availableDatesForFlight?: { dateDisplay: string; dateIso: string; report: SavedReport }[];
  onSelectDateReport?: (report: SavedReport) => void;
  isDarkMode?: boolean;
}

const formatTimeLT = (val?: string) => {
  if (!val || !val.trim()) return '';
  const trimmed = val.trim();
  if (
    trimmed === 'OB' ||
    trimmed === 'EARLIER' ||
    trimmed === 'N/A' ||
    trimmed === 'ON GROUND' ||
    trimmed.endsWith('LT') ||
    trimmed.endsWith('(LT)')
  ) {
    return trimmed;
  }
  return `${trimmed} LT`;
};

const isFieldEmptyOrNil = (val?: string | number): boolean => {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  if (str === '') return true;
  const upper = str.toUpperCase();
  if (
    upper === '0' ||
    upper === '00' ||
    upper === '000' ||
    upper === 'NIL' ||
    upper === 'NIL.' ||
    upper === 'N/A' ||
    upper === 'NA' ||
    upper === 'NONE' ||
    upper === '-' ||
    upper === '--' ||
    upper === '0 / NIL' ||
    upper === '0/NIL' ||
    upper === 'NIL / 0' ||
    upper === 'NIL/0' ||
    upper === '0 / NIL / BLANK' ||
    upper === 'N I L' ||
    upper === 'NULL'
  ) {
    return true;
  }
  if (/^0+$/.test(str)) {
    return true;
  }
  const num = Number(str);
  if (!isNaN(num) && num === 0) {
    return true;
  }
  return false;
};

const formatBagCount = (val?: string) => {
  if (isFieldEmptyOrNil(val)) return null;
  const num = parseInt(val!.trim(), 10);
  if (isNaN(num) || num <= 0) return null;
  const padNum = num < 10 ? `0${num}` : `${num}`;
  const unit = num === 1 ? 'PC' : 'PCS';
  return `${padNum} ${unit}`;
};

const getPicNameFontSize = (name: string): string => {
  const len = name.length;
  if (len > 28) return '20px';
  if (len > 20) return '22px';
  return '24px';
};

export const TurnaroundPhotoCardViewer: React.FC<TurnaroundPhotoCardViewerProps> = ({
  report,
  onClose,
  onDownloadJPG,
  availableDatesForFlight = [],
  onSelectDateReport,
  isDarkMode = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1.0 = 100% actual size
  const [cardHeight, setCardHeight] = useState<number>(1450);

  const formData: RampReportFormData = report.formData || {} as RampReportFormData;
  const type: ReportType = report.type || 'DOMESTIC';
  const mode: FlightMode = report.mode || 'ROUND';
  const officerUser: UserProfile = {
    id: report.officerId || '0000',
    name: report.officerName || 'RAMP OFFICER',
    station: (formData.station || 'DAC') as any
  };

  const rawFlight = (formData.deptFlt || formData.arvFlt || report.flight || 'FLIGHT').replace(/^BS-?/i, '').trim();
  const flightTitle = `BS-${rawFlight} (${formData.deptRoute || formData.arvRoute || report.route || 'ROUTE'})`;
  const isDelay = formData.status?.includes('DELAY');
  const isEarly = formData.status?.includes('EARLY');

  const rawPic = (formData.pic || '').trim();
  const cleanPicName = rawPic.replace(/^PIC:?\s*/i, '').toUpperCase();

  const calculateOptimalFit = () => {
    const currentCardHeight = cardRef.current?.offsetHeight || cardHeight || 1450;
    let availableWidth = 1000;
    let availableHeight = 600;

    if (containerRef.current) {
      availableWidth = containerRef.current.clientWidth - 32;
      availableHeight = containerRef.current.clientHeight - 32;
    }

    if (availableHeight <= 100) {
      availableHeight = Math.max(380, window.innerHeight - 220);
    }
    if (availableWidth <= 100) {
      availableWidth = Math.max(500, window.innerWidth - 80);
    }

    const scaleW = availableWidth / 1280;
    const scaleH = availableHeight / currentCardHeight;
    // Take the smaller scale so BOTH width and height fit completely in display at a glance without scrolling down or right
    const bestScale = Math.min(scaleW, scaleH);
    const clampedScale = Math.min(1.0, Math.max(0.25, Math.round(bestScale * 100) / 100));
    setZoomLevel(clampedScale);
  };

  // Dynamically observe card height so scaled container height is always exact
  useEffect(() => {
    if (!cardRef.current) return;
    setCardHeight(cardRef.current.offsetHeight || 1450);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.clientHeight) {
          setCardHeight(entry.target.clientHeight);
        }
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [report]);

  // Automatically adjust photo card view size to see full report at a glance immediately
  useEffect(() => {
    const initialH = Math.max(380, window.innerHeight - 220);
    const initialW = Math.max(500, window.innerWidth - 80);
    const initialScale = Math.min(1.0, Math.max(0.25, Math.min(initialW / 1280, initialH / 1450)));
    setZoomLevel(Math.round(initialScale * 100) / 100);

    const timer = setTimeout(() => {
      calculateOptimalFit();
    }, 100);

    return () => clearTimeout(timer);
  }, [report]);

  useEffect(() => {
    const handleResize = () => {
      calculateOptimalFit();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.8, Math.round((prev + 0.05) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.25, Math.round((prev - 0.05) * 100) / 100));
  };

  const handleActualSize = () => {
    setZoomLevel(1.0);
  };

  const handleFitScreen = () => {
    calculateOptimalFit();
  };

  const handleDownload = async () => {
    if (onDownloadJPG) {
      onDownloadJPG(report);
      return;
    }

    if (!cardRef.current) return;
    const originalTransform = cardRef.current.style.transform;
    const originalPosition = cardRef.current.style.position;
    try {
      setIsExporting(true);
      // Temporarily reset transform for unscaled crisp capture
      cardRef.current.style.transform = 'none';
      cardRef.current.style.position = 'static';
      const canvas = await captureHtml2CanvasSafe(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const fileName = `${flightTitle.replace(/[^\w\s-()]/gi, '')}.jpg`;
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to capture card as JPG:', err);
    } finally {
      if (cardRef.current) {
        cardRef.current.style.transform = originalTransform;
        cardRef.current.style.position = originalPosition;
      }
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Top Action & Navigation Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title="Return to Table"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>BACK TO TABLE</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-amber-400 text-sm sm:text-base">
                BS-{rawFlight}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border font-mono ${
                isDarkMode ? 'bg-slate-950 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-900 border-cyan-200'
              }`}>
                {formData.deptRoute || formData.arvRoute || report.route || 'ROUTE'}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                isDarkMode ? 'bg-slate-950 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {formData.date || report.date}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Official Ramp Photo Card generated by <strong className="text-white">{report.officerName || 'Ramp Officer'}</strong> (ID-{report.officerId || '0000'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom Controls: Actual Size, Zoom In, Zoom Out, Fit */}
          <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.35}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer"
              title="Zoom Out (-10%)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-xs font-black text-amber-400 min-w-[46px] text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 1.8}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer"
              title="Zoom In (+10%)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-0.5" />

            <button
              type="button"
              onClick={handleActualSize}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer ${
                Math.abs(zoomLevel - 1.0) < 0.01
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="View 100% Actual Size (1280px)"
            >
              ACTUAL (100%)
            </button>

            <button
              type="button"
              onClick={handleFitScreen}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 hover:text-white hover:bg-cyan-500/30 border border-cyan-500/40 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              title="Fit entire report card to screen at a glance without scrolling"
            >
              <Maximize2 className="w-3 h-3 text-cyan-400" />
              <span>FIT (AT A GLANCE)</span>
            </button>
          </div>

          {/* Multiple Dates Switcher if flight has reports across multiple days */}
          {availableDatesForFlight.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-2 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" /> DATE:
              </span>
              {availableDatesForFlight.map((d) => {
                const isSelected = d.report.id === report.id || d.dateIso === report.date || d.dateDisplay === report.date;
                return (
                  <button
                    key={d.report.id}
                    onClick={() => onSelectDateReport && onSelectDateReport(d.report)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {d.dateDisplay}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-slate-950 font-mono text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>DOWNLOAD JPG</span>
          </button>
        </div>
      </div>

      {/* Responsive Visual Card Container with Smooth Scaling - Full report visible at a glance */}
      <div
        ref={containerRef}
        className="w-full flex-1 overflow-auto p-2 sm:p-4 rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl flex flex-col items-center justify-center min-h-[460px] h-[calc(94vh-175px)] max-h-[calc(94vh-175px)]"
      >
        <div
          style={{
            width: `${1280 * zoomLevel}px`,
            minWidth: `${1280 * zoomLevel}px`,
            height: `${cardHeight * zoomLevel}px`,
            position: 'relative'
          }}
          className="transition-[width,height] duration-150 ease-out flex-shrink-0"
        >
          <div
            ref={cardRef}
            style={{
              width: '1280px',
              minWidth: '1280px',
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundColor: '#ffffff',
              color: '#000000',
              fontFamily: 'Arial, sans-serif',
              border: '6px solid #003366',
              boxSizing: 'border-box'
            }}
            className="shadow-2xl"
          >
            {/* Header */}
          <div
            style={{
              background: '#003366',
              color: '#ffffff',
              padding: '25px 20px',
              textAlign: 'center',
              borderBottom: '6px solid #eca400'
            }}
          >
            <div
              style={{
                margin: 0,
                fontSize: '52px',
                fontWeight: 900,
                letterSpacing: '2px',
                color: '#ffffff'
              }}
            >
              {flightTitle}
            </div>
            <div
              style={{
                margin: '8px 0 0',
                fontSize: '28px',
                fontWeight: 800,
                color: '#eca400',
                textTransform: 'uppercase'
              }}
            >
              RAMP DEPARTURE REPORT
            </div>
          </div>

          {/* General Info */}
          <div
            style={{
              background: '#003366',
              color: '#ffffff',
              padding: '12px 30px',
              borderTop: '3px solid #000000',
              borderBottom: '3px solid #000000',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: '66px',
              boxSizing: 'border-box'
            }}
          >
            <span
              style={{
                fontSize: '28px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                lineHeight: 1.2
              }}
            >
              GENERAL INFORMATION
            </span>
            {cleanPicName && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  border: '2.5px solid #eca400',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.25)',
                  boxSizing: 'border-box',
                  lineHeight: 1.25
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#b45309',
                    letterSpacing: '1px',
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: 1.2
                  }}
                >
                  PIC:
                </span>
                <span
                  style={{
                    fontSize: getPicNameFontSize(cleanPicName),
                    fontWeight: 900,
                    color: '#002244',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontFamily: 'Arial, sans-serif',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cleanPicName}
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              padding: '12px 30px'
            }}
          >
            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                DATE
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.date || report.date || ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                A/C REG
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.ac || ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                {type === 'INTERNATIONAL' ? 'GATE NO' : 'BAY NO'}
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.bay || ''}
              </span>
            </div>

            {type === 'INTERNATIONAL' && (
              <>
                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    DOC IN
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.docin ? `${formData.docin} (LT)` : ''}
                  </span>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    DOC OUT
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.docout ? `${formData.docout} (LT)` : ''}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Arrival Section if ROUND */}
          {mode === 'ROUND' && (
            <>
              <div
                style={{
                  background: '#e0f7fa',
                  color: '#003366',
                  padding: '10px 30px',
                  fontSize: '28px',
                  fontWeight: 900,
                  borderTop: '3px solid #000000',
                  borderBottom: '3px solid #000000',
                  textTransform: 'uppercase'
                }}
              >
                ARRIVAL INFORMATION
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '20px',
                  padding: '12px 30px'
                }}
              >
                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    FLIGHT
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.arvFlt ? `BS-${formData.arvFlt}` : ''}
                  </span>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    ROUTE
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.arvRoute || ''}
                  </span>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    C/ON
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.con ? `${formData.con} (LT)` : ''}
                  </span>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    DOOR OPEN
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.do ? `${formData.do} (LT)` : ''}
                  </span>
                </div>

                <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
                  <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                    ALL DISEM
                  </span>
                  <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                    {formData.disem ? `${formData.disem} (LT)` : ''}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Departure Info */}
          <div
            style={{
              background: '#003366',
              color: '#ffffff',
              padding: '10px 30px',
              fontSize: '28px',
              fontWeight: 900,
              borderTop: '3px solid #000000',
              borderBottom: '3px solid #000000',
              textTransform: 'uppercase'
            }}
          >
            DEPARTURE INFORMATION
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              padding: '12px 30px'
            }}
          >
            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                FLIGHT
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.deptFlt ? `BS-${formData.deptFlt}` : ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                ROUTE
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.deptRoute || ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                STD
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.std ? `${formData.std} (LT)` : ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                DOOR CLOSE
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.dc ? `${formData.dc} (LT)` : ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                C/OFF
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.co ? `${formData.co} (LT)` : ''}
              </span>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '2px solid #ccc' }}>
              <span style={{ display: 'block', fontSize: '20px', color: '#003366', fontWeight: 900, marginBottom: '4px' }}>
                A/B
              </span>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#000000' }}>
                {formData.ab ? `${formData.ab} (LT)` : ''}
              </span>
            </div>
          </div>

          {/* Status Bar */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '32px',
              fontWeight: 900,
              padding: '12px',
              color: '#000000',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              backgroundColor: isDelay ? '#ffcccc' : isEarly ? '#d4edda' : '#ffff00',
              borderTop: '3px solid #000000',
              borderBottom: '3px solid #000000'
            }}
          >
            {formData.status || 'FLIGHT IS ONTIME'}
          </div>

          {/* Timings Table - 2 Columns Side-By-Side Grid */}
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '3px solid #000000' }}>
            <tbody>
              <style>{`
                .viewer-rpt-cell-lbl { padding: 12px 16px; font-size: 22px; font-weight: 800; color: #000000; border-bottom: 2px solid #ddd; text-transform: uppercase; }
                .viewer-rpt-cell-val { padding: 12px 16px; font-size: 28px; font-weight: 900; color: #000000; border-bottom: 2px solid #ddd; text-align: center; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px; }
              `}</style>
              
              {(formData.station || '').toUpperCase() !== 'DAC' ? (
                /* OUT STATION MILESTONES */
                <>
                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>1. SECURITY CHECK ST</td>
                    <td className="viewer-rpt-cell-val" style={{ width: '18%', borderRight: '3px solid #000' }}>{formatTimeLT(formData.securitySt)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>2. SECURITY CHECK END</td>
                    <td className="viewer-rpt-cell-val" style={{ width: '18%' }}>{formatTimeLT(formData.securityEnd)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>3. CLEANING START</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.cleaningSt)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>4. CLEANING END</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.cleaningEnd)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>5. REFUELING DONE</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.refuel)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>6. LAST BAGGAGE REPORT</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.lbag)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>7. BOARDING PERMITTED</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.permit)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>8. FIRST BUS/PAX REPORT</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.firstBusPax)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>9. LAST PAX ONBOARD</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.pax)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>10. TRIM SUBMITTED</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.trimSubmitted)}</td>
                  </tr>

                  {(() => {
                    const extraOutstationBoxes = [
                      { label: '12. VIP PAX', val: formData.vipPax },
                      { label: '13. VIP BAG', val: formData.vipBag },
                      { label: '14. MAAS/PRIORITY PAX', val: formData.maasPax },
                      { label: '15. PRIORITY BAG', val: formData.priorityBag },
                      { label: '16. FIRE ARMS', val: formData.fireArms },
                      { label: '17. RUSH BAG', val: formData.rushBag },
                      { label: '18. OFFLOAD BAG', val: formData.offloadBag },
                    ];

                    const activeBoxes = extraOutstationBoxes
                      .filter((item) => !isFieldEmptyOrNil(item.val))
                      .map((item) => ({ label: item.label, val: item.val!.trim() }));

                    const firstActive = activeBoxes[0];
                    const remainingActive = activeBoxes.slice(1);

                    const extraRows = [];
                    for (let i = 0; i < remainingActive.length; i += 2) {
                      const item1 = remainingActive[i];
                      const item2 = remainingActive[i + 1];
                      extraRows.push(
                        <tr key={`outstation-extra-row-${i}`}>
                          <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item1.label}</td>
                          <td className="viewer-rpt-cell-val" style={{ width: '18%', borderRight: item2 ? '3px solid #000' : 'none' }}>{item1.val}</td>
                          {item2 ? (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item2.label}</td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}>{item2.val}</td>
                            </>
                          ) : (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}></td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}></td>
                            </>
                          )}
                        </tr>
                      );
                    }

                    return (
                      <>
                        <tr>
                          <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>11. TRIM SIGNED</td>
                          <td className="viewer-rpt-cell-val" style={{ width: '18%', borderRight: firstActive ? '3px solid #000' : 'none' }}>
                            {formatTimeLT(formData.trimSigned)}
                          </td>
                          {firstActive ? (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{firstActive.label}</td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}>{firstActive.val}</td>
                            </>
                          ) : (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}></td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}></td>
                            </>
                          )}
                        </tr>
                        {extraRows}
                      </>
                    );
                  })()}
                </>
              ) : (
                /* HUB DAC MILESTONES (WITH CATERING) */
                <>
                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>1. SECURITY CHECK ST</td>
                    <td className="viewer-rpt-cell-val" style={{ width: '18%', borderRight: '3px solid #000' }}>{formatTimeLT(formData.securitySt)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>2. SECURITY CHECK END</td>
                    <td className="viewer-rpt-cell-val" style={{ width: '18%' }}>{formatTimeLT(formData.securityEnd)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>3. CLEANING START</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.cleaningSt)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>4. CLEANING END</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.cleaningEnd)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>5. CATERING START</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.cateringSt)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>6. CATERING END</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.cateringEnd)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>7. CREW REPORT</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.crew)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>8. REFUELING DONE</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.refuel)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>9. LAST BAGGAGE REPORT</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.lbag)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>10. BOARDING PERMITTED</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.permit)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>11. FIRST BUS/PAX REPORT</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.firstBusPax)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>12. LAST PAX ONBOARD</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.pax)}</td>
                  </tr>

                  <tr>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>13. TRIM SUBMITTED</td>
                    <td className="viewer-rpt-cell-val" style={{ borderRight: '3px solid #000' }}>{formatTimeLT(formData.trimSubmitted)}</td>
                    <td className="viewer-rpt-cell-lbl" style={{ borderRight: '1px solid #ccc' }}>14. TRIM SIGNED</td>
                    <td className="viewer-rpt-cell-val">{formatTimeLT(formData.trimSigned)}</td>
                  </tr>

                  {/* Optional Baggage Fields */}
                  {(() => {
                    const pBag = formatBagCount(formData.priorityBag);
                    const vBag = formatBagCount(formData.vipBag);
                    const oBag = formatBagCount(formData.offloadBag);

                    const items: { label: string; val: string }[] = [];
                    if (pBag) items.push({ label: '15. PRIORITY BAG', val: pBag });
                    if (vBag) items.push({ label: '16. VIP BAG', val: vBag });
                    if (oBag) items.push({ label: '17. OFFLOAD BAG', val: oBag });

                    const rows = [];
                    for (let i = 0; i < items.length; i += 2) {
                      const item1 = items[i];
                      const item2 = items[i + 1];
                      rows.push(
                        <tr key={`milestone-row-${i}`}>
                          <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item1.label}</td>
                          <td className="viewer-rpt-cell-val" style={{ width: '18%', borderRight: item2 ? '3px solid #000' : 'none' }}>{item1.val}</td>
                          {item2 ? (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}>{item2.label}</td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}>{item2.val}</td>
                            </>
                          ) : (
                            <>
                              <td className="viewer-rpt-cell-lbl" style={{ width: '32%', borderRight: '1px solid #ccc' }}></td>
                              <td className="viewer-rpt-cell-val" style={{ width: '18%' }}></td>
                            </>
                          )}
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                </>
              )}
            </tbody>
          </table>

          {/* Bottom Ground Time Bar */}
          <div
            style={{
              textAlign: 'center',
              fontSize: '32px',
              fontWeight: 900,
              padding: '12px',
              color: '#000000',
              backgroundColor: '#ffff00',
              borderTop: '3px solid #000000',
              borderBottom: '3px solid #000000',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            {mode === 'DIRECT' || (formData.ground || '').toUpperCase().includes('GROUND')
              ? 'AIRCRAFT WAS ON GROUND'
              : `GROUND TIME ${formData.ground ? (formData.ground.toUpperCase().includes('MIN') ? formData.ground : `${formData.ground} MINS`) : '0 MINS'}`}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '4px solid #003366',
              padding: '25px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#ffffff'
            }}
          >
            {/* Delay Reason Box */}
            <div style={{ flex: '1', paddingRight: '25px' }}>
              {isDelay && (
                <div
                  style={{
                    background: '#fff3cd',
                    border: '4px solid #dc3545',
                    borderRadius: '12px',
                    padding: '16px 20px'
                  }}
                >
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 900,
                      color: '#721c24',
                      textTransform: 'uppercase',
                      marginBottom: '6px'
                    }}
                  >
                    ⚠️ DELAY REMARKS:
                  </div>
                  <div
                    style={{
                      fontSize: '26px',
                      fontWeight: 900,
                      color: '#000000',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {(() => {
                      if (formData.delayRemarks && formData.delayRemarks.trim()) {
                        return formData.delayRemarks.trim();
                      }
                      if (formData.delayReason && formData.delayReason.trim()) {
                        const cleaned = formData.delayReason.trim().replace(/^(?:code\s*)?\d{1,3}\s*[:\-]\s*/i, '');
                        return cleaned || 'DELAY DUE TO OPERATIONAL REASONS';
                      }
                      return 'DELAY DUE TO OPERATIONAL REASONS';
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Officer Signature Badge */}
            <div style={{ textAlign: 'center', minWidth: '380px' }}>
              <div
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  padding: '15px',
                  borderTop: '6px solid #003366'
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: '36px',
                    textTransform: 'uppercase'
                  }}
                >
                  {officerUser.name}
                </div>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    margin: '5px 0'
                  }}
                >
                  USBA ID- {officerUser.id}
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '2px solid #ccc'
                  }}
                >
                  RAMP OFFICER / <span>{officerUser.station}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Watermark Bar */}
          <div
            style={{
              borderTop: '3px solid #003366',
              backgroundColor: '#f8fafc',
              padding: '10px 30px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '18px',
              color: '#475569',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>US-BANGLA AIRLINES &bull; RAMP OPERATIONS</span>
            <span style={{ fontWeight: 900, color: '#003366', letterSpacing: '0.5px' }}>
              Application build by USBA-20088
            </span>
            <span style={{ fontWeight: 'bold' }}>OFFICIAL SYSTEM REPORT</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
