import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import {
  X,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  FileText,
  AlertTriangle,
  Sparkles,
  Plane,
  Save,
  Clock,
  User,
  Shield,
  RefreshCw,
  Trash2,
  RotateCcw,
  Eye,
  Check
} from 'lucide-react';
import { RampReportFormData, ReportType, FlightMode, SavedReport } from '../types';
import { parseDateToIso } from '../utils/analyticalSnapshotBuilder';

interface AdminReportUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReport: (
    data: RampReportFormData,
    type: ReportType,
    mode: FlightMode,
    existingId?: string,
    officerOverride?: { name: string; id: string }
  ) => void;
  isDarkMode?: boolean;
}

const getTodayDateFormatted = () => {
  const d = new Date();
  const day = d.getDate();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  return `${day} ${mon} ${yr}`;
};

const getEmptyFormData = (): RampReportFormData => ({
  date: getTodayDateFormatted(),
  ac: '',
  bay: '',
  docin: '00',
  docout: '00',
  arvFlt: '',
  arvRoute: '',
  con: '',
  do: '',
  disem: '',
  deptFlt: '',
  deptRoute: '',
  std: '',
  dc: '',
  co: '',
  ab: '',
  status: '',
  securitySt: 'OK',
  securityEnd: 'OK',
  cleaningSt: 'OK',
  cleaningEnd: 'OK',
  cateringSt: 'OK',
  cateringEnd: 'OK',
  crew: '',
  refuel: '',
  lbag: '',
  permit: '',
  pax: '',
  trimSubmitted: '',
  trimSigned: '',
  priorityBag: '00',
  vipBag: '00',
  offloadBag: '00',
  ground: 'ON GROUND',
  station: 'DAC',
  delayRemarks: '',
  delayReason: ''
});

