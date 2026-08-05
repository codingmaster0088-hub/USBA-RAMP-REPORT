import React, { useState } from 'react';
import { ShieldAlert, KeyRound, X, Trash2 } from 'lucide-react';

interface DeleteNoticePinModalProps {
  isOpen: boolean;
  noticeId: string | null;
  onClose: () => void;
  onConfirmDelete: (noticeId: string, pin: string) => Promise<boolean>;
  isDarkMode?: boolean;
}

export const DeleteNoticePinModal: React.FC<DeleteNoticePinModalProps> = ({
  isOpen,
  noticeId,
  onClose,
  onConfirmDelete,
  isDarkMode = true
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !noticeId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.trim() !== '11126') {
      setError('Incorrect Admin Password! Delete authorized only with password 11126.');
      return;
    }

    setIsSubmitting(true);
    const success = await onConfirmDelete(noticeId, pin.trim());
    setIsSubmitting(false);

    if (success) {
      setPin('');
      setError('');
      onClose();
    } else {
      setError('Failed to delete notice. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl relative ${
          isDarkMode
            ? 'bg-slate-900 border-red-500/50 text-white'
            : 'bg-white border-red-400 text-slate-900 shadow-slate-300'
        }`}
      >
        <button
          onClick={() => {
            setPin('');
            setError('');
            onClose();
          }}
          className="absolute top-3.5 right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 text-red-500 mb-3">
          <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider">
              ADMIN VERIFICATION REQUIRED
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              Notice Removal Security
            </p>
          </div>
        </div>

        <p className="text-xs font-semibold mb-4 text-slate-300 dark:text-slate-300 leading-relaxed">
          Please insert Admin Password <span className="font-mono font-black text-amber-400 underline">11126</span> to delete this notice.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs text-center font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-extrabold uppercase text-amber-300 mb-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-400" />
              ADMIN PASSWORD
            </label>
            <input
              type="password"
              autoFocus
              maxLength={10}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              placeholder="Enter password (11126)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-center text-amber-300 font-mono font-bold tracking-widest focus:border-red-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPin('');
                setError('');
                onClose();
              }}
              className="py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-all cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'DELETING...' : 'REMOVE'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
