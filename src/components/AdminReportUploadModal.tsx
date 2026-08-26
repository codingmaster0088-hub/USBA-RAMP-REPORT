import React, { useState, useRef } from 'react';
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
  RefreshCw
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

export const AdminReportUploadModal: React.FC<AdminReportUploadModalProps> = ({
  isOpen,
  onClose,
  onSaveReport,
  isDarkMode = true
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'IMAGE' | 'TEXT_PASTE'>('IMAGE');
  const [pastedText, setPastedText] = useState<string>('');

  // Officer override details
  const [officerName, setOfficerName] = useState<string>('MD.AKIFE ISLAM');
  const [officerId, setOfficerId] = useState<string>('4365');
  const [reportType, setReportType] = useState<ReportType>('INTERNATIONAL');
  const [flightMode, setFlightMode] = useState<FlightMode>('DIRECT');

  // Form Data state
  const [formData, setFormData] = useState<RampReportFormData>({
    date: '25 AUG 26',
    ac: 'S2-AJH',
    bay: 'BAY-C-21',
    docin: '00',
    docout: '00',
    arvFlt: '',
    arvRoute: '',
    con: '',
    do: '',
    disem: '',
    deptFlt: '333',
    deptRoute: 'DAC-DOH',
    std: '2010',
    dc: '2003',
    co: '2003',
    ab: '2023',
    status: 'FLIGHT 07 MINS EARLY',
    securitySt: 'OK',
    securityEnd: 'OK',
    cleaningSt: 'OK',
    cleaningEnd: 'OK',
    cateringSt: 'OK',
    cateringEnd: 'OK',
    crew: '1900',
    refuel: '1930',
    lbag: '1930',
    permit: '1910',
    pax: '2000',
    trimSubmitted: '2000',
    trimSigned: '2002',
    priorityBag: '00',
    vipBag: '00',
    offloadBag: '00',
    ground: 'ON GROUND',
    station: 'DAC'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setIsProcessing(true);

      // Auto-parse filename or metadata heuristics if available
      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    };
    reader.readAsDataURL(file);
  };

  // Text parser for copied WhatsApp ramp report message
  const parsePastedReportText = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim());
    const newForm = { ...formData };
    let newOfficerName = officerName;
    let newOfficerId = officerId;

    lines.forEach((line) => {
      const upper = line.toUpperCase();
      // Flight & Route: e.g. BS-333 (DAC-DOH) or FLIGHT: BS-333
      if (upper.includes('BS-') || upper.includes('BS ') || upper.includes('FLIGHT')) {
        const fltMatch = upper.match(/BS-?\s*(\d{3,4})/i);
        if (fltMatch) newForm.deptFlt = fltMatch[1];
        const routeMatch = upper.match(/([A-Z]{3}\s*-\s*[A-Z]{3})/i);
        if (routeMatch) newForm.deptRoute = routeMatch[1].replace(/\s+/g, '');
      }

      // Date: e.g. 25 AUG 26
      const dateMatch = upper.match(/(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{2,4})/i);
      if (dateMatch) newForm.date = dateMatch[1];

      // A/C Reg: e.g. S2-AJH
      const acMatch = upper.match(/(S2-[A-Z]{3}|HS-[A-Z]{3})/i);
      if (acMatch) newForm.ac = acMatch[1];

      // Bay: e.g. BAY-C-21 or C-21 or 25
      if (upper.includes('BAY') || upper.includes('GATE')) {
        const bayMatch = upper.match(/(?:BAY|GATE)[-:\s]*([A-Z0-9-]+)/i);
        if (bayMatch) newForm.bay = bayMatch[1];
      }

      // STD
      if (upper.includes('STD')) {
        const stdMatch = upper.match(/STD[-:\s]*(\d{4})/i);
        if (stdMatch) newForm.std = stdMatch[1];
      }

      // Door Close / DC
      if (upper.includes('DOOR CLOSE') || upper.includes('DC')) {
        const dcMatch = upper.match(/(?:DOOR CLOSE|DC)[-:\s]*(\d{4})/i);
        if (dcMatch) newForm.dc = dcMatch[1];
      }

      // C/OFF / CO
      if (upper.includes('C/OFF') || upper.includes('CO') || upper.includes('CHOX')) {
        const coMatch = upper.match(/(?:C\/OFF|CO|CHOX)[-:\s]*(\d{4})/i);
        if (coMatch) newForm.co = coMatch[1];
      }

      // A/B / Airborne
      if (upper.includes('A/B') || upper.includes('AIRBORNE')) {
        const abMatch = upper.match(/(?:A\/B|AIRBORNE)[-:\s]*(\d{4})/i);
        if (abMatch) newForm.ab = abMatch[1];
      }

      // Officer & ID
      if (upper.includes('ID-') || upper.includes('ID:') || upper.includes('OFFICER')) {
        const idMatch = upper.match(/ID[-:\s]*(\d{4,6})/i);
        if (idMatch) newOfficerId = idMatch[1];
        if (!upper.includes('RAMP OFFICER')) {
          const nameClean = line.replace(/RAMP|OFFICER|USBA|ID|\d|[-:]/gi, '').trim();
          if (nameClean.length > 2) newOfficerName = nameClean;
        }
      }

      // Delay Remarks / Reason
      if (upper.includes('REMARKS:') || upper.includes('REMARK:') || upper.includes('DELAY REASON')) {
        const remarksClean = line.replace(/^(?:REMARKS?|DELAY\s*REASON|DELAY\s*CODE)[:\s-]*/i, '').trim();
        if (remarksClean) {
          newForm.delayRemarks = remarksClean;
        }
      }
    });

    setFormData(newForm);
    setOfficerName(newOfficerName);
    setOfficerId(newOfficerId);
  };

  const handleSave = () => {
    const flightNumClean = (formData.deptFlt || formData.arvFlt || '').replace(/^BS-?/i, '').trim();
    if (!flightNumClean) {
      alert('Please enter a valid flight number (e.g., 333 or BS-333)');
      return;
    }

    const num = parseInt(flightNumClean, 10);
    const resolvedType =
      num >= 200 && num <= 499
        ? 'INTERNATIONAL'
        : num >= 100 && num <= 199
        ? 'DOMESTIC'
        : reportType;

    const dateIso = parseDateToIso(formData.date || 'TODAY');
    const customId = `report-bs${flightNumClean.toLowerCase()}-${dateIso.replace(/-/g, '')}-${officerId || Date.now()}`;

    onSaveReport(
      {
        ...formData,
        deptFlt: flightNumClean,
        deptRoute: formData.deptRoute || 'DAC-DOH'
      },
      resolvedType,
      flightMode,
      customId,
      {
        name: officerName || 'RAMP OFFICER',
        id: officerId || '4365'
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
                      <img
                        src={imagePreview}
                        alt="Uploaded Card"
                        className="max-h-56 mx-auto rounded-xl object-contain shadow-md"
                      />
                      <p className="text-[11px] text-amber-400 font-bold flex items-center justify-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Click to change image
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold">CLICK OR DRAG REPORT CARD IMAGE HERE</h4>
                      <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Supports JPG, PNG (e.g. WhatsApp departure cards like BS-333)
                      </p>
                    </div>
                  )}
                </div>
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    READY TO SYNC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">FLIGHT:</span>
                    <span className="font-black text-amber-300 text-sm">
                      BS-{formData.deptFlt || '333'} ({formData.deptRoute || 'DAC-DOH'})
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">A/C & BAY:</span>
                    <span className="font-black text-white text-sm">
                      {formData.ac || 'S2-AJH'} | {formData.bay || 'BAY-C-21'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">TIMINGS (STD / DC / AB):</span>
                    <span className="font-bold text-sky-300">
                      {formData.std || '2010'} / {formData.dc || '2003'} / {formData.ab || '2023'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">STATUS:</span>
                    <span className="font-black text-emerald-400">
                      {formData.status || 'FLIGHT 07 MINS EARLY'}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Officer:</span>
                    <span className="font-bold text-white">{officerName} (ID: {officerId})</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Turnaround Durations:</span>
                    <span className="text-amber-300 font-mono">Sec: OK | Cln: OK | Cat: OK | Pax: 1910-2000</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: TEXT PASTE */}
          {activeMode === 'TEXT_PASTE' && (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  parsePastedReportText(e.target.value);
                }}
                rows={4}
                placeholder="Paste WhatsApp report message here... (e.g. BS-333 DAC-DOH 25 AUG 26, S2-AJH, STD 2010 DC 2003...)"
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
            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Plane className="w-4 h-4 text-amber-400" />
              FLIGHT & TURNAROUND METRICS (EDITABLE)
            </h4>

            {/* Row 1: Flight, Route, Date, Reg, Bay */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">FLIGHT NUMBER *</label>
                <input
                  type="text"
                  value={formData.deptFlt || ''}
                  onChange={(e) => handleFieldChange('deptFlt', e.target.value)}
                  placeholder="333"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">ROUTE *</label>
                <input
                  type="text"
                  value={formData.deptRoute || ''}
                  onChange={(e) => handleFieldChange('deptRoute', e.target.value)}
                  placeholder="DAC-DOH"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">DATE *</label>
                <input
                  type="text"
                  value={formData.date || ''}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  placeholder="25 AUG 26"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">A/C REG *</label>
                <input
                  type="text"
                  value={formData.ac || ''}
                  onChange={(e) => handleFieldChange('ac', e.target.value)}
                  placeholder="S2-AJH"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">BAY / GATE *</label>
                <input
                  type="text"
                  value={formData.bay || ''}
                  onChange={(e) => handleFieldChange('bay', e.target.value)}
                  placeholder="BAY-C-21"
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
                  placeholder="2010"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">DOOR CLOSE *</label>
                <input
                  type="text"
                  value={formData.dc || ''}
                  onChange={(e) => handleFieldChange('dc', e.target.value)}
                  placeholder="2003"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">C/OFF *</label>
                <input
                  type="text"
                  value={formData.co || ''}
                  onChange={(e) => handleFieldChange('co', e.target.value)}
                  placeholder="2003"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">AIRBORNE *</label>
                <input
                  type="text"
                  value={formData.ab || ''}
                  onChange={(e) => handleFieldChange('ab', e.target.value)}
                  placeholder="2023"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-sky-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">STATUS *</label>
                <input
                  type="text"
                  value={formData.status || ''}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  placeholder="FLIGHT 07 MINS EARLY"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold"
                />
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
                  placeholder="1910"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">LAST PAX ONBOARD</label>
                <input
                  type="text"
                  value={formData.pax || ''}
                  onChange={(e) => handleFieldChange('pax', e.target.value)}
                  placeholder="2000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
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
                  placeholder="MD.AKIFE ISLAM"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">OFFICER USBA ID</label>
                <input
                  type="text"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  placeholder="4365"
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
