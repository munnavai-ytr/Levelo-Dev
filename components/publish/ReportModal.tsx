'use client';

import { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { submitGameReport } from '@/lib/publish-manager';
import { useToast } from '@/components/Toast';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  gameTitle?: string;
}

const REPORT_REASONS = [
  'Inappropriate or offensive content',
  'Spam or misleading information',
  'Malicious or harmful scripts',
  'Copyright or intellectual property infringement',
  'Other violation',
];

export function ReportModal({ isOpen, onClose, slug, gameTitle }: ReportModalProps) {
  const { showToast } = useToast();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitGameReport({
        slug,
        gameTitle,
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      setIsDone(true);
      showToast('Report submitted for review.', 'info');
      setTimeout(() => {
        setIsDone(false);
        onClose();
      }, 1200);
    } catch {
      showToast('Failed to submit report.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">Report Game</h2>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">{gameTitle || slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isDone ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
              <p className="text-sm font-semibold text-slate-100">Thank you for keeping Levelo safe</p>
              <p className="text-xs text-slate-400">Our safety review team will inspect this game.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">Reason for report</label>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        selectedReason === r
                          ? 'bg-indigo-600/10 border-indigo-500 text-slate-100 font-medium'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report_reason"
                        checked={selectedReason === r}
                        onChange={() => setSelectedReason(r)}
                        className="accent-indigo-500"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Additional details (optional)</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isDone && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
