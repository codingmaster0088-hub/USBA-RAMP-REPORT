import React from 'react';
import { Bell, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { AdminNotice } from '../types';

interface NoticeModalProps {
  notice: AdminNotice;
  onClose: () => void;
}

export const NoticeModal: React.FC<NoticeModalProps> = ({ notice, onClose }) => {
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
      <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-slate-100 relative overflow-hidden animate-pulse-border">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />

        {/* Header Icon & Title */}
        <div className="flex items-start justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                SPECIAL ADMIN BROADCAST
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wide mt-1">
                ATTENTION OFFICERS
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Message Content Box */}
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Message from {notice.authorName} ({notice.authorId}):</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
            {notice.message}
          </p>
          <div className="text-[10px] text-slate-500 font-mono text-right pt-1 border-t border-slate-900">
            Posted: {getNoticePostingTime()}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>I ACKNOWLEDGE THIS NOTICE</span>
        </button>
      </div>
    </div>
  );
};
