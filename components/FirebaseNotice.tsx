'use client';

import { useState } from 'react';
import { isFirebaseConfigured, missingFirebaseEnvVars } from '@/lib/firebase';
import { AlertTriangle, Copy, Check, ExternalLink, X, Database } from 'lucide-react';

export function FirebaseNotice() {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isFirebaseConfigured || dismissed) {
    return null;
  }

  const envTemplate = `# Add to your .env.local file:
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 flex items-center justify-between z-40 relative">
        <div className="flex items-center gap-2 overflow-hidden">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            <strong className="font-semibold text-amber-200">Local Storage Mode active:</strong> Firebase environment variables are not configured ({missingFirebaseEnvVars.length} missing).
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-amber-200 underline hover:text-amber-100 font-medium cursor-pointer"
          >
            Setup Guide
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400/80 hover:text-amber-200"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-md"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Firebase Setup Required</h3>
                <p className="text-xs text-slate-400">Enable cloud persistence and multi-device sync</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p>
                Levelo is currently saving your projects safely in your browser&apos;s <strong>Local Storage</strong>. To sync across devices and enable real team collaboration:
              </p>

              <ol className="list-decimal list-inside space-y-2 text-slate-300 pl-1">
                <li>Create a project in the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink className="w-3 h-3" /></a></li>
                <li>Enable <strong>Authentication</strong> (Google & Email/Password providers)</li>
                <li>Create a <strong>Firestore Database</strong> in test or production mode</li>
                <li>Add a Web App and copy the config credentials into <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">.env.local</code></li>
              </ol>

              <div className="relative mt-3">
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {envTemplate}
                </pre>
                <button
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                Continue in Local Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
