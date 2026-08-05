import React, { useEffect, useState } from 'react';
import { Share2, Download, ExternalLink, X, CheckCircle, Smartphone, Image as ImageIcon } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataUrl: string;
  fileName: string;
  isDarkMode?: boolean;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  dataUrl,
  fileName,
  isDarkMode = false
}) => {
  const [canShareFiles, setCanShareFiles] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string>('');

  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  useEffect(() => {
    if (!isOpen || !dataUrl) return;

    let isMounted = true;

    // Convert dataUrl to Blob & Blob URL
    fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (!isMounted) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        try {
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            setCanShareFiles(true);
          } else if (typeof navigator.share === 'function') {
            setCanShareFiles(true);
          }
        } catch (e) {
          setCanShareFiles(false);
        }
      });

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, dataUrl, fileName]);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: fileName,
          text: `US-Bangla Ramp Turnaround Report (${fileName})`
        });
      } else if (navigator.share) {
        await navigator.share({
          title: fileName,
          url: dataUrl
        });
      } else if (blobUrl) {
        window.open(blobUrl, '_blank');
      }
    } catch (err) {
      console.log('User cancelled share or unsupported:', err);
    }
  };

  const handleForceDownload = async () => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error('Download click failed:', e);
    }
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    } else {
      const win = window.open();
      if (win) win.document.write(`<img src="${dataUrl}" style="max-width:100%;" />`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md fade-in overflow-y-auto">
      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl border p-4 sm:p-5 my-auto max-h-[90vh] flex flex-col ${
          isDarkMode
            ? 'bg-slate-900 border-amber-500/40 text-white'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 p-2 rounded-xl transition-all cursor-pointer ${
            isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500 shrink-0">
            <CheckCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-wide uppercase">
              REPORT READY FOR DOWNLOAD
            </h3>
            <p className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              {fileName}
            </p>
          </div>
        </div>

        {/* iOS Notice Box */}
        {isIOS && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-slate-900 dark:text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-800 dark:text-amber-300">
              <Smartphone className="w-4 h-4 text-amber-500" />
              <span>iPhone / iOS User Guide:</span>
            </div>
            <p className="text-[11px] leading-relaxed font-medium">
              1. Tap <strong className="text-amber-700 dark:text-amber-200">"SAVE TO PHOTOS / SHARE"</strong> below to save directly into Apple Photos camera roll or Files.
            </p>
            <p className="text-[11px] leading-relaxed font-medium">
              2. Or <strong className="text-amber-700 dark:text-amber-200">Press & Hold (Long Tap)</strong> the image preview below and select <strong>"Save to Photos"</strong>.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {canShareFiles ? (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
            >
              <Share2 className="w-4 h-4" />
              <span>SAVE TO PHOTOS / SHARE</span>
            </button>
          ) : (
            <button
              onClick={handleForceDownload}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD JPG FILE</span>
            </button>
          )}

          <button
            onClick={handleOpenInNewTab}
            className={`w-full py-2.5 px-3 rounded-xl border font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>OPEN IN NEW TAB</span>
          </button>
        </div>

        {/* Preview Container */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-950/20 p-2 flex flex-col items-center justify-center">
          <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>IMAGE PREVIEW (Long-press to save on mobile)</span>
          </div>
          <img
            src={dataUrl}
            alt={fileName}
            className="max-w-full max-h-[45vh] rounded-lg object-contain shadow-lg border border-slate-300 dark:border-slate-700"
          />
        </div>

        {/* Footer Close */}
        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-white font-black text-xs uppercase tracking-wider hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
