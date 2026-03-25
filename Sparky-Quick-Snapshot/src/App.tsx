import React, { useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import {
  Search,
  Accessibility,
  Zap,
  Globe,
  ShieldCheck,
  FileText,
  Layout,
  ArrowRight,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Languages,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisCard } from './components/AnalysisCard';
import { SparkyTerminal } from './components/SparkyTerminal';
import { AnalysisResult, InsightCardData, LogLevel, SupportedLocale, TerminalLogEntry } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const localeOptions: { value: SupportedLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
];

const translations: Record<SupportedLocale, any> = {
  en: {
    hero: "Hi, I'm Sparky. Let's optimize your website.",
    urlPlaceholder: 'Enter website URL (e.g. example.com)',
    analyze: 'Analyze',
    executiveSummary: 'Executive Summary',
    recommendedAction: 'Recommended Action',
    exportPdf: 'Export PDF',
    fullReport: 'Full Report',
    poweredBy: 'Powered by GetSafe360 AI Optimization Engine',
    unlockDefault: 'Unlock 1-Click Fixes',
    noCms: 'No CMS Detected',
    terminal: { processing: 'Processing', standby: 'Standby', packets: 'Analyzing data packets...', empty: 'Input URL to begin sequence' },
    labels: { metric: 'Metric', evidence: 'Evidence', action: 'Action Hint', fallback: 'Awaiting signal...' },
    categories: { accessibility: 'Accessibility', performance: 'Performance', seo: 'SEO & GEO', security: 'Security', content: 'Content', wordpress: 'WordPress Insights' },
    defaultErrors: { unexpected: 'An unexpected error occurred during analysis.', reachTarget: 'Failed to reach target server.' },
  },
  de: {
    hero: 'Hi, ich bin Sparky. Lass uns deine Website optimieren.',
    urlPlaceholder: 'Website-URL eingeben (z. B. example.com)',
    analyze: 'Analysieren',
    executiveSummary: 'Zusammenfassung',
    recommendedAction: 'Empfohlene Aktion',
    exportPdf: 'PDF exportieren',
    fullReport: 'Vollständiger Bericht',
    poweredBy: 'Bereitgestellt von GetSafe360 AI Optimization Engine',
    unlockDefault: '1-Klick-Fixes freischalten',
    noCms: 'Kein CMS erkannt',
    terminal: { processing: 'Verarbeitung', standby: 'Bereit', packets: 'Analysiere Datenpakete...', empty: 'URL eingeben, um zu starten' },
    labels: { metric: 'Metrik', evidence: 'Nachweis', action: 'Aktionshinweis', fallback: 'Warte auf Signal...' },
    categories: { accessibility: 'Barrierefreiheit', performance: 'Performance', seo: 'SEO & GEO', security: 'Sicherheit', content: 'Inhalt', wordpress: 'WordPress-Insights' },
    defaultErrors: { unexpected: 'Bei der Analyse ist ein unerwarteter Fehler aufgetreten.', reachTarget: 'Zielserver konnte nicht erreicht werden.' },
  },
  es: {
    hero: 'Hola, soy Sparky. Optimicemos tu sitio web.',
    urlPlaceholder: 'Introduce la URL del sitio (ej. example.com)',
    analyze: 'Analizar',
    executiveSummary: 'Resumen Ejecutivo',
    recommendedAction: 'Acción recomendada',
    exportPdf: 'Exportar PDF',
    fullReport: 'Informe completo',
    poweredBy: 'Impulsado por GetSafe360 AI Optimization Engine',
    unlockDefault: 'Desbloquear correcciones en 1 clic',
    noCms: 'No se detectó CMS',
    terminal: { processing: 'Procesando', standby: 'En espera', packets: 'Analizando paquetes de datos...', empty: 'Introduce una URL para comenzar' },
    labels: { metric: 'Métrica', evidence: 'Evidencia', action: 'Sugerencia de acción', fallback: 'Esperando señal...' },
    categories: { accessibility: 'Accesibilidad', performance: 'Rendimiento', seo: 'SEO y GEO', security: 'Seguridad', content: 'Contenido', wordpress: 'Insights de WordPress' },
    defaultErrors: { unexpected: 'Ocurrió un error inesperado durante el análisis.', reachTarget: 'No se pudo conectar con el servidor objetivo.' },
  },
  fr: {
    hero: 'Bonjour, je suis Sparky. Optimisons votre site web.',
    urlPlaceholder: 'Saisissez l’URL du site (ex. example.com)',
    analyze: 'Analyser',
    executiveSummary: 'Résumé Exécutif',
    recommendedAction: 'Action recommandée',
    exportPdf: 'Exporter PDF',
    fullReport: 'Rapport complet',
    poweredBy: 'Propulsé par GetSafe360 AI Optimization Engine',
    unlockDefault: 'Débloquer les correctifs en 1 clic',
    noCms: 'Aucun CMS détecté',
    terminal: { processing: 'Traitement', standby: 'Veille', packets: 'Analyse des paquets de données...', empty: 'Saisissez une URL pour commencer' },
    labels: { metric: 'Métrique', evidence: 'Preuve', action: 'Conseil d’action', fallback: 'En attente du signal...' },
    categories: { accessibility: 'Accessibilité', performance: 'Performance', seo: 'SEO & GEO', security: 'Sécurité', content: 'Contenu', wordpress: 'Insights WordPress' },
    defaultErrors: { unexpected: 'Une erreur inattendue est survenue pendant l’analyse.', reachTarget: 'Impossible d’atteindre le serveur cible.' },
  },
  pt: {
    hero: 'Olá, eu sou o Sparky. Vamos otimizar seu site.',
    urlPlaceholder: 'Insira a URL do site (ex.: example.com)',
    analyze: 'Analisar',
    executiveSummary: 'Resumo Executivo',
    recommendedAction: 'Ação recomendada',
    exportPdf: 'Exportar PDF',
    fullReport: 'Relatório completo',
    poweredBy: 'Desenvolvido por GetSafe360 AI Optimization Engine',
    unlockDefault: 'Desbloquear correções em 1 clique',
    noCms: 'Nenhum CMS detectado',
    terminal: { processing: 'Processando', standby: 'Em espera', packets: 'Analisando pacotes de dados...', empty: 'Digite uma URL para iniciar' },
    labels: { metric: 'Métrica', evidence: 'Evidência', action: 'Dica de ação', fallback: 'Aguardando sinal...' },
    categories: { accessibility: 'Acessibilidade', performance: 'Desempenho', seo: 'SEO e GEO', security: 'Segurança', content: 'Conteúdo', wordpress: 'Insights WordPress' },
    defaultErrors: { unexpected: 'Ocorreu um erro inesperado durante a análise.', reachTarget: 'Falha ao alcançar o servidor de destino.' },
  },
  it: {
    hero: 'Ciao, sono Sparky. Ottimizziamo il tuo sito web.',
    urlPlaceholder: 'Inserisci URL del sito (es. example.com)',
    analyze: 'Analizza',
    executiveSummary: 'Riepilogo Esecutivo',
    recommendedAction: 'Azione consigliata',
    exportPdf: 'Esporta PDF',
    fullReport: 'Report completo',
    poweredBy: 'Powered by GetSafe360 AI Optimization Engine',
    unlockDefault: 'Sblocca correzioni con 1 clic',
    noCms: 'Nessun CMS rilevato',
    terminal: { processing: 'Elaborazione', standby: 'In attesa', packets: 'Analisi dei pacchetti dati...', empty: 'Inserisci un URL per iniziare' },
    labels: { metric: 'Metrica', evidence: 'Evidenza', action: 'Suggerimento azione', fallback: 'In attesa del segnale...' },
    categories: { accessibility: 'Accessibilità', performance: 'Prestazioni', seo: 'SEO e GEO', security: 'Sicurezza', content: 'Contenuto', wordpress: 'Insight WordPress' },
    defaultErrors: { unexpected: 'Si è verificato un errore imprevisto durante l’analisi.', reachTarget: 'Impossibile raggiungere il server di destinazione.' },
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fallbackInsight = (fallback: string): InsightCardData => ({
  status: 'warning',
  summary: fallback,
  metric: fallback,
  evidence: fallback,
  actionHint: fallback,
});

const normalizeInsight = (value: any, fallback: string, forceMetric?: string): InsightCardData => {
  const base = fallbackInsight(fallback);
  if (!value || typeof value !== 'object') {
    return { ...base, metric: forceMetric || fallback };
  }

  const status = value.status === 'good' || value.status === 'warning' || value.status === 'critical' ? value.status : 'warning';
  const metric = typeof value.metric === 'string' && value.metric.trim().length > 0 ? value.metric : forceMetric || fallback;

  return {
    status,
    summary: typeof value.summary === 'string' && value.summary.trim().length > 0 ? value.summary : fallback,
    metric,
    evidence: typeof value.evidence === 'string' && value.evidence.trim().length > 0 ? value.evidence : fallback,
    actionHint: typeof value.actionHint === 'string' && value.actionHint.trim().length > 0 ? value.actionHint : fallback,
  };
};

export default function App() {
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<TerminalLogEntry[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useMemo(() => translations[locale], [locale]);

  const addLog = (level: LogLevel, stage: string, message: string, metric?: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [...prev, { timestamp, level, stage, message, metric }]);
  };

  const replayStreamEvents = async (events: AnalysisResult['streamEvents']) => {
    if (!events?.length) return;
    for (const event of events) {
      addLog(event.level, event.stage, event.message, event.metric);
      await wait(120);
    }
  };

  const analyzeWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    let formattedUrl = url;
    if (!url.startsWith('http')) {
      formattedUrl = `https://${url}`;
    }

    setIsAnalyzing(true);
    setResult(null);
    setError(null);
    setLogs([]);
    addLog('INFO', 'Boot', `Initiating scan for: ${formattedUrl}`);

    try {
      addLog('INFO', 'Fetch', 'Requesting remote source code...');
      const fetchResponse = await fetch(`/api/fetch-html?url=${encodeURIComponent(formattedUrl)}`);
      if (!fetchResponse.ok) throw new Error(t.defaultErrors.reachTarget);
      const { html } = await fetchResponse.json();
      addLog('SUCCESS', 'Fetch', 'Source code acquired', `Size ${(html.length / 1024).toFixed(1)}KB`);

      addLog('INFO', 'AI', 'Injecting payload into Sparky Engine...');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            text: `You are Sparky, a developer-focused website auditor.
            Output language locale: ${locale}.
            Analyze this HTML of ${formattedUrl}.
            Return strict JSON matching schema.
            Requirements:
            - Include streamEvents with structured multi-step logs.
            - Provide concrete metric + evidence for each category.
            - SEO metric MUST never be empty.
            - Detect WordPress and provide plugin/theme risks + automation hints.
            - CTA must reference the surfaced issues for conversion.
            HTML:\n${html.substring(0, 150000)}`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              streamEvents: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING },
                    stage: { type: Type.STRING },
                    message: { type: Type.STRING },
                    metric: { type: Type.STRING },
                  },
                  required: ['level', 'stage', 'message'],
                },
              },
              accessibility: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ['summary', 'metric', 'evidence', 'actionHint'],
              },
              performance: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ['summary', 'metric', 'evidence', 'actionHint'],
              },
              seo: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ['summary', 'metric', 'evidence', 'actionHint'],
              },
              security: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ['summary', 'metric', 'evidence', 'actionHint'],
              },
              content: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ['summary', 'metric', 'evidence', 'actionHint'],
              },
              wordpress: {
                type: Type.OBJECT,
                properties: {
                  detected: { type: Type.BOOLEAN },
                  version: { type: Type.STRING },
                  theme: { type: Type.STRING },
                  insightsSummary: { type: Type.STRING },
                  pluginRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  automationHints: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['detected'],
              },
              summary: { type: Type.STRING },
              cta: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  body: { type: Type.STRING },
                  buttonText: { type: Type.STRING },
                  deepLink: { type: Type.STRING },
                },
                required: ['headline', 'body', 'buttonText', 'deepLink'],
              },
            },
            required: ['accessibility', 'performance', 'seo', 'security', 'content', 'summary', 'cta'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      const normalized: AnalysisResult = {
        streamEvents: Array.isArray(parsed.streamEvents)
          ? parsed.streamEvents
              .filter((event: any) => event && typeof event.stage === 'string' && typeof event.message === 'string')
              .map((event: any) => ({
                level: ['INFO', 'SUCCESS', 'WARNING', 'METRIC', 'ERROR'].includes(event.level) ? event.level : 'INFO',
                stage: event.stage,
                message: event.message,
                metric: typeof event.metric === 'string' ? event.metric : undefined,
              }))
          : [],
        accessibility: normalizeInsight(parsed.accessibility, t.labels.fallback),
        performance: normalizeInsight(parsed.performance, t.labels.fallback),
        seo: normalizeInsight(parsed.seo, t.labels.fallback, 'Meta indexability + canonical coverage'),
        security: normalizeInsight(parsed.security, t.labels.fallback),
        content: normalizeInsight(parsed.content, t.labels.fallback),
        wordpress: parsed.wordpress,
        summary: typeof parsed.summary === 'string' ? parsed.summary : t.labels.fallback,
        cta: {
          headline: parsed.cta?.headline || t.recommendedAction,
          body: parsed.cta?.body || t.labels.fallback,
          buttonText: parsed.cta?.buttonText || t.unlockDefault,
          deepLink: parsed.cta?.deepLink || 'https://www.getsafe360.ai/pricing',
        },
      };

      await replayStreamEvents(normalized.streamEvents);
      addLog('SUCCESS', 'Pipeline', 'Analysis complete. Data grid populated.');
      setResult(normalized);
    } catch (err: any) {
      console.error(err);
      const message = err?.message || t.defaultErrors.unexpected;
      setError(message);
      addLog('ERROR', 'Pipeline', message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const wordpressCard: InsightCardData = {
    status: result?.wordpress?.detected ? 'warning' : 'good',
    summary: result?.wordpress?.detected
      ? result.wordpress?.insightsSummary || `${t.categories.wordpress}: ${result.wordpress?.version || 'Unknown version'}`
      : t.noCms,
    metric: result?.wordpress?.detected ? `Theme: ${result.wordpress?.theme || 'Unknown'}` : t.noCms,
    evidence: result?.wordpress?.pluginRisks?.length ? result.wordpress.pluginRisks.join(' • ') : t.labels.fallback,
    actionHint: result?.wordpress?.automationHints?.length ? result.wordpress.automationHints.join(' • ') : t.labels.fallback,
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-emerald-500/30">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12 lg:py-20">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5"
          >
            <Zap size={14} className="text-emerald-500" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500">Sparky AI Engine</span>
          </motion.div>

          <h1 className="mb-4 font-sans text-5xl font-black tracking-tighter lg:text-7xl">
            QUICK <span className="text-emerald-500">SNAPSHOT</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg text-white/40">{t.hero}</p>

          <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-[#151619] px-3 py-2">
            <Languages size={14} className="text-emerald-400" />
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as SupportedLocale)}
              className="bg-transparent text-sm text-white/80 outline-none"
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#151619]">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-12">
          <form onSubmit={analyzeWebsite} className="relative mx-auto max-w-2xl">
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#151619] p-2 transition-all focus-within:border-emerald-500/50 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div className="flex items-center gap-3 px-4">
                <Search className="text-white/20" size={20} />
                <input
                  type="text"
                  placeholder={t.urlPlaceholder}
                  className="h-12 w-full bg-transparent font-sans text-lg outline-none placeholder:text-white/10"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={isAnalyzing}
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !url}
                  className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <>{t.analyze} <ArrowRight size={14} /></>}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </form>
        </div>

        <div className="mb-12">
          <SparkyTerminal
            logs={logs}
            isAnalyzing={isAnalyzing}
            labels={{
              processing: t.terminal.processing,
              standby: t.terminal.standby,
              analyzingPackets: t.terminal.packets,
              emptyState: t.terminal.empty,
            }}
          />
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnalysisCard title={t.categories.accessibility} icon={Accessibility} content={result.accessibility} delay={0.1} fallbackText={t.labels.fallback} metricLabel={t.labels.metric} evidenceLabel={t.labels.evidence} actionLabel={t.labels.action} />
                <AnalysisCard title={t.categories.performance} icon={Zap} content={result.performance} delay={0.2} fallbackText={t.labels.fallback} metricLabel={t.labels.metric} evidenceLabel={t.labels.evidence} actionLabel={t.labels.action} />
                <AnalysisCard title={t.categories.seo} icon={Globe} content={result.seo} delay={0.3} fallbackText={t.labels.fallback} metricLabel={t.labels.metric} evidenceLabel={t.labels.evidence} actionLabel={t.labels.action} />
                <AnalysisCard title={t.categories.security} icon={ShieldCheck} content={result.security} delay={0.4} fallbackText={t.labels.fallback} metricLabel={t.labels.metric} evidenceLabel={t.labels.evidence} actionLabel={t.labels.action} />
                <AnalysisCard title={t.categories.content} icon={FileText} content={result.content} delay={0.5} fallbackText={t.labels.fallback} metricLabel={t.labels.metric} evidenceLabel={t.labels.evidence} actionLabel={t.labels.action} />
                {result.wordpress?.detected ? (
                  <AnalysisCard
                    title={t.categories.wordpress}
                    icon={Layout}
                    content={wordpressCard}
                    className="border-emerald-500/30 bg-emerald-500/5"
                    delay={0.6}
                    fallbackText={t.labels.fallback}
                    metricLabel={t.labels.metric}
                    evidenceLabel={t.labels.evidence}
                    actionLabel={t.labels.action}
                  />
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-white/5 bg-white/[0.02] p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">{t.noCms}</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#151619] p-8 lg:p-12">
                <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                  <div className="max-w-2xl">
                    <h2 className="mb-4 font-sans text-3xl font-bold tracking-tight">{t.executiveSummary}</h2>
                    <p className="text-lg leading-relaxed text-white/60">{result.summary}</p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 font-mono text-xs font-bold uppercase tracking-widest transition-all hover:bg-white/10">
                      <Download size={16} /> {t.exportPdf}
                    </button>
                    <button className="flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-mono text-xs font-bold uppercase tracking-widest text-black transition-all hover:bg-white/90">
                      <ExternalLink size={16} /> {t.fullReport}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 rounded-full bg-emerald-500/20 p-2 text-emerald-500">
                      <Zap size={20} />
                    </div>
                    <div>
                      <h4 className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-emerald-500">{result.cta.headline || t.recommendedAction}</h4>
                      <p className="text-lg font-medium text-white/90">{result.cta.body}</p>
                      <a href={result.cta.deepLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-500 hover:underline">
                        {result.cta.buttonText || t.unlockDefault} <ArrowRight size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 border-t border-white/5 pt-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/20">{t.poweredBy}</p>
        </footer>
      </main>
    </div>
  );
}
