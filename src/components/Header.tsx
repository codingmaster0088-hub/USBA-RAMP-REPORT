import React, { useState, useEffect } from 'react';
import { Plane, LogOut, ShieldCheck, Sun, Moon } from 'lucide-react';
import { UserProfile, StationCode, ActiveTab } from '../types';
import { stationList } from '../data/routesDB';

interface HeaderProps {
  user: UserProfile | null;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  onStationChange: (station: StationCode) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

const TypewriterText: React.FC<{ text: string; isDarkMode?: boolean }> = ({ text, isDarkMode = false }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (!isDeleting && index < text.length) {
      timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, 90);
    } else if (!isDeleting && index === text.length) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 2500);
    } else if (isDeleting && index > 0) {
      timeout = setTimeout(() => {
        setDisplayText((prev) => prev.slice(0, -1));
        setIndex((prev) => prev - 1);
      }, 40);
    } else if (isDeleting && index === 0) {
      setIsDeleting(false);
    }
    return () => clearTimeout(timeout);
  }, [index, isDeleting, text]);

  return (
    <span
      className={`text-[10px] font-mono font-bold italic flex items-center leading-none mt-0.5 ${
        isDarkMode ? 'text-amber-300' : 'text-amber-800'
      }`}
    >
      <span>{displayText}</span>
      <span className="animate-pulse font-bold ml-0.5">|</span>
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  onStationChange,
  isDarkMode = false,
  onToggleTheme
}) => {
  if (!user) return null;

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b shadow-xl transition-all ${
        isDarkMode
          ? 'bg-slate-900/95 border-amber-500/30 text-white'
          : 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-200/80'
      }`}
    >
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-between">
        {/* Brand & Officer Badge */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-md ${
                isDarkMode
                  ? 'bg-gradient-to-br from-navy-800 to-blue-900 border-amber-400/40 shadow-blue-950/50'
                  : 'bg-blue-900 border-amber-500 shadow-slate-300'
              }`}
            >
              <Plane className="w-4 h-4 text-amber-400 transform -rotate-45" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <span
                className={`font-black tracking-wider text-xs sm:text-sm ${
                  isDarkMode ? 'text-amber-400' : 'text-amber-700'
                }`}
              >
                US-BANGLA
              </span>
              <span
                className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded border ${
                  isDarkMode
                    ? 'bg-blue-950 border-blue-500/40 text-blue-300'
                    : 'bg-blue-100 border-blue-300 text-blue-900'
                }`}
              >
                RAMP HUD
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              <span
                className={`truncate max-w-[85px] ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                {user.name}
              </span>
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>•</span>
              <span className={isDarkMode ? 'text-amber-400' : 'text-amber-800'}>
                ID-{user.id}
              </span>
            </div>
            <TypewriterText text="invented by radoan rasel" isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* Theme Mode, Station Picker & Logout */}
        <div className="flex items-center gap-1.5">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={isDarkMode ? 'Switch to High-Sun Ramp Mode (White BG)' : 'Switch to Dark Mode'}
              className={`px-2 py-1 rounded-lg border font-black text-[10px] flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-amber-500 border-amber-600 text-slate-950 hover:bg-amber-400 shadow-sm'
              }`}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                  <span className="hidden sm:inline">SUN</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-950" />
                  <span className="hidden sm:inline">NIGHT</span>
                </>
              )}
            </button>
          )}

          <select
            value={user.station}
            onChange={(e) => onStationChange(e.target.value as StationCode)}
            className={`text-xs font-black border rounded-lg px-1.5 py-1 outline-none cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800/90 text-amber-300 border-amber-500/30'
                : 'bg-slate-100 text-slate-900 border-slate-400 focus:ring-1 focus:ring-amber-500'
            }`}
          >
            {stationList.map((st) => (
              <option key={st.code} value={st.code} className={isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                {st.code}
              </option>
            ))}
          </select>

          <button
            onClick={onLogout}
            title="Logout Officer"
            className={`p-1.5 rounded-lg border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-red-950/60 border-red-500/30 text-red-300 hover:bg-red-900/80'
                : 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
