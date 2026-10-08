'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { FirebaseNotice } from '@/components/FirebaseNotice';
import { useToast } from '@/components/Toast';
import { useAppStore } from '@/lib/store';
import { runStorageMigration } from '@/lib/storage-migration';
import { 
  AI_PROVIDERS_CONFIG, 
  PROVIDER_IDS, 
  type AIProviderId,
  type ProviderModelInfo
} from '@/lib/providers';
import { 
  getCachedModelStatus, 
  getAllCachedModelStatuses, 
  probeModelStatus, 
  checkProviderModels, 
  sortModelsByHealth,
  STATUS_COLORS,
  type ModelStatusInfo 
} from '@/lib/model-status';
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
  Activity,
  Server,
  Zap,
  Globe,
  Settings2,
  Check
} from 'lucide-react';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { 
    activeProvider, 
    setActiveProvider,
    providerKeys,
    setProviderKey,
    providerModels,
    setProviderModel,
    customBaseUrl,
    setCustomBaseUrl
  } = useAppStore();

  // Local state for UI
  const [showKeys, setShowKeys] = useState<Record<AIProviderId, boolean>>({
    gemini: false,
    groq: false,
    openrouter: false,
    mistral: false,
    custom: false
  });

  const [loadingProvider, setLoadingProvider] = useState<AIProviderId | null>(null);
  const [providerModelsList, setProviderModelsList] = useState<Record<AIProviderId, ProviderModelInfo[]>>({
    gemini: AI_PROVIDERS_CONFIG.gemini.presetModels,
    groq: AI_PROVIDERS_CONFIG.groq.presetModels,
    openrouter: AI_PROVIDERS_CONFIG.openrouter.presetModels,
    mistral: AI_PROVIDERS_CONFIG.mistral.presetModels,
    custom: AI_PROVIDERS_CONFIG.custom.presetModels
  });

  const [validationResults, setValidationResults] = useState<Record<AIProviderId, {
    status: 'idle' | 'valid' | 'invalid';
    error?: string;
    modelCount?: number;
    notice?: string;
  }>>({
    gemini: { status: 'idle' },
    groq: { status: 'idle' },
    openrouter: { status: 'idle' },
    mistral: { status: 'idle' },
    custom: { status: 'idle' }
  });

  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatusInfo>>({});
  const [autoFix, setAutoFix] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<AIProviderId>(activeProvider || 'gemini');

  // Load saved models and statuses from storage on mount
  useEffect(() => {
    runStorageMigration();
    const timer = setTimeout(() => {
      const savedAutoFix = localStorage.getItem('levelo_auto_fix_errors');
      if (savedAutoFix !== null) {
        setAutoFix(savedAutoFix === 'true');
      }

      // Load cached model lists from localStorage if present
      for (const p of PROVIDER_IDS) {
        try {
          const cached = localStorage.getItem(`levelo_cached_models_${p}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProviderModelsList((prev) => ({ ...prev, [p]: parsed }));
            }
          }
        } catch {}
      }

      // Load cached probe statuses
      const cachedStatuses = getAllCachedModelStatuses();
      setModelStatuses(cachedStatuses);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Sync selected tab with active provider
  useEffect(() => {
    if (activeProvider) {
      setSelectedTab(activeProvider);
    }
  }, [activeProvider]);

  // Test & load models for a given provider
  const handleTestAndLoadModels = async (provider: AIProviderId) => {
    const key = providerKeys[provider]?.trim() || '';
    if (!key && provider !== 'custom') {
      showToast(`Please enter an API key for ${AI_PROVIDERS_CONFIG[provider].name}`, 'error');
      return;
    }

    setLoadingProvider(provider);
    setValidationResults((prev) => ({ ...prev, [provider]: { status: 'idle' } }));

    try {
      const headers: Record<string, string> = {
        'x-ai-provider': provider,
        'x-ai-key': key
      };
      if (provider === 'custom' && customBaseUrl) {
        headers['x-ai-base-url'] = customBaseUrl.trim();
      }

      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid && Array.isArray(data.models) && data.models.length > 0) {
        setProviderModelsList((prev) => ({ ...prev, [provider]: data.models }));
        setValidationResults((prev) => ({
          ...prev,
          [provider]: {
            status: 'valid',
            modelCount: data.models.length,
            notice: data.notice
          }
        }));

        if (typeof window !== 'undefined') {
          localStorage.setItem(`levelo_cached_models_${provider}`, JSON.stringify(data.models));
        }

        // Check health of first 6 models
        const sampleModels = data.models.slice(0, 8).map((m: any) => m.id);
        checkProviderModels(provider, sampleModels, key, customBaseUrl, true)
          .then((newStatuses) => {
            setModelStatuses((prev) => ({ ...prev, ...newStatuses }));
          })
          .catch(() => {});

        showToast(`Loaded ${data.models.length} models for ${AI_PROVIDERS_CONFIG[provider].name}!`, 'success');
      } else {
        const errorMsg = data.error || 'Failed to authenticate with provider API';
        setValidationResults((prev) => ({
          ...prev,
          [provider]: { status: 'invalid', error: errorMsg }
        }));
        showToast(errorMsg, 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Network error communicating with provider API';
      setValidationResults((prev) => ({
        ...prev,
        [provider]: { status: 'invalid', error: errorMsg }
      }));
      showToast(errorMsg, 'error');
    } finally {
      setLoadingProvider(null);
    }
  };

  // Check health for all loaded models of current provider
  const handleCheckHealth = async (provider: AIProviderId) => {
    const models = providerModelsList[provider];
    if (!models || models.length === 0) return;

    setLoadingProvider(provider);
    try {
      const key = providerKeys[provider]?.trim() || '';
      const sample = models.slice(0, 10).map((m) => m.id);
      const results = await checkProviderModels(provider, sample, key, customBaseUrl, true);
      setModelStatuses((prev) => ({ ...prev, ...results }));
      showToast(`Health check updated for ${AI_PROVIDERS_CONFIG[provider].name}`, 'info');
    } catch (err) {
      showToast('Health check failed', 'error');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleClearKey = (provider: AIProviderId) => {
    setProviderKey(provider, '');
    setValidationResults((prev) => ({ ...prev, [provider]: { status: 'idle' } }));
    showToast(`Cleared API key for ${AI_PROVIDERS_CONFIG[provider].name}`, 'info');
  };

  const toggleAutoFix = () => {
    const next = !autoFix;
    setAutoFix(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('levelo_auto_fix_errors', String(next));
    }
    showToast(`Auto-fix ${next ? 'enabled' : 'disabled'}`, 'info');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <span>AI Provider & Engine Settings</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect your preferred AI providers. All keys are encrypted & stored strictly in your browser.
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {/* Privacy & Security Guarantee Banner */}
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <strong className="text-slate-100 font-semibold block mb-0.5">
                Client-Side Storage Guarantee
              </strong>
              Your API keys are stored <span className="text-indigo-300 font-medium">strictly inside your browser&apos;s localStorage</span> under <code className="text-indigo-300 font-mono">levelo_key_*</code>. Keys are passed in transient request headers to server streaming proxies and are never logged, stored in databases, or shared.
            </div>
          </div>

          {/* Active Provider Selector Tabs */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200">Active AI Engine</span>
                <p className="text-[11px] text-slate-400">Select which provider drives your live game generation</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Active: {AI_PROVIDERS_CONFIG[activeProvider]?.name}</span>
              </span>
            </div>

            {/* Provider Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              {PROVIDER_IDS.map((pId) => {
                const conf = AI_PROVIDERS_CONFIG[pId];
                const isActive = activeProvider === pId;
                const isSelected = selectedTab === pId;
                const hasKey = Boolean(providerKeys[pId]);

                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => {
                      setSelectedTab(pId);
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/50 shadow-sm'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-bold text-slate-200 truncate">{conf.name}</span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" title="Active Engine" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{hasKey ? 'Key saved' : 'No key'}</span>
                      {isActive && <span className="text-indigo-400 font-semibold">Active</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider Card for Selected Tab */}
          {(() => {
            const currentConf = AI_PROVIDERS_CONFIG[selectedTab];
            const currentKey = providerKeys[selectedTab] || '';
            const isSelectedActive = activeProvider === selectedTab;
            const models = providerModelsList[selectedTab] || currentConf.presetModels;
            const selectedModel = providerModels[selectedTab] || currentConf.defaultModel;
            const statusInfo = getCachedModelStatus(selectedTab, selectedModel);
            const valResult = validationResults[selectedTab];
            const sortedModels = sortModelsByHealth(models, selectedTab, modelStatuses);

            return (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-5 animate-in fade-in-50 duration-150">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-100">{currentConf.name}</h2>
                      {isSelectedActive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 border border-emerald-700/60 text-emerald-400">
                          Active Engine
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProvider(selectedTab);
                            showToast(`Switched active engine to ${currentConf.name}`, 'success');
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 transition-colors cursor-pointer"
                        >
                          Make Active
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{currentConf.description}</p>
                  </div>

                  {currentConf.websiteUrl && (
                    <a
                      href={currentConf.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Get API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Custom Endpoint Base URL Input (if custom provider) */}
                {currentConf.requiresBaseUrl && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Endpoint Base URL (OpenAI-compatible)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Globe className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={customBaseUrl}
                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      Must implement <code className="text-slate-400">/models</code> and <code className="text-slate-400">/chat/completions</code>.
                    </p>
                  </div>
                )}

                {/* API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      {currentConf.name} API Key
                    </label>
                    {currentKey && (
                      <button
                        type="button"
                        onClick={() => handleClearKey(selectedTab)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 p-0.5 hover:bg-rose-950/30 rounded transition-colors"
                        title="Remove key"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type={showKeys[selectedTab] ? 'text' : 'password'}
                      value={currentKey}
                      onChange={(e) => {
                        setProviderKey(selectedTab, e.target.value);
                        setValidationResults((prev) => ({ ...prev, [selectedTab]: { status: 'idle' } }));
                      }}
                      placeholder={currentConf.keyPlaceholder}
                      className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setShowKeys((prev) => ({ ...prev, [selectedTab]: !prev[selectedTab] }))
                        }
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                        title={showKeys[selectedTab] ? 'Hide' : 'Show'}
                        aria-label="Toggle visibility"
                      >
                        {showKeys[selectedTab] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Feedback */}
                {valResult?.status === 'valid' && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in-50">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Key verified! Successfully connected & loaded{' '}
                      <strong className="font-semibold text-emerald-200">
                        {valResult.modelCount} models
                      </strong>{' '}
                      from {currentConf.name}.
                    </span>
                  </div>
                )}

                {valResult?.status === 'invalid' && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in-50">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-rose-200 block">Connection Error</strong>
                      <p className="mt-0.5 text-rose-300/90">{valResult.error}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons: Test & Load Models, Check Health */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCheckHealth(selectedTab)}
                    disabled={loadingProvider === selectedTab || models.length === 0}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingProvider === selectedTab ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Check Models Health</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTestAndLoadModels(selectedTab)}
                    disabled={loadingProvider === selectedTab || (!currentKey && selectedTab !== 'custom')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {loadingProvider === selectedTab ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Test & Load Models</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Model Selection Dropdown with Real Health Labels */}
                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-200">
                      Active Model for {currentConf.name}
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {models.length} models available (healthy/free sorted first)
                    </span>
                  </div>

                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setProviderModel(selectedTab, e.target.value);
                      showToast(`Selected ${e.target.value}`, 'info');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {sortedModels.map((m) => {
                      const st = getCachedModelStatus(selectedTab, m.id);
                      const statusTag = st ? ` [${st.label}]` : (m.isFree ? ' [Free]' : '');
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id}){statusTag}
                        </option>
                      );
                    })}
                  </select>

                  {/* Active Model Health Badge & Details */}
                  {statusInfo && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Model Health:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          STATUS_COLORS[statusInfo.status]?.bg || 'bg-slate-900'
                        } ${
                          STATUS_COLORS[statusInfo.status]?.text || 'text-slate-300'
                        } ${
                          STATUS_COLORS[statusInfo.status]?.border || 'border-slate-800'
                        }`}
                      >
                        {statusInfo.label}
                      </span>
                      {statusInfo.latencyMs !== undefined && (
                        <span className="text-[10px] text-slate-500 font-mono ml-auto">
                          {statusInfo.latencyMs}ms response
                        </span>
                      )}
                    </div>
                  )}

                  {/* Model Description */}
                  {models.find((m) => m.id === selectedModel)?.description && (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
                      {models.find((m) => m.id === selectedModel)?.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Auto-fix Errors Preference */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Auto-fix Errors</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                  Automatically send runtime preview errors and playtest health checks to your configured AI engine to diagnose and repair issues (up to 3 attempts per build).
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

          {/* Firebase Storage Integration Notice */}
          <FirebaseNotice />
        </div>
      </main>
    </div>
  );
}
