'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { FirebaseNotice } from '@/components/FirebaseNotice';
import { useToast } from '@/components/Toast';
import { useAppStore } from '@/lib/store';
import { STORAGE_KEYS, runStorageMigration } from '@/lib/storage-migration';
import { 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Trash2, 
  Sparkles, 
  Cpu, 
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import type { GeminiModelInfo } from '@/lib/types';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { geminiApiKey, setGeminiApiKey, geminiModel, setGeminiModel } = useAppStore();

  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    error?: string;
    modelCount?: number;
  }>({ status: 'idle' });

  const [modelsList, setModelsList] = useState<GeminiModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(geminiModel || 'gemini-2.5-flash');
  const [autoFix, setAutoFix] = useState<boolean>(true);

  // Load saved credentials from browser's localStorage
  useEffect(() => {
    runStorageMigration();
    const timer = setTimeout(() => {
      const savedKey = localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY) || '';
      const savedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-2.5-flash';
      const cachedModels = localStorage.getItem(STORAGE_KEYS.CACHED_MODELS);
      const savedAutoFix = localStorage.getItem('levelo_auto_fix_errors');

      if (savedAutoFix !== null) {
        setAutoFix(savedAutoFix === 'true');
      }

      if (savedKey) {
        setInputKey(savedKey);
        setGeminiApiKey(savedKey);
      }
      if (savedModel) {
        setSelectedModel(savedModel);
        setGeminiModel(savedModel);
      }
      if (cachedModels) {
        try {
          const parsed = JSON.parse(cachedModels);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setModelsList(parsed);
            setValidationResult({ status: 'valid', modelCount: parsed.length });
          }
        } catch {}
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [setGeminiApiKey, setGeminiModel]);

  // Real Validation Call to Gemini API
  const handleValidateKey = async (keyToTest?: string) => {
    const key = (keyToTest || inputKey).trim();
    if (!key) {
      setValidationResult({ status: 'invalid', error: 'Please enter a Gemini API Key first' });
      return;
    }

    setIsValidating(true);
    setValidationResult({ status: 'idle' });

    try {
      const response = await fetch('/api/gemini/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setValidationResult({
          status: 'valid',
          modelCount: data.models?.length || 0
        });

        // Store key strictly in browser localStorage
        setGeminiApiKey(key);
        setModelsList(data.models || []);

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.CACHED_MODELS, JSON.stringify(data.models || []));
        }

        // If current selectedModel is not in the new list, pick first flash or first available
        if (data.models && data.models.length > 0) {
          const hasCurrent = data.models.some((m: any) => m.name === selectedModel);
          if (!hasCurrent) {
            const defaultM = data.models.find((m: any) => m.name.includes('flash'))?.name || data.models[0].name;
            setSelectedModel(defaultM);
            setGeminiModel(defaultM);
          }
        }

        showToast('Gemini API Key validated successfully!', 'success');
      } else {
        setValidationResult({
          status: 'invalid',
          error: data.error || 'Failed to authenticate with Google Gemini API'
        });
        showToast('Invalid API Key', 'error');
      }
    } catch (err: any) {
      setValidationResult({
        status: 'invalid',
        error: err.message || 'Network error communicating with Google Gemini API'
      });
      showToast('Validation failed', 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    setGeminiModel(modelName);
    showToast(`Default model updated to ${modelName}`, 'info');
  };

  const toggleAutoFix = () => {
    const next = !autoFix;
    setAutoFix(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('levelo_auto_fix_errors', String(next));
      showToast(`Auto-fix errors ${next ? 'enabled' : 'disabled'}`, 'info');
    }
  };

  const handleClearKey = () => {
    if (window.confirm('Clear your saved Gemini API key from browser storage?')) {
      setInputKey('');
      setGeminiApiKey('');
      setModelsList([]);
      setValidationResult({ status: 'idle' });
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
        localStorage.removeItem(STORAGE_KEYS.CACHED_MODELS);
        // Also clean legacy keys if present
        localStorage.removeItem('gameforge_gemini_api_key');
        localStorage.removeItem('gameforge_cached_models');
      }
      showToast('Gemini key removed from browser storage', 'info');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <FirebaseNotice />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <span>Settings & Gemini AI Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure your client-side Google Gemini credentials for game generation & mechanics logic
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* Privacy & Security Guarantee Banner */}
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <strong className="text-slate-100 font-semibold block mb-0.5">
                Client-Side Storage Guarantee
              </strong>
              Your Gemini API Key is stored <span className="text-indigo-300 font-medium">strictly inside your browser&apos;s localStorage</span>. It is never persisted on any database or remote server.
            </div>
          </div>

          {/* API Key Input Section */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-slate-200">
                  Google Gemini API Key
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Get your free API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              {inputKey && (
                <button
                  onClick={handleClearKey}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1 hover:bg-rose-950/30 rounded transition-colors"
                  title="Remove saved key"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Key</span>
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  setValidationResult({ status: 'idle' });
                }}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                  title={showKey ? 'Hide key' : 'Show key'}
                  aria-label="Toggle key visibility"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationResult.status === 'valid' && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in-50">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  API key verified! Successfully loaded{' '}
                  <strong className="font-semibold text-emerald-200">
                    {validationResult.modelCount} Gemini models
                  </strong>{' '}
                  from Google API.
                </span>
              </div>
            )}

            {validationResult.status === 'invalid' && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in-50">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold text-rose-200 block">Verification Failed</strong>
                  <p className="mt-0.5 text-rose-300/90">{validationResult.error}</p>
                </div>
              </div>
            )}

            {/* Validate Button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => handleValidateKey()}
                disabled={isValidating || !inputKey.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying with Google API...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Test & Validate Key</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Model Selection Dropdown (populated from real models list) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-200">
                Active Gemini Model
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                {modelsList.length > 0
                  ? `Populated live from your Google Gemini account (${modelsList.length} models available)`
                  : 'Validate your API key above to load all supported models from Google'}
              </p>
            </div>

            {modelsList.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {modelsList.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.displayName || m.name} ({m.name})
                    </option>
                  ))}
                </select>

                {/* Model description */}
                {modelsList.find((m) => m.name === selectedModel)?.description && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
                    {modelsList.find((m) => m.name === selectedModel)?.description}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-xs text-slate-500 flex items-center justify-between">
                <span>Default fallback model: <code className="text-slate-300 font-mono">gemini-2.5-flash</code></span>
                <span className="text-[11px] text-slate-600">Awaiting Key Validation</span>
              </div>
            )}
          </div>

          {/* Auto-fix Errors Preference */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Auto-fix Errors</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                  Automatically send runtime preview errors and failed playtest health checks to Gemini AI to diagnose and repair issues (up to 3 attempts per build).
                </p>
              </div>

              <button
                type="button"
                onClick={toggleAutoFix}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoFix ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={autoFix}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoFix ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Phaser 3 Runtime Specs */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-xs text-slate-400 space-y-2">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Workspace Engine Specs</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Game Engine</span>
                <span className="text-slate-200 font-mono font-medium">Phaser v3.80.1 (Arcade Physics)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Code Editor</span>
                <span className="text-slate-200 font-mono font-medium">Monaco Editor (VS Code core)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
