import React from 'react';
import { Bell, AlertTriangle, X, CheckCircle2, Trash2 } from 'lucide-react';
import { AdminNotice } from '../types';

interface NoticeModalProps {
  notice: AdminNotice;
  onClose: () => void;
  isDarkMode?: boolean;
  isAdmin?: boolean;
  onDeleteNotice?: (id: string) => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({
  notice,
  onClose,
  isDarkMode = true,
  isAdmin = false,
  onDeleteNotice
}) => {
  const getNoticePostingTime = () => {
    if (notice.createdAt && !isNaN(notice.createdAt)) {
      const d = new Date(notice.createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
      }
    }

    if (notice.timestamp && !notice.timestamp.toLowerCase().includes('invalid')) {
      const d = new Date(notice.timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
      }
      return notice.timestamp;
    }

    if (notice.id) {
      const parts = notice.id.split('-');
      const lastPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastPart) && lastPart > 1600000000000) {
        const d = new Date(lastPart);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' LT';
      }
    }

    return 'Just Now';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in">
      <div
        className={`border-2 border-amber-500 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 relative overflow-hidden animate-pulse-border ${
          isDarkMode
            ? 'bg-slate-900 text-slate-100'
            : 'bg-white text-slate-950 shadow-amber-500/20'
        }`}
      >
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        {/* Header Icon & Title */}
        <div className="flex items-start justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-500 shrink-0 shadow-lg shadow-amber-500/10">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                SPECIAL ADMIN BROADCAST
              </span>
              <h3 className={`text-sm font-black uppercase tracking-wide mt-1 ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                ATTENTION OFFICERS
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Message Content Box */}
        <div
          className={`border-2 rounded-2xl p-4 space-y-2 text-left ${
            isDarkMode
              ? 'bg-slate-950 border-amber-500/60 text-slate-50'
              : 'bg-amber-50 border-amber-400 text-slate-950 shadow-inner'
          }`}
        >
          <div className={`flex items-center gap-1.5 text-xs font-black ${isDarkMode ? 'text-amber-300' : 'text-amber-950'}`}>
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Message from {notice.authorName} ({notice.authorId}):</span>
          </div>
          <p className={`text-xs sm:text-sm leading-relaxed font-sans font-black whitespace-pre-wrap ${isDarkMode ? 'text-slate-50' : 'text-slate-950'}`}>
            {notice.message}
          </p>
          <div className={`text-[10px] font-mono text-right pt-1.5 border-t font-black ${isDarkMode ? 'text-slate-400 border-slate-800' : 'text-slate-800 border-amber-300'}`}>
            Posted: {getNoticePostingTime()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I ACKNOWLEDGE THIS NOTICE</span>
          </button>

          {(isAdmin || onDeleteNotice) && (
            <button
              onClick={() => {
                if (onDeleteNotice) {
                  onDeleteNotice(notice.id);
                }
                onClose();
              }}
              className="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-rose-400/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>REMOVE NOTICE (ADMIN)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

