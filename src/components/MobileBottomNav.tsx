import React from 'react';
import { Activity, PlusCircle, FolderClock, ShieldCheck } from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';

interface MobileBottomNavProps {
  user: UserProfile;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  savedCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  user,
  activeTab,
  setActiveTab,
  savedCount
}) => {
  const isAdmin = user.name.trim().toUpperCase() === 'RASEL HOSSAIN' && user.id.trim() === '0088';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 text-slate-400 shadow-2xl pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-1">
        {/* TAB 1: LIVE */}
        <button
          onClick={() => setActiveTab('live')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeTab === 'live'
              ? 'text-amber-400 font-bold'
              : 'hover:text-slate-200 text-slate-400'
          }`}
        >
          {activeTab === 'live' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-400 rounded-b-full shadow-[0_0_8px_#f59e0b]" />
          )}
          <Activity className={`w-5 h-5 ${activeTab === 'live' ? 'animate-pulse text-amber-400' : ''}`} />
          <span className="text-[10px] uppercase tracking-wider font-extrabold">LIVE</span>
        </button>

        {/* TAB 2: NEW REPORT */}
        <button
          onClick={() => setActiveTab('form')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeTab === 'form'
              ? 'text-amber-400 font-bold'
              : 'hover:text-slate-200 text-slate-400'
          }`}
        >
          {activeTab === 'form' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-400 rounded-b-full shadow-[0_0_8px_#f59e0b]" />
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transform -translate-y-0.5">
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-300">REPORT</span>
        </button>

        {/* TAB 3: SAVED */}
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeTab === 'saved'
              ? 'text-amber-400 font-bold'
              : 'hover:text-slate-200 text-slate-400'
          }`}
        >
          {activeTab === 'saved' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-400 rounded-b-full shadow-[0_0_8px_#f59e0b]" />
          )}
          <div className="relative">
            <FolderClock className="w-5 h-5" />
            {savedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[15px] text-center border border-slate-900">
                {savedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold">SAVED</span>
        </button>

        {/* TAB 4: ADMIN */}
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
            activeTab === 'admin'
              ? 'text-amber-400 font-bold'
              : isAdmin
              ? 'text-emerald-400 hover:text-emerald-300'
              : 'hover:text-slate-200 text-slate-500'
          }`}
        >
          {activeTab === 'admin' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-400 rounded-b-full shadow-[0_0_8px_#f59e0b]" />
          )}
          <div className="relative">
            <ShieldCheck className={`w-5 h-5 ${isAdmin ? 'text-emerald-400' : ''}`} />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-extrabold">ADMIN</span>
        </button>
      </div>
    </nav>
  );
};