export const AdminReportUploadModal: React.FC<AdminReportUploadModalProps> = ({
  isOpen,
  onClose,
  onSaveReport,
  isDarkMode = true
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ocrProgressText, setOcrProgressText] = useState<string>('');
  const [ocrSuccess, setOcrSuccess] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'IMAGE' | 'TEXT_PASTE'>('IMAGE');
  const [pastedText, setPastedText] = useState<string>('');

  // Officer override details
  const [officerName, setOfficerName] = useState<string>('');
  const [officerId, setOfficerId] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('DOMESTIC');
  const [flightMode, setFlightMode] = useState<FlightMode>('DIRECT');

  // Form Data state
  const [formData, setFormData] = useState<RampReportFormData>(getEmptyFormData);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear all data function
  const handleClearAll = () => {
    setImagePreview(null);
    setPastedText('');
    setOcrSuccess(false);
    setOcrProgressText('');
    setIsProcessing(false);
    setFormData(getEmptyFormData());
    setOfficerName('');
    setOfficerId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset when modal is reopened if required
  useEffect(() => {
    if (isOpen && !imagePreview && !formData.deptFlt) {
      handleClearAll();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof RampReportFormData, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-detect flight type
      if (field === 'deptFlt' || field === 'arvFlt') {
        const clean = value.replace(/^BS-?/i, '').trim();
        const num = parseInt(clean, 10);
        if (num && !isNaN(num)) {
          if ((num >= 100 && num <= 199) || (num >= 500 && num <= 599)) {
            setReportType('DOMESTIC');
          } else if (num >= 200 && num <= 499) {
            setReportType('INTERNATIONAL');
          }
        }
      }
      return next;
    });
  };

  // Helper to extract clean 4-digit HHMM or special words
  const cleanTimeVal = (val: string): string => {
    if (!val) return '';
    const upper = val.toUpperCase().trim();
    if (upper.includes('EARLIER')) return 'EARLIER';
    if (upper.includes('OK')) return 'OK';
    if (upper.includes('OB')) return 'OB';
    if (upper.includes('N/Y') || upper === 'NY') return 'N/Y';
    const m = upper.match(/([012]\d[0-5]\d)/);
    if (m) return m[1];
    const colonMatch = upper.match(/([012]?\d):([0-5]\d)/);
    if (colonMatch) {
      return `${colonMatch[1].padStart(2, '0')}${colonMatch[2]}`;
    }
    return upper.replace(/[^A-Z0-9\/-]/g, '');
  };

  // Universal text & OCR parser for USBA Ramp Departure Report cards
  const parseReportCardText = (rawText: string, fileName?: string) => {
    if (!rawText && !fileName) return;

    const newForm = getEmptyFormData();
    let newOfficerName = '';
    let newOfficerId = '';
    let detectedType: ReportType = 'DOMESTIC';

    const fullText = (rawText || '').replace(/\r/g, '\n');
    const upperFull = fullText.toUpperCase();

    // 1. Check filename first for baseline info
    if (fileName) {
      const fnUpper = fileName.toUpperCase();
      const fnFlt = fnUpper.match(/BS-?\s*(\d{3,4})/i);
      if (fnFlt) {
        newForm.deptFlt = fnFlt[1];
        const num = parseInt(fnFlt[1], 10);
        if (num >= 200 && num <= 499) detectedType = 'INTERNATIONAL';
      }
      const fnRoute = fnUpper.match(/([A-Z]{3}\s*[-–]\s*[A-Z]{3})/i);
      if (fnRoute) {
        newForm.deptRoute = fnRoute[1].replace(/\s+/g, '').replace('–', '-');
      }
      const fnDate = fnUpper.match(/(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{2,4})/i);
      if (fnDate) newForm.date = fnDate[1];
      const fnAc = fnUpper.match(/(S2-[A-Z0-9]{3}|HS-[A-Z0-9]{3})/i);
      if (fnAc) newForm.ac = fnAc[1];
    }

    // 2. PRIMARY: Header Title Flight & Route (e.g., "BS-173 (DAC-CXB)")
    // This is the DEPARTURE flight at the top of the card
    const headerFltMatch = upperFull.match(/BS-?\s*(\d{3,4})\s*\(\s*([A-Z]{3}\s*[-–]\s*[A-Z]{3})\s*\)/i);
    if (headerFltMatch) {
      newForm.deptFlt = headerFltMatch[1];
      newForm.deptRoute = headerFltMatch[2].replace(/\s+/g, '').replace('–', '-');
    }

    // 3. GENERAL INFORMATION (Date, A/C Reg, Bay No)
    // Date: e.g. 27 AUG 26
    const dateMatch = upperFull.match(/(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{2,4})/i);
    if (dateMatch) {
      newForm.date = dateMatch[1].toUpperCase();
    }

    // A/C Registration: e.g. S2-AKP, S2-AFP, S2-AJH
    const acMatch = upperFull.match(/(S2-[A-Z0-9]{3}|HS-[A-Z0-9]{3}|PK-[A-Z0-9]{3})/i);
    if (acMatch) {
      newForm.ac = acMatch[1].toUpperCase();
    }

    // Bay No: e.g. "BAY NO: C-27" or "BAY: C-27" or "BAY NO C-27" (prevent capturing 'NO')
    const bayMatch =
      upperFull.match(/BAY\s*(?:NO\.?|NUMBER)?[:\s-]*([A-Z0-9-]+)/i) ||
      upperFull.match(/GATE\s*(?:NO\.?|NUMBER)?[:\s-]*([A-Z0-9-]+)/i) ||
      upperFull.match(/STAND\s*(?:NO\.?|NUMBER)?[:\s-]*([A-Z0-9-]+)/i);
    if (bayMatch) {
      let rawBay = bayMatch[1].trim().replace(/^NO\.?\s*/i, '').replace('–', '-');
      if (rawBay && rawBay !== 'NO' && rawBay !== 'NUMBER') {
        newForm.bay = rawBay;
      }
    }
    // Fallback for Bay pattern like "C-27" or "D-16" or "BAY-C-21"
    if (!newForm.bay) {
      const explicitBay = upperFull.match(/\b([A-Z]-\d{1,2})\b/);
      if (explicitBay) newForm.bay = explicitBay[1];
    }

    // 4. SECTION SPLIT: Separate ARRIVAL and DEPARTURE sections
    const arrivalIdx = upperFull.indexOf('ARRIVAL INFORMATION');
    const departureIdx = upperFull.indexOf('DEPARTURE INFORMATION');

    // Parse ARRIVAL INFORMATION section
    if (arrivalIdx !== -1) {
      const arrivalText = departureIdx !== -1
        ? upperFull.substring(arrivalIdx, departureIdx)
        : upperFull.substring(arrivalIdx, arrivalIdx + 500);

      // Inbound flight: e.g. BS-142
      const arvFltM = arrivalText.match(/BS-?\s*(\d{3,4})/i);
      if (arvFltM) {
        newForm.arvFlt = arvFltM[1];
      }

      // Inbound route: e.g. CXB-DAC
      const arvRouteM = arrivalText.match(/([A-Z]{3}\s*[-–]\s*[A-Z]{3})/i);
      if (arvRouteM) {
        newForm.arvRoute = arvRouteM[1].replace(/\s+/g, '').replace('–', '-');
      }

      // Inbound C/ON (Chocks on): e.g. 1005 (LT)
      const conM = arrivalText.match(/(?:C\/ON|C\/O|ON\s*BLOCK|CON)[-:\s]*([012]\d[0-5]\d)/i) ||
                   arrivalText.match(/([012]\d[0-5]\d)(?:\s*\(?LT\)?)?/);
      if (conM) {
        newForm.con = conM[1];
      }

      // Inbound Door Open: e.g. 1006 (LT)
      const doM = arrivalText.match(/(?:DOOR\s*OPEN|DO)[-:\s]*([012]\d[0-5]\d)/i);
      if (doM) {
        newForm.do = doM[1];
      }

      // Inbound All Disembark: e.g. 1016 (LT)
      const disemM = arrivalText.match(/(?:ALL\s*DISEM|DISEM|DISEMBARK)[-:\s]*([012]\d[0-5]\d)/i);
      if (disemM) {
        newForm.disem = disemM[1];
      }
    }

    // Parse DEPARTURE INFORMATION section (THIS IS THE MAIN REPORT DATA!)
    if (departureIdx !== -1) {
      const departureText = upperFull.substring(departureIdx, departureIdx + 600);

      // Departure flight: e.g. BS-173
      const deptFltM = departureText.match(/BS-?\s*(\d{3,4})/i);
      if (deptFltM) {
        newForm.deptFlt = deptFltM[1];
      }

      // Departure route: e.g. DAC-CXB
      const deptRouteM = departureText.match(/([A-Z]{3}\s*[-–]\s*[A-Z]{3})/i);
      if (deptRouteM) {
        newForm.deptRoute = deptRouteM[1].replace(/\s+/g, '').replace('–', '-');
      }

      // Departure STD: e.g. 1100 (LT)
      const stdM = departureText.match(/STD[-:\s]*([012]\d[0-5]\d)/i) ||
                   departureText.match(/([012]\d[0-5]\d)(?:\s*\(?LT\)?)?/);
      if (stdM) {
        newForm.std = stdM[1];
      }

      // Door Close (DC): e.g. 1053 (LT)
      const dcM = departureText.match(/(?:DOOR\s*CLOSE|DC)[-:\s]*([012]\d[0-5]\d)/i);
      if (dcM) {
        newForm.dc = dcM[1];
      }

      // Chocks Off (C/OFF / CO): e.g. 1054 (LT)
      const coM = departureText.match(/(?:C\/OFF|CO|CHOX|CHOCKS?\s*OFF)[-:\s]*([012]\d[0-5]\d)/i);
      if (coM) {
        newForm.co = coM[1];
      }

      // Airborne (A/B): e.g. N/Y (LT) or 1109 (LT)
      const abM = departureText.match(/(?:A\/B|AIRBORNE)[-:\s]*([012]\d[0-5]\d|N\/Y|NY)/i);
      if (abM) {
        newForm.ab = cleanTimeVal(abM[1]);
      }
    }

    // 5. Global Fallbacks for Departure Times if not caught by section index
    if (!newForm.std) {
      const stdM = upperFull.match(/STD[-:\s]*([012]\d[0-5]\d)/i);
      if (stdM) newForm.std = stdM[1];
    }
    if (!newForm.dc) {
      const dcM = upperFull.match(/(?:DOOR\s*CLOSE|DC)[-:\s]*([012]\d[0-5]\d)/i);
      if (dcM) newForm.dc = dcM[1];
    }
    if (!newForm.co) {
      const coM = upperFull.match(/(?:C\/OFF|CO|CHOX)[-:\s]*([012]\d[0-5]\d)/i);
      if (coM) newForm.co = coM[1];
    }
    if (!newForm.ab) {
      const abM = upperFull.match(/(?:A\/B|AIRBORNE)[-:\s]*([012]\d[0-5]\d|N\/Y|NY)/i);
      if (abM) newForm.ab = cleanTimeVal(abM[1]);
    }

    // 6. STATUS BANNER (e.g., "FLIGHT 06 MINS EARLY" or "FLIGHT ON TIME")
    const statusMatch = upperFull.match(/FLIGHT\s+.*?(?:EARLY|DELAY|ON\s*TIME).*/i);
    if (statusMatch) {
      newForm.status = statusMatch[0].trim().toUpperCase();
    }

    // 7. GROUND TIME (e.g., "GROUND TIME 48 MINS")
    const groundMatch = upperFull.match(/GROUND\s*TIME[:\s]*(\d{1,3}\s*MINS?)/i);
    if (groundMatch) {
      newForm.ground = groundMatch[1].toUpperCase();
    }

    // 8. 13-POINT TURNAROUND CHECKLIST
    // 1. Security Check ST
    const secStM = upperFull.match(/(?:1\.?\s*SECURITY.*?ST(?:ART)?|SECURITY.*?ST)[-:\s]*([A-Z0-9]+)/i);
    if (secStM) newForm.securitySt = cleanTimeVal(secStM[1]);

    // 2. Security Check END
    const secEndM = upperFull.match(/(?:2\.?\s*SECURITY.*?END|SECURITY.*?END)[-:\s]*([A-Z0-9]+)/i);
    if (secEndM) newForm.securityEnd = cleanTimeVal(secEndM[1]);

    // 3. Cleaning START
    const clnStM = upperFull.match(/(?:3\.?\s*CLEANING.*?ST(?:ART)?|CLEANING.*?START)[-:\s]*([A-Z0-9]+)/i);
    if (clnStM) newForm.cleaningSt = cleanTimeVal(clnStM[1]);

    // 4. Cleaning END
    const clnEndM = upperFull.match(/(?:4\.?\s*CLEANING.*?END|CLEANING.*?END)[-:\s]*([A-Z0-9]+)/i);
    if (clnEndM) newForm.cleaningEnd = cleanTimeVal(clnEndM[1]);

    // 5. Catering START
    const catStM = upperFull.match(/(?:5\.?\s*CATERING.*?ST(?:ART)?|CATERING.*?START)[-:\s]*([A-Z0-9]+)/i);
    if (catStM) newForm.cateringSt = cleanTimeVal(catStM[1]);

    // 6. Catering END
    const catEndM = upperFull.match(/(?:6\.?\s*CATERING.*?END|CATERING.*?END)[-:\s]*([A-Z0-9]+)/i);
    if (catEndM) newForm.cateringEnd = cleanTimeVal(catEndM[1]);

    // 7. Crew Report
    const crewM = upperFull.match(/(?:7\.?\s*CREW.*?REPORT|CREW.*?REPORT)[-:\s]*([A-Z0-9]+)/i);
    if (crewM) newForm.crew = cleanTimeVal(crewM[1]);

    // 8. Refueling Done
    const refuelM = upperFull.match(/(?:8\.?\s*REFUEL(?:ING)?.*?DONE|REFUEL(?:ING)?.*?DONE)[-:\s]*([A-Z0-9]+)/i) ||
                    upperFull.match(/(?:REFUEL(?:ING)?.*?ST(?:ART)?)[-:\s]*([A-Z0-9]+)/i);
    if (refuelM) newForm.refuel = cleanTimeVal(refuelM[1]);

    // 9. Last Baggage Report
    const lbagM = upperFull.match(/(?:9\.?\s*LAST\s*BAGGAGE.*?|LAST\s*BAGGAGE.*?)[-:\s]*([A-Z0-9]+)/i);
    if (lbagM) newForm.lbag = cleanTimeVal(lbagM[1]);

    // 10. Boarding Permitted
    const permitM = upperFull.match(/(?:10\.?\s*BOARDING.*?PERMIT(?:TED)?|BOARDING.*?PERMIT(?:TED)?)[-:\s]*([A-Z0-9]+)/i);
    if (permitM) newForm.permit = cleanTimeVal(permitM[1]);

    // 11. Last Pax Onboard
    const paxM = upperFull.match(/(?:11\.?\s*LAST\s*PAX.*?|LAST\s*PAX.*?)[-:\s]*([012]\d[0-5]\d)/i);
    if (paxM) newForm.pax = cleanTimeVal(paxM[1]);

    // 12. Trim Submitted
    const trimSubM = upperFull.match(/(?:12\.?\s*TRIM.*?SUBMITTED|TRIM.*?SUBMITTED)[-:\s]*([A-Z0-9]+)/i);
    if (trimSubM) newForm.trimSubmitted = cleanTimeVal(trimSubM[1]);

    // 13. Trim Signed
    const trimSignM = upperFull.match(/(?:13\.?\s*TRIM.*?SIGNED|TRIM.*?SIGNED)[-:\s]*([A-Z0-9]+)/i);
    if (trimSignM) newForm.trimSigned = cleanTimeVal(trimSignM[1]);

    // 9. OFFICER NAME & USBA ID
    // USBA ID: e.g. "USBA ID- USBA-27948" or "USBA ID 27948" or "ID: 4365"
    const idMatch = upperFull.match(/USBA\s*ID[-:\s]*([A-Z0-9-]+)/i) ||
                    upperFull.match(/\bID[-:\s]*([0-9]{4,6})\b/i);
    if (idMatch) {
      newOfficerId = idMatch[1].trim();
    }

    // Officer Name: e.g. "KAZI AQIB AL MANSOOR", "MD.AKIFE ISLAM", "RASEL HOSSAIN"
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const uLine = line.toUpperCase();
      if (
        (uLine.includes('KAZI') ||
         uLine.includes('AQIB') ||
         uLine.includes('MANSOOR') ||
         uLine.includes('AKIFE') ||
         uLine.includes('ISLAM') ||
         uLine.includes('RASEL') ||
         uLine.includes('HOSSAIN') ||
         uLine.includes('AL-AMIN') ||
         uLine.includes('TAHMID') ||
         uLine.includes('SAKIB')) &&
        !uLine.includes('RAMP OFFICER') &&
        !uLine.includes('SECURITY')
      ) {
        const cleaned = line.replace(/RAMP|OFFICER|USBA|ID|\d|[-:\/]/gi, '').trim();
        if (cleaned.length > 3 && !cleaned.includes('FLIGHT') && !cleaned.includes('REPORT')) {
          newOfficerName = cleaned;
          break;
        }
      }
    }

    // Determine flight category (Domestic vs International)
    if (newForm.deptFlt) {
      const fltNum = parseInt(newForm.deptFlt, 10);
      if (fltNum >= 200 && fltNum <= 499) {
        detectedType = 'INTERNATIONAL';
      } else {
        detectedType = 'DOMESTIC';
      }
    }

    setFormData(newForm);
    if (newOfficerName) setOfficerName(newOfficerName);
    if (newOfficerId) setOfficerId(newOfficerId);
    setReportType(detectedType);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fast baseline heuristic from filename
    parseReportCardText('', file.name);

    setIsProcessing(true);
    setOcrSuccess(false);
    setOcrProgressText('Loading card image...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);

      try {
        setOcrProgressText('AI OCR reading departure card text...');
        const result = await Tesseract.recognize(dataUrl, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round((m.progress || 0) * 100);
              setOcrProgressText(`Scanning image & extracting data... ${pct}%`);
            }
          }
        });

        const extractedText = result?.data?.text || '';
        if (extractedText.trim()) {
          parseReportCardText(extractedText, file.name);
          setOcrSuccess(true);
          setOcrProgressText('✓ All fields extracted automatically!');
        } else {
          setOcrProgressText('Image loaded. You can verify and edit fields below.');
        }
      } catch (ocrErr) {
        console.error('OCR Extraction error:', ocrErr);
        // Fallback gracefully to filename heuristics
        parseReportCardText('', file.name);
        setOcrProgressText('Image loaded. Please verify details in the form.');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Text parser for copied WhatsApp ramp report message
  const parsePastedReportText = (text: string) => {
    if (!text) return;
    parseReportCardText(text);
  };

  const handleSave = () => {
    const flightNumClean = (formData.deptFlt || formData.arvFlt || '').replace(/^BS-?/i, '').trim();
    if (!flightNumClean) {
      alert('Please enter a valid flight number (e.g., 173, 541, 333)');
      return;
    }

    const num = parseInt(flightNumClean, 10);
    const resolvedType =
      num >= 200 && num <= 499
        ? 'INTERNATIONAL'
        : num >= 100 && num <= 199 || (num >= 500 && num <= 599)
        ? 'DOMESTIC'
        : reportType;

    const dateIso = parseDateToIso(formData.date || 'TODAY');
    const customId = `report-bs${flightNumClean.toLowerCase()}-${dateIso.replace(/-/g, '')}`;

    onSaveReport(
      {
        ...formData,
        deptFlt: flightNumClean,
        deptRoute: formData.deptRoute || 'DAC-CXB'
      },
      resolvedType,
      flightMode,
      customId,
      {
        name: officerName || 'RAMP OFFICER',
        id: officerId || '0000'
      }
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDarkMode ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide">ADMIN REPORT UPLOAD & RECOVERY</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  AUTO-SYNC TO FIRESTORE
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Upload officer JPG report card to auto-create and save report directly to Firestore & Saved List.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear all fields and start fresh"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>CLEAR ALL</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TOP TABS: IMAGE UPLOAD / TEXT PASTE */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMode('IMAGE')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
                activeMode === 'IMAGE'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>UPLOAD REPORT CARD (JPG / PNG)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('TEXT_PASTE')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
                activeMode === 'TEXT_PASTE'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>PASTE REPORT TEXT / WHATSAPP</span>
            </button>
          </div>

          {/* MODE 1: IMAGE DROP / UPLOAD */}
          {activeMode === 'IMAGE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* Left Column: Image Upload Area */}
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[220px] ${
                    imagePreview
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : isDarkMode
                      ? 'border-slate-700 hover:border-amber-500 bg-slate-950/60 hover:bg-slate-950'
                      : 'border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {imagePreview ? (
                    <div className="space-y-2 w-full">
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Uploaded Card"
                          className="max-h-56 mx-auto rounded-xl object-contain shadow-md border border-slate-700/50"
                        />
                        {isProcessing && (
                          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-3 text-center animate-in fade-in">
                            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                            <p className="text-xs font-black text-amber-300 font-mono">
                              {ocrProgressText || 'Scanning Card Data with AI OCR...'}
                            </p>
                            <p className="text-[10px] text-slate-300 mt-1">Reading flights, timings, officer details...</p>
                          </div>
                        )}
                      </div>
                      {ocrSuccess && !isProcessing && (
                        <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 font-mono">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>ALL FIELDS AUTO-POPULATED FROM IMAGE</span>
                        </div>
                      )}
                      <p className="text-[11px] text-amber-400 font-bold flex items-center justify-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Click to change / re-upload image
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold">CLICK OR DRAG REPORT CARD IMAGE HERE</h4>
                      <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Auto-extracts Flight, Times (STD/DC/AB), Turnaround & Officer Info with AI OCR
                      </p>
                    </div>
                  )}
                </div>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearAll();
                    }}
                    className="w-full py-1.5 px-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Image & Clear Form
                  </button>
                )}
              </div>

              {/* Right Column: Pre-filled Verification Info */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-2 border-slate-700/50">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    EXTRACTED & VERIFIED DETAILS
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                      formData.deptFlt
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}
                  >
                    {formData.deptFlt ? 'READY TO SYNC' : 'AWAITING DETAILS'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/40">
                    <span className="text-[10px] font-bold text-amber-400 block tracking-wide">DEPARTURE FLIGHT:</span>
                    <span className="font-black text-amber-300 text-sm">
                      {formData.deptFlt ? `BS-${formData.deptFlt} (${formData.deptRoute || 'ROUTE'})` : 'NOT SPECIFIED'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wide">A/C & BAY:</span>
                    <span className="font-black text-white text-sm">
                      {formData.ac || 'REG'} | {formData.bay || 'BAY'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wide">TIMINGS (STD / DC / CO / AB):</span>
                    <span className="font-bold text-sky-300 text-xs">
                      {formData.std || '--'} / {formData.dc || '--'} / {formData.co || '--'} / {formData.ab || '--'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wide">FLIGHT STATUS:</span>
                    <span className="font-black text-emerald-400 text-xs">
                      {formData.status || 'READY'}
                    </span>
                  </div>
                </div>

                {/* Inbound Flight summary if available */}
                {formData.arvFlt && (
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[11px] font-mono flex items-center justify-between text-sky-300">
                    <span className="font-bold">INBOUND FLIGHT: BS-{formData.arvFlt} ({formData.arvRoute || 'ROUTE'})</span>
                    <span className="text-slate-300">C/ON: <b className="text-white">{formData.con || '--'}</b> | DO: <b className="text-white">{formData.do || '--'}</b></span>
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Officer:</span>
                    <span className="font-bold text-white">
                      {officerName || 'RAMP OFFICER'} {officerId ? `(ID: ${officerId})` : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Turnaround Durations:</span>
                    <span className="text-amber-300 font-mono text-[10px]">
                      Sec: {formData.securitySt || 'OK'} | Cln: {formData.cleaningSt || 'OK'} | Cat: {formData.cateringSt || 'OK'} | Gnd: {formData.ground || '--'}
                    </span>
                  </div>
                </div>

                {/* Quick Paste helper under image mode for rapid sync */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    ⚡ QUICK PASTE (PASTE WHATSAPP TEXT TO INSTANTLY FILL ALL FIELDS):
                  </label>
                  <input
                    type="text"
                    placeholder="Paste full WhatsApp report text here to auto-fill..."
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted) {
                        parsePastedReportText(pasted);
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.value) {
                        parsePastedReportText(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-200 placeholder-slate-500 font-mono outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: TEXT PASTE */}
          {activeMode === 'TEXT_PASTE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  PASTE WHATSAPP RAMP REPORT TEXT:
                </label>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => {
                      setPastedText('');
                      setFormData(getEmptyFormData());
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold"
                  >
                    Clear Text
                  </button>
                )}
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  parsePastedReportText(e.target.value);
                }}
                rows={5}
                placeholder="Paste WhatsApp report message here... (e.g. BS-173 DAC-CXB 27 AUG 26, S2-AFP, BAY C-27, STD 1050 DC 1053 AB 1109...)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3 text-xs text-amber-200 font-mono outline-none placeholder-slate-600"
              />
            </div>
          )}

          {/* EDITABLE FORM FIELDS (FULL CONTROLS) */}
          <div
            className={`p-4 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Plane className="w-4 h-4 text-amber-400" />
                FLIGHT & TURNAROUND METRICS (EDITABLE)
              </h4>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset Fields
              </button>
            </div>

            {/* Row 1: Flight, Route, Date, Reg, Bay */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">FLIGHT NUMBER *</label>
                <input
                  type="text"
                  value={formData.deptFlt || ''}
                  onChange={(e) => handleFieldChange('deptFlt', e.target.value)}
                  placeholder="e.g. 173"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">ROUTE *</label>
                <input
                  type="text"
                  value={formData.deptRoute || ''}
                  onChange={(e) => handleFieldChange('deptRoute', e.target.value)}
                  placeholder="DAC-CXB"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 block">DATE *</label>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('date', getTodayDateFormatted())}
                    className="text-[8px] font-black text-amber-400 hover:text-amber-300 px-1 rounded bg-amber-500/10 border border-amber-500/30"
                    title="Reset to today's date"
                  >
                    TODAY
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.date || getTodayDateFormatted()}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  placeholder={getTodayDateFormatted()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">A/C REG *</label>
                <input
                  type="text"
                  value={formData.ac || ''}
                  onChange={(e) => handleFieldChange('ac', e.target.value)}
                  placeholder="S2-AFP"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">BAY / GATE *</label>
                <input
                  type="text"
                  value={formData.bay || ''}
                  onChange={(e) => handleFieldChange('bay', e.target.value)}
                  placeholder="C-27"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>
            </div>

            {/* Row 2: STD, DC, C/OFF, A/B, STATUS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">STD *</label>
                <input
                  type="text"
                  value={formData.std || ''}
                  onChange={(e) => handleFieldChange('std', e.target.value)}
                  placeholder="1050"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">DOOR CLOSE *</label>
                <input
                  type="text"
                  value={formData.dc || ''}
                  onChange={(e) => handleFieldChange('dc', e.target.value)}
                  placeholder="1053"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">C/OFF *</label>
                <input
                  type="text"
                  value={formData.co || ''}
                  onChange={(e) => handleFieldChange('co', e.target.value)}
                  placeholder="1054"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">AIRBORNE *</label>
                <input
                  type="text"
                  value={formData.ab || ''}
                  onChange={(e) => handleFieldChange('ab', e.target.value)}
                  placeholder="1109"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">STATUS *</label>
                <input
                  type="text"
                  value={formData.status || ''}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  placeholder="FLIGHT 06 MINS EARLY"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold"
                />
              </div>
            </div>

            {/* Inbound / Arrival Information Row (Optional/Inbound details) */}
            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-sky-400 uppercase tracking-wide font-mono">
                  INBOUND / ARRIVAL INFORMATION (INBOUND FLIGHT)
                </span>
                <span className="text-[10px] text-slate-400">Captured for Turnaround & Ground Time tracking</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">INBOUND FLT</label>
                  <input
                    type="text"
                    value={formData.arvFlt || ''}
                    onChange={(e) => handleFieldChange('arvFlt', e.target.value)}
                    placeholder="e.g. 142"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">INBOUND ROUTE</label>
                  <input
                    type="text"
                    value={formData.arvRoute || ''}
                    onChange={(e) => handleFieldChange('arvRoute', e.target.value)}
                    placeholder="CXB-DAC"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">C/ON (CHOCKS ON)</label>
                  <input
                    type="text"
                    value={formData.con || ''}
                    onChange={(e) => handleFieldChange('con', e.target.value)}
                    placeholder="1005"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">DOOR OPEN</label>
                  <input
                    type="text"
                    value={formData.do || ''}
                    onChange={(e) => handleFieldChange('do', e.target.value)}
                    placeholder="1006"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">ALL DISEM</label>
                  <input
                    type="text"
                    value={formData.disem || ''}
                    onChange={(e) => handleFieldChange('disem', e.target.value)}
                    placeholder="1016"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Security, Cleaning, Catering, Boarding Permit, Last Pax */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">SECURITY ST / END</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.securitySt || 'OK'}
                    onChange={(e) => handleFieldChange('securitySt', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={formData.securityEnd || 'OK'}
                    onChange={(e) => handleFieldChange('securityEnd', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">CLEANING ST / END</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.cleaningSt || 'OK'}
                    onChange={(e) => handleFieldChange('cleaningSt', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={formData.cleaningEnd || 'OK'}
                    onChange={(e) => handleFieldChange('cleaningEnd', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">CATERING ST / END</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.cateringSt || 'OK'}
                    onChange={(e) => handleFieldChange('cateringSt', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={formData.cateringEnd || 'OK'}
                    onChange={(e) => handleFieldChange('cateringEnd', e.target.value)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">BOARDING PERMIT</label>
                <input
                  type="text"
                  value={formData.permit || ''}
                  onChange={(e) => handleFieldChange('permit', e.target.value)}
                  placeholder="1030"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">LAST PAX ONBOARD</label>
                <input
                  type="text"
                  value={formData.pax || ''}
                  onChange={(e) => handleFieldChange('pax', e.target.value)}
                  placeholder="1050"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Row 4: Refueling, Last Baggage, Trim Sheet, Ground Time */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">REFUELING DONE</label>
                <input
                  type="text"
                  value={formData.refuel || ''}
                  onChange={(e) => handleFieldChange('refuel', e.target.value)}
                  placeholder="1035"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">LAST BAGGAGE REPORT</label>
                <input
                  type="text"
                  value={formData.lbag || ''}
                  onChange={(e) => handleFieldChange('lbag', e.target.value)}
                  placeholder="1033"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">TRIM SUB / SIGNED</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={formData.trimSubmitted || ''}
                    onChange={(e) => handleFieldChange('trimSubmitted', e.target.value)}
                    placeholder="1051"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={formData.trimSigned || ''}
                    onChange={(e) => handleFieldChange('trimSigned', e.target.value)}
                    placeholder="1052"
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">GROUND TIME</label>
                <input
                  type="text"
                  value={formData.ground || ''}
                  onChange={(e) => handleFieldChange('ground', e.target.value)}
                  placeholder="48 MINS"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>
            </div>

            {/* Row 4: Delay Remarks (if delayed) */}
            <div>
              <label className="text-[10px] font-bold text-amber-300 block mb-1">
                DELAY REMARKS (IF FLIGHT IS DELAYED)
              </label>
              <input
                type="text"
                value={formData.delayRemarks || ''}
                onChange={(e) => handleFieldChange('delayRemarks', e.target.value)}
                placeholder="e.g. AIRCRAFT CHANGE FOR TECHNICAL ISSUE AND LATE REPORTING OF PADMA"
                className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-200 font-sans font-medium placeholder-slate-500 outline-none focus:border-amber-400"
              />
            </div>

            {/* Row 5: Officer Info Override */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">RAMP OFFICER NAME</label>
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  placeholder="e.g. RASEL HOSSAIN or KAZI AQID AL MANSOOR"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">OFFICER USBA ID</label>
                <input
                  type="text"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  placeholder="e.g. 0088"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-t ${
            isDarkMode ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition-colors ${
              isDarkMode
                ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            CANCEL
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>SAVE REPORT & SYNC TO FIRESTORE</span>
          </button>
        </div>
      </div>
    </div>
  );
};

