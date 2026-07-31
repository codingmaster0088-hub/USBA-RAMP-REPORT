import React, { useState } from 'react';
import {
  Plane,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Globe,
  Plus,
  Compass,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Flame,
  Zap,
  Luggage,
  Users
} from 'lucide-react';
import { SavedReport, ReportType, UserProfile } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface DashboardProps {
  user: UserProfile;
  savedReports: SavedReport[];
  onStartReport: (type: ReportType) => void;
  onEditReport: (id: string) => void;
  onViewSaved: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  savedReports,
  onStartReport,
  onEditReport,
  onViewSaved
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL');

  // Stats calculation
  const totalReports = savedReports.length;
  const domesticCount = savedReports.filter((r) => r.type === 'DOMESTIC').length;
  const intlCount = savedReports.filter((r) => r.type === 'INTERNATIONAL').length;

  const ontimeCount = savedReports.filter(
    (r) => r.formData.status && (r.formData.status.includes('ONTIME') || r.formData.status.includes('EARLY'))
  ).length;

  const delayCount = savedReports.filter(
    (r) => r.formData.status && r.formData.status.includes('DELAY')
  ).length;

  const ontimeRate = totalReports > 0 ? Math.round((ontimeCount / totalReports) * 100) : 100;

  const filteredReports = savedReports.filter((r) => {
    if (selectedFilter === 'ALL') return true;
    return r.type === selectedFilter;
  });

  // Chart Data: Ground Time per Flight
  const chartData = savedReports.slice(-6).map((r) => {
    const mins = parseInt(r.formData.ground || '0', 10) || 30;
    return {
      flight: r.flight,
      mins: mins,
      isDelay: r.formData.status?.includes('DELAY')
    };
  });

  return (
    <div className="space-y-4 pb-20 fade-in text-slate-100">
      {/* Welcome Banner / Aviation Radar HUD */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-amber-500/30 p-4 shadow-xl">
        {/* Background Radar Lines */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                র‍্যাম্প কন্ট্রোল একটিভ
              </span>
              <span className="text-xs text-slate-400 font-mono">{user.station} STATION</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white mt-1">
              স্বাগতম, <span className="text-amber-400">{user.name}</span>
            </h1>
            <p className="text-xs text-slate-300">
              ইউএস-বাংলা এয়ারলাইন্স র‍্যাম্প টার্নঅ্যারাউন্ড ও ফ্লাইট মনিটরিং হাব
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
        </div>

        {/* Action Buttons for Field Quick Entry */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => onStartReport('DOMESTIC')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-blue-950/80 transition-all border border-blue-400/30"
          >
            <Plane className="w-4 h-4 text-amber-300 transform -rotate-45" />
            <span>ডোমেস্টিক রিপোর্ট</span>
            <Plus className="w-3.5 h-3.5 opacity-80" />
          </button>

          <button
            onClick={() => onStartReport('INTERNATIONAL')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 active:scale-98 text-slate-950 text-xs font-black shadow-md shadow-amber-950/50 transition-all border border-amber-300/40"
          >
            <Globe className="w-4 h-4 text-slate-950" />
            <span>ইন্টারন্যাশনাল রিপোর্ট</span>
            <Plus className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>

      {/* Real-time Turnaround Progress Guide */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            টার্নঅ্যারাউন্ড প্রসেস মাইলস্টোন
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">24H LT</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2">
            <span className="text-[10px] text-blue-300 block font-bold">1. Chocks On</span>
            <span className="text-xs font-mono font-bold text-amber-300">C/ON</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2">
            <span className="text-[10px] text-blue-300 block font-bold">2. Service</span>
            <span className="text-xs font-mono font-bold text-slate-300">Clean/Fuel</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2">
            <span className="text-[10px] text-blue-300 block font-bold">3. Boarding</span>
            <span className="text-xs font-mono font-bold text-slate-300">PAX/Bag</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2">
            <span className="text-[10px] text-blue-300 block font-bold">4. Chocks Off</span>
            <span className="text-xs font-mono font-bold text-emerald-400">C/OFF</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
          <span className="text-[10px] text-slate-400 font-semibold block">মোট রিপোর্ট</span>
          <div className="text-lg font-extrabold text-amber-400 mt-0.5 font-mono">{totalReports}</div>
          <div className="text-[9px] text-slate-500 font-medium">
            {domesticCount} Dom | {intlCount} Intl
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
          <span className="text-[10px] text-slate-400 font-semibold block">অনটাইম রেট</span>
          <div className="text-lg font-extrabold text-emerald-400 mt-0.5 font-mono">{ontimeRate}%</div>
          <div className="text-[9px] text-emerald-500 font-medium">{ontimeCount} অনটাইম</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
          <span className="text-[10px] text-slate-400 font-semibold block">ডিলে ফ্লাইট</span>
          <div className="text-lg font-extrabold text-red-400 mt-0.5 font-mono">{delayCount}</div>
          <div className="text-[9px] text-red-400 font-medium">{delayCount > 0 ? 'মনোযোগ দিন' : 'অল ক্লিয়ার'}</div>
        </div>
      </div>

      {/* Chart: Ground Time Monitor */}
      {chartData.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              গ্রাউন্ড টাইম মনিটর (মিনিট)
            </h3>
            <span className="text-[10px] text-slate-400">সর্বশেষ {chartData.length}টি ফ্লাইট</span>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="flight" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                />
                <Bar dataKey="mins" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isDelay ? '#ef4444' : '#059669'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Active Flights List / Filter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" />
            ফ্লাইট মনিটরিং ট্র্যাকার
          </h2>

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[10px]">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                selectedFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              সব
            </button>
            <button
              onClick={() => setSelectedFilter('DOMESTIC')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                selectedFilter === 'DOMESTIC' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              DOM
            </button>
            <button
              onClick={() => setSelectedFilter('INTERNATIONAL')}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                selectedFilter === 'INTERNATIONAL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              INTL
            </button>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
            <Plane className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs text-slate-400 font-medium">কোনো সংরক্ষিত ফ্লাইট রিপোর্ট পাওয়া যায়নি</p>
            <p className="text-[11px] text-slate-500 mt-1">
              "নতুন রিপোর্ট" বাটনে ক্লিক করে প্রথম টার্নঅ্যারাউন্ড রিপোর্ট যুক্ত করুন
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReports.map((report) => {
              const isDelay = report.formData.status?.includes('DELAY');
              return (
                <div
                  key={report.id}
                  onClick={() => onEditReport(report.id)}
                  className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-xl p-3 shadow-md active:scale-98 transition-all cursor-pointer relative overflow-hidden group"
                >
                  <div
                    className={`absolute top-0 left-0 bottom-0 w-1 ${
                      isDelay ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />

                  <div className="flex items-center justify-between pl-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-amber-300">
                          {report.flight}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 border border-slate-700">
                          {report.route || 'N/A'}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {report.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>A/C: <strong className="text-slate-200">{report.formData.ac || 'N/A'}</strong></span>
                        <span>•</span>
                        <span>Bay: <strong className="text-amber-300">{report.formData.bay || 'N/A'}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDelay
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {report.formData.status || 'ONTIME'}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {report.date} | {report.formData.ground ? `${report.formData.ground}m` : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
