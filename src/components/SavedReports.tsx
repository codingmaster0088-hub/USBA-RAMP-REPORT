import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Edit,
  Download,
  Plane,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  History,
  UserCheck
} from 'lucide-react';
import { SavedReport } from '../types';

interface SavedReportsProps {
  savedReports: SavedReport[];
  onEditReport: (id: string) => void;
  onDeleteReport: (id: string) => void;
  onDownloadJPG: (report: SavedReport) => void;
}

export const SavedReports: React.FC<SavedReportsProps> = ({
  savedReports,
  onEditReport,
  onDeleteReport,
  onDownloadJPG
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');
  const [showOnlyRecent48H, setShowOnlyRecent48H] = useState<boolean>(true);

  // Filter logic: Domestic/Intl + 48 Hours Expiry
  const { filteredReports, recent48Count, totalCount } = useMemo(() => {
    const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
    const nowMs = Date.now();

    const recent = savedReports.filter((rep) => {
      if (!rep.timestamp) return true;
      const repTime = new Date(rep.timestamp).getTime();
      return !isNaN(repTime) ? nowMs - repTime <= FORTY_EIGHT_HOURS_MS : true;
    });

    const activeBase = showOnlyRecent48H ? recent : savedReports;

    const matched = activeBase.filter((report) => {
      if (filterType === 'ALL') return true;
      return report.type === filterType;
    });

    return {
      filteredReports: matched,
      recent48Count: recent.length,
      totalCount: savedReports.length
    };
  }, [savedReports, filterType, showOnlyRecent48H]);

  return (
    <div className="space-y-3 pb-20 fade-in text-slate-100">
      {/* Header Banner & 48 Hours Switch */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              SAVED TURNAROUND REPORTS ({filteredReports.length})
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Synced live with Cloud Firestore across all officer devices
            </p>
          </div>

          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                filterType === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterType('DOMESTIC')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                filterType === 'DOMESTIC' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              DOM
            </button>
            <button
              onClick={() => setFilterType('INTERNATIONAL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                filterType === 'INTERNATIONAL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              INTL
            </button>
          </div>
        </div>

        {/* 48-Hours Filter Switch */}
        <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Show: <strong className="text-amber-300">{showOnlyRecent48H ? 'Last 48 Hours' : 'All History'}</strong></span>
          </div>

          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => setShowOnlyRecent48H(true)}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                showOnlyRecent48H ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>ACTIVE (48H)</span>
            </button>
            <button
              onClick={() => setShowOnlyRecent48H(false)}
              className={`px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                !showOnlyRecent48H ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'
              }`}
            >
              <History className="w-3 h-3" />
              <span>ALL ({totalCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reports Compact List */}
      {filteredReports.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <Plane className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
          <p className="text-xs text-slate-300 font-bold">No saved reports found.</p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            {showOnlyRecent48H
              ? 'No active reports created in the last 48 hours. Click "ALL" above to view older reports.'
              : 'No saved reports.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReports.map((report) => {
            const lastUpdatedTime = new Date(report.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={report.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2.5 hover:border-amber-500/40 transition-all"
              >
                {/* Top Info Bar: Flight No, Route, Type, Depart Time */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-black text-amber-300 text-sm sm:text-base tracking-wide">
                      {report.flight}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 font-mono">
                      {report.route || 'N/A'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {report.type}
                    </span>
                  </div>

                  <div className="font-mono text-xs text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    DEPART: {report.formData?.std || 'N/A'} LT
                  </div>
                </div>

                {/* Bottom Bar: Officer Info & Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-extrabold text-white">
                      {report.officerName || 'RAMP OFFICER'}
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-bold">
                      ID-{report.officerId || '0000'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Mod: {lastUpdatedTime}
                    </span>
                  </div>

                  {/* Actions: Download, Edit, Delete */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => onDownloadJPG(report)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] sm:text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                      title="Download JPG"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>JPG</span>
                    </button>

                    <button
                      onClick={() => onEditReport(report.id)}
                      className="px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-[10px] sm:text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                      title="Edit Report"
                    >
                      <Edit className="w-3.5 h-3.5 text-blue-400" />
                      <span>EDIT</span>
                    </button>

                    <button
                      onClick={() => onDeleteReport(report.id)}
                      className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 text-[10px] sm:text-xs font-bold active:scale-95 transition-all"
                      title="Delete Report"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


