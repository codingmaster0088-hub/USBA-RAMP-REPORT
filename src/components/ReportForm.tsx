import React, { useState, useEffect } from 'react';
import {
  Plane,
  Clock,
  Save,
  Download,
  FileText,
  Globe,
  Lock,
  Unlock
} from 'lucide-react';
import {
  RampReportFormData,
  ReportType,
  FlightMode,
  UserProfile,
  SavedReport
} from '../types';
import {
  lookupRoute,
  formatAircraftReg,
  calculateFlightStatus,
  calculateGroundTime
} from '../data/routesDB';

interface ReportFormProps {
  user: UserProfile;
  initialType: ReportType;
  reportToEdit: SavedReport | null;
  onSaveReport: (data: RampReportFormData, type: ReportType, mode: FlightMode, reportId?: string) => void;
  onDownloadJPG: (data: RampReportFormData, type: ReportType, mode: FlightMode) => void;
  onNewReport: () => void;
}

export const ReportForm: React.FC<ReportFormProps> = ({
  user,
  initialType,
  reportToEdit,
  onSaveReport,
  onDownloadJPG,
  onNewReport
}) => {
  const [reportType, setReportType] = useState<ReportType>(
    reportToEdit ? reportToEdit.type : initialType
  );
  const [flightMode, setFlightMode] = useState<FlightMode>(
    reportToEdit ? reportToEdit.mode : 'ROUND'
  );

  // Initial Form State
  const [formData, setFormData] = useState<RampReportFormData>(() => {
    if (reportToEdit) return reportToEdit.formData;

    const todayStr = new Date()
      .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
      .toUpperCase();

    return {
      date: todayStr,
      ac: '',
      bay: '',
      docin: '',
      docout: '',
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
      securitySt: '',
      securityEnd: '',
      cleaningSt: '',
      cleaningEnd: '',
      cateringSt: '',
      cateringEnd: '',
      crew: '',
      refuel: '',
      lbag: '',
      permit: '',
      pax: '',
      trimSigned: '',
      ground: '',
      station: user.station
    };
  });

  useEffect(() => {
    if (reportToEdit) {
      setFormData(reportToEdit.formData);
      setReportType(reportToEdit.type);
      setFlightMode(reportToEdit.mode);
    }
  }, [reportToEdit]);

  // Gate/Bay editability rule for International
  // If gate number has a letter after digits (e.g., C1A, C2A), DOC IN & DOC OUT are NOT editable
  const hasLetterAfterNumber = /\d+[A-Za-z]/.test((formData.bay || '').trim());
  const isDocEditable = reportType === 'INTERNATIONAL' && !hasLetterAfterNumber;

  // Handle Field Changes
  const handleChange = (field: keyof RampReportFormData, value: string) => {
    const updated = { ...formData, [field]: value.toUpperCase() };

    // Auto Route Lookup
    if (field === 'arvFlt') {
      const route = lookupRoute(value);
      if (route) updated.arvRoute = route;
    } else if (field === 'deptFlt') {
      const route = lookupRoute(value);
      if (route) updated.deptRoute = route;
    }

    // Auto Flight Status
    if (field === 'std' || field === 'co') {
      const statusRes = calculateFlightStatus(
        field === 'std' ? value : updated.std,
        field === 'co' ? value : updated.co
      );
      updated.status = statusRes.text;
    }

    // Auto Ground Time
    if (field === 'con' || field === 'co') {
      if (flightMode === 'ROUND') {
        const gt = calculateGroundTime(
          field === 'con' ? value : updated.con,
          field === 'co' ? value : updated.co
        );
        updated.ground = gt;
      }
    }

    setFormData(updated);
  };

  // Helper: Set Current Time (LT format HHMM e.g. 1435)
  const setNowTime = (field: keyof RampReportFormData) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    handleChange(field, `${hh}${mm}`);
  };

  // Helper: Set OB Preset
  const setOBPreset = (field: keyof RampReportFormData) => {
    handleChange(field, 'OB');
  };

  // Aircraft Registration Formatter on Blur
  const handleRegBlur = () => {
    if (formData.ac) {
      const formatted = formatAircraftReg(formData.ac);
      setFormData((prev) => ({ ...prev, ac: formatted }));
    }
  };

  return (
    <div className="space-y-4 pb-24 fade-in">
      {/* Flight Type & Route Mode Selector */}
      <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-400" />
            1. SELECT FLIGHT TYPE
          </h2>
          <button
            onClick={onNewReport}
            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 active:scale-95 transition-all"
          >
            RESET FORM
          </button>
        </div>

        {/* Domestic vs International Selector */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setReportType('DOMESTIC')}
            className={`py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              reportType === 'DOMESTIC'
                ? 'bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plane className="w-4 h-4 text-amber-300 transform -rotate-45" />
            DOMESTIC
          </button>
          <button
            onClick={() => setReportType('INTERNATIONAL')}
            className={`py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
              reportType === 'INTERNATIONAL'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            INTERNATIONAL
          </button>
        </div>

        {/* Direct vs Round Flight Selector */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase block">
            2. SELECT ROUTE MODE
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setFlightMode('ROUND');
                if (formData.con && formData.co) {
                  const gt = calculateGroundTime(formData.con, formData.co);
                  setFormData((prev) => ({ ...prev, ground: gt }));
                }
              }}
              className={`py-2.5 rounded-lg text-xs font-black transition-all ${
                flightMode === 'ROUND'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔄 ROUND (Arrival + Departure)
            </button>
            <button
              onClick={() => {
                setFlightMode('DIRECT');
                setFormData((prev) => ({ ...prev, ground: 'ON GROUND' }));
              }}
              className={`py-2.5 rounded-lg text-xs font-black transition-all ${
                flightMode === 'DIRECT'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ✈️ DIRECT (Departure Only)
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: GENERAL INFO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            GENERAL INFORMATION
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
              DATE
            </label>
            <input
              type="text"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              placeholder="DD MMM YY"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
              {reportType === 'INTERNATIONAL' ? 'GATE NO' : 'BAY NO'}
            </label>
            <input
              type="text"
              value={formData.bay}
              onChange={(e) => handleChange('bay', e.target.value)}
              placeholder={reportType === 'INTERNATIONAL' ? 'e.g. C1 or C1A' : 'e.g. 25'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
            AIRCRAFT REGISTRATION (A/C REG)
          </label>
          <input
            type="text"
            value={formData.ac}
            onChange={(e) => handleChange('ac', e.target.value)}
            onBlur={handleRegBlur}
            placeholder="e.g. AKO (Formats to S2-AKO, SXA -> HS-SXA, BBG -> PK-BBG)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
          />
        </div>

        {/* International Extra Docs (Gate C1/C2 vs C1A/C2A logic) */}
        {reportType === 'INTERNATIONAL' && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
              <span className="flex items-center gap-1">
                {isDocEditable ? (
                  <Unlock className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Lock className="w-3 h-3 text-red-400" />
                )}
                DOC IN / DOC OUT STATUS
              </span>
              <span className={isDocEditable ? 'text-emerald-400' : 'text-amber-400 font-mono'}>
                {isDocEditable
                  ? 'EDITABLE (STANDARD GATE)'
                  : 'LOCKED (LETTER GATE e.g. C1A)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-blue-300 uppercase mb-1 block">
                  DOC IN (LT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!isDocEditable}
                    value={formData.docin || ''}
                    onChange={(e) => handleChange('docin', e.target.value)}
                    placeholder="0000"
                    className={`w-full border rounded-xl pl-3 pr-10 py-2 text-xs font-mono outline-none ${
                      isDocEditable
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-amber-400'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  {isDocEditable && (
                    <button
                      type="button"
                      onClick={() => setNowTime('docin')}
                      className="absolute right-1 top-1 bottom-1 px-2 text-amber-400 hover:text-amber-300 font-bold text-xs"
                    >
                      🕒
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-blue-300 uppercase mb-1 block">
                  DOC OUT (LT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={4}
                    disabled={!isDocEditable}
                    value={formData.docout || ''}
                    onChange={(e) => handleChange('docout', e.target.value)}
                    placeholder="0000"
                    className={`w-full border rounded-xl pl-3 pr-10 py-2 text-xs font-mono outline-none ${
                      isDocEditable
                        ? 'bg-slate-950 border-slate-800 text-white focus:border-amber-400'
                        : 'bg-slate-900/60 border-slate-800/60 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  {isDocEditable && (
                    <button
                      type="button"
                      onClick={() => setNowTime('docout')}
                      className="absolute right-1 top-1 bottom-1 px-2 text-amber-400 hover:text-amber-300 font-bold text-xs"
                    >
                      🕒
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: ARRIVAL INFO (Only if Round Mode) */}
      {flightMode === 'ROUND' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300">
              ARRIVAL INFORMATION
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ARR FLIGHT (ARV FLT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-extrabold text-slate-500">
                  BS-
                </span>
                <input
                  type="number"
                  value={formData.arvFlt}
                  onChange={(e) => handleChange('arvFlt', e.target.value)}
                  placeholder="121"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-300 font-mono font-bold focus:border-amber-400 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ARR ROUTE
              </label>
              <input
                type="text"
                value={formData.arvRoute}
                onChange={(e) => handleChange('arvRoute', e.target.value)}
                placeholder="DAC-JSR"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                C/ON (LT)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.con}
                  onChange={(e) => handleChange('con', e.target.value)}
                  placeholder="1300"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('con')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                D/O (LT)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.do}
                  onChange={(e) => handleChange('do', e.target.value)}
                  placeholder="1305"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('do')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                ALL DISEM
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={4}
                  value={formData.disem}
                  onChange={(e) => handleChange('disem', e.target.value)}
                  placeholder="1312"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('disem')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DEPARTURE INFO */}
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-3.5 shadow-xl space-y-3.5 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">
              DEPARTURE INFORMATION
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            FLIGHT TIMINGS
          </span>
        </div>

        {/* Dept Flight & Route */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-amber-200 uppercase mb-1 block">
              DEPT FLIGHT (BS-) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-extrabold text-amber-500">
                BS-
              </span>
              <input
                type="number"
                value={formData.deptFlt}
                onChange={(e) => handleChange('deptFlt', e.target.value)}
                placeholder="122"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-amber-200 uppercase mb-1 block">
              DEPT ROUTE
            </label>
            <input
              type="text"
              value={formData.deptRoute}
              onChange={(e) => handleChange('deptRoute', e.target.value)}
              placeholder="JSR-DAC"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:border-amber-400 outline-none uppercase"
            />
          </div>
        </div>

        {/* Timings: STD, D/C, C/O, A/B */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              STD (LT) *
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.std}
                onChange={(e) => handleChange('std', e.target.value)}
                placeholder="1400"
                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-3 pr-8 py-2 text-xs text-amber-300 font-mono font-extrabold focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('std')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              D/C (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.dc}
                onChange={(e) => handleChange('dc', e.target.value)}
                placeholder="1355"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('dc')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              C/OFF (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.co}
                onChange={(e) => handleChange('co', e.target.value)}
                placeholder="1405"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('co')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-300 uppercase mb-1 block">
              A/B (LT)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={formData.ab}
                onChange={(e) => handleChange('ab', e.target.value)}
                placeholder="1415"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setNowTime('ab')}
                className="absolute right-1 top-1 bottom-1 px-1.5 text-amber-400 text-xs"
              >
                🕒
              </button>
            </div>
          </div>
        </div>

        {/* Status Preview Bar */}
        {formData.status && (
          <div
            className={`p-2.5 rounded-xl border text-center font-mono font-extrabold text-xs transition-all ${
              formData.status.includes('DELAY')
                ? 'bg-red-950/80 border-red-500/50 text-red-300'
                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
            }`}
          >
            {formData.status}
          </div>
        )}

        {/* EXACT 12 TURNAROUND FIELDS REQUESTED BY USER */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <label className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider block">
            TURNAROUND MILESTONES (12 FIELDS)
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. SECURITY CHECK ST */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                1. SECURITY CHECK ST
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.securitySt || ''}
                  onChange={(e) => handleChange('securitySt', e.target.value)}
                  placeholder="1310"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('securitySt')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 2. SECURITY CHECK END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                2. SECURITY CHECK END
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.securityEnd || ''}
                  onChange={(e) => handleChange('securityEnd', e.target.value)}
                  placeholder="1320"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('securityEnd')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 3. CLEANING START */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                3. CLEANING START
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cleaningSt || ''}
                  onChange={(e) => handleChange('cleaningSt', e.target.value)}
                  placeholder="1320"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('cleaningSt')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 4. CLEANING END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                4. CLEANING END
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cleaningEnd || ''}
                  onChange={(e) => handleChange('cleaningEnd', e.target.value)}
                  placeholder="1328"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('cleaningEnd')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 5. CATERING START */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                5. CATERING START
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('cateringSt')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cateringSt || ''}
                    onChange={(e) => handleChange('cateringSt', e.target.value)}
                    placeholder="1325"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cateringSt')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 6. CATERING END */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                6. CATERING END
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('cateringEnd')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.cateringEnd || ''}
                    onChange={(e) => handleChange('cateringEnd', e.target.value)}
                    placeholder="1335"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('cateringEnd')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 7. CREW REPORT */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                7. CREW REPORT
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('crew')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.crew}
                    onChange={(e) => handleChange('crew', e.target.value)}
                    placeholder="1320"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('crew')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 8. REFUELING DONE */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                8. REFUELING DONE
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('refuel')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.refuel}
                    onChange={(e) => handleChange('refuel', e.target.value)}
                    placeholder="1335"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('refuel')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>

            {/* 9. LAST BAGGAGE REPORT */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                9. LAST BAGGAGE REPORT
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.lbag}
                  onChange={(e) => handleChange('lbag', e.target.value)}
                  placeholder="1340"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('lbag')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 10. BOARDING PERMITTED */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                10. BOARDING PERMITTED
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.permit}
                  onChange={(e) => handleChange('permit', e.target.value)}
                  placeholder="1335"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('permit')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 11. LAST PAX ONBOARD */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                11. LAST PAX ONBOARD
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.pax}
                  onChange={(e) => handleChange('pax', e.target.value)}
                  placeholder="1350"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setNowTime('pax')}
                  className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                >
                  🕒
                </button>
              </div>
            </div>

            {/* 12. TRIM SIGNED */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                12. TRIM SIGNED
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOBPreset('trimSigned')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[10px] rounded-lg border border-slate-700"
                >
                  OB
                </button>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.trimSigned || ''}
                    onChange={(e) => handleChange('trimSigned', e.target.value)}
                    placeholder="1352"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-2 pr-7 py-2 text-xs text-white font-mono focus:border-amber-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setNowTime('trimSigned')}
                    className="absolute right-1 top-1 bottom-1 text-amber-400 text-xs"
                  >
                    🕒
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auto calculated Ground Time */}
        <div className="pt-2 border-t border-slate-800">
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
            GROUND TIME
          </label>
          <input
            type="text"
            readOnly
            value={
              flightMode === 'DIRECT'
                ? 'ON GROUND'
                : formData.ground
                ? `${formData.ground} MINS`
                : 'PENDING'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-amber-400 text-center outline-none"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSaveReport(formData, reportType, flightMode, reportToEdit?.id)}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 active:scale-98 text-white font-black text-xs shadow-lg shadow-blue-950/80 transition-all border border-blue-400/30"
        >
          <Save className="w-4 h-4 text-amber-300" />
          <span>SAVE REPORT</span>
        </button>

        <button
          type="button"
          onClick={() => onDownloadJPG(formData, reportType, flightMode)}
          className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-98 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/50 transition-all border border-amber-300/50"
        >
          <Download className="w-4 h-4" />
          <span>DOWNLOAD JPG</span>
        </button>
      </div>
    </div>
  );
};
