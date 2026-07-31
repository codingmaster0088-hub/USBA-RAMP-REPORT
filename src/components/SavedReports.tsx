import React, { useState } from 'react';
import {
  Search,
  Trash2,
  Edit,
  Download,
  Plane,
  FileSpreadsheet
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');

  const filtered = savedReports.filter((report) => {
    const queryMatch =
      report.flight.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.formData.ac.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.date.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterType === 'ALL') return queryMatch;
    return queryMatch && report.type === filterType;
  });

  return (
    <div className="space-y-4 pb-20 fade-in text-slate-100">
      {/* Header & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            SAVED REPORTS ({savedReports.length})
          </h2>

          <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                filterType === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              ALL ({savedReports.length})
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

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by flight number, route, aircraft reg..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 font-mono"
          />
        </div>
      </div>

      {/* Reports List */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <Plane className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
          <p className="text-xs text-slate-400 font-medium">No saved reports or drafts found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((report) => {
            const isDelay = report.formData.status?.includes('DELAY');
            return (
              <div
                key={report.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md space-y-2 hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-base text-amber-300">
                        {report.flight}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60">
                        {report.route || 'N/A'}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {report.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                      <span>{report.date}</span>
                      <span>•</span>
                      <span>{report.mode}</span>
                      <span>•</span>
                      <span>A/C: <strong className="text-slate-200">{report.formData.ac || 'N/A'}</strong></span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      isDelay
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {report.formData.status || 'ONTIME'}
                  </span>
                </div>

                {/* Additional Info Snippet */}
                <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-2 rounded-xl text-[10px] font-mono text-slate-300 border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">STD</span>
                    <strong className="text-amber-400">{report.formData.std || 'N/A'} LT</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">C/OFF</span>
                    <strong className="text-white">{report.formData.co || 'N/A'} LT</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">GROUND</span>
                    <strong className="text-emerald-400">{report.formData.ground ? `${report.formData.ground}m` : 'N/A'}</strong>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-mono truncate max-w-[170px]">
                    Officer: {report.officerName} (ID-{report.officerId})
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDownloadJPG(report)}
                      className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                      title="Download JPG"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JPG</span>
                    </button>

                    <button
                      onClick={() => onEditReport(report.id)}
                      className="p-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                      title="Edit Report"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>EDIT</span>
                    </button>

                    <button
                      onClick={() => onDeleteReport(report.id)}
                      className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60 text-xs font-bold active:scale-95 transition-all"
                      title="Delete Report"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
