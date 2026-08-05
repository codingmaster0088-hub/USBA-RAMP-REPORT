import React from 'react';
import { Activity, PlusCircle, FolderClock, ShieldCheck } from 'lucide-react';
import { ActiveTab, UserProfile } from '../types';

interface MobileBottomNavProps {
  user: UserProfile;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  savedCount: number;
  isDarkMode?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  user,
  activeTab,
  setActiveTab,
  savedCount,
  isDarkMode = false
}) => {
  const isAdmin = user.name.trim().toUpperCase() === 'RASEL HOSSAIN' && user.id.trim() === '0088';

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg border-t shadow-2xl pb-safe transition-all ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-800 text-slate-400'
          : 'bg-white/95 border-slate-300 text-slate-700'
      }`}
    >
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-1">
        {/* TAB 1: LIVE */}
        <button
          onClick={() => setActiveTab('live')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'live'
              ? isDarkMode
                ? 'text-amber-400 font-bold'
                : 'text-amber-800 font-black'
              : isDarkMode
              ? 'hover:text-slate-200 text-slate-400'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          {activeTab === 'live' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-500 rounded-b-full shadow-md" />
          )}
          <Activity
            className={`w-5 h-5 ${
              activeTab === 'live'
                ? 'animate-pulse text-amber-500'
                : isDarkMode
                ? 'text-slate-400'
                : 'text-slate-600'
            }`}
          />
          <span className="text-[10px] uppercase tracking-wider font-black">LIVE</span>
        </button>

        {/* TAB 2: NEW REPORT */}
        <button
          onClick={() => setActiveTab('form')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'form'
              ? isDarkMode
                ? 'text-amber-400 font-bold'
                : 'text-amber-800 font-black'
              : isDarkMode
              ? 'hover:text-slate-200 text-slate-400'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          {activeTab === 'form' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-500 rounded-b-full shadow-md" />
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 active:scale-95 transform -translate-y-0.5">
            <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black text-amber-800">
            REPORT
          </span>
        </button>

        {/* TAB 3: SAVED */}
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'saved'
              ? isDarkMode
                ? 'text-amber-400 font-bold'
                : 'text-amber-800 font-black'
              : isDarkMode
              ? 'hover:text-slate-200 text-slate-400'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          {activeTab === 'saved' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-500 rounded-b-full shadow-md" />
          )}
          <div className="relative">
            <FolderClock className="w-5 h-5" />
            {savedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[15px] text-center border border-slate-900">
                {savedCount}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black">SAVED</span>
        </button>

        {/* TAB 4: ADMIN */}
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'admin'
              ? isDarkMode
                ? 'text-amber-400 font-bold'
                : 'text-amber-800 font-black'
              : isAdmin
              ? 'text-emerald-600 font-black hover:text-emerald-700'
              : isDarkMode
              ? 'hover:text-slate-200 text-slate-500'
              : 'hover:text-slate-900 text-slate-600'
          }`}
        >
          {activeTab === 'admin' && (
            <span className="absolute top-0 w-8 h-1 bg-amber-500 rounded-b-full shadow-md" />
          )}
          <div className="relative">
            <ShieldCheck className={`w-5 h-5 ${isAdmin ? 'text-emerald-600' : ''}`} />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-black">ADMIN</span>
        </button>
      </div>
    </nav>
  );
};
