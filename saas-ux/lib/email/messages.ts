// lib/email/messages.ts
//
// Transactional email copy for every supported locale. `en` defines the shape;
// every other locale must satisfy it, so a missing string is a type error.
// Tone: informal address, matching the site copy (du / tú / tu / tu / você).
// Brand terms (GetSafe 360 AI, Pro, Agency, tokens)
// are kept as-is.

import type { Locale } from '@/config/i18n';

export interface EmailMessages {
  common: {
    hi: (name: string) => string;
    footer: string;
    copyright: (year: number) => string;
  };
  perPeriod: { month: string; year: string };
  severity: Record<string, string>;
  welcome: {
    subject: string;
    heading: string;
    body: string;
    cta: string;
  };
  subscription: {
    subject: (plan: string) => string;
    heading: string;
    body: (plan: string) => string;
    plan: string;
    amount: string;
    tokens: string;
    renewal: string;
    cta: string;
  };
  scan: {
    subject: (site: string) => string;
    heading: string;
    body: (site: string) => string;
    overall: string;
    seo: string;
    performance: string;
    security: string;
    accessibility: string;
    topFindings: string;
    more: (n: number) => string;
    cta: string;
  };
  fix: {
    subject: (site: string) => string;
    heading: string;
    body: (site: string) => string;
    category: string;
    impact: string;
    tokensUsed: string;
    tokensRemaining: string;
    cta: string;
  };
  receipt: {
    subject: string;
    heading: string;
    body: string;
    invoice: string;
    date: string;
    plan: string;
    period: string;
    amount: string;
    card: string;
    renewal: string;
    download: string;
  };
}

const en: EmailMessages = {
  common: {
    hi: (n) => `Hi ${n},`,
    footer: 'You are receiving this email because you have a GetSafe 360 AI account.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/month', year: '/year' },
  severity: { critical: 'Critical', high: 'High', medium: 'Medium', warning: 'Warning', low: 'Low', info: 'Info' },
  welcome: {
    subject: 'Your GetSafe360 AI account is ready',
    heading: 'Welcome to GetSafe 360 AI',
    body: 'Your account is ready. Paste a URL to get a free analysis of your site’s SEO, performance, security and accessibility — then fix what matters with the AI Co-Pilot.',
    cta: 'Open your dashboard',
  },
  subscription: {
    subject: (p) => `Your ${p} plan is active`,
    heading: 'Thanks for subscribing',
    body: (p) => `You are now on the ${p} plan. Here is a summary of your subscription.`,
    plan: 'Plan',
    amount: 'Billing',
    tokens: 'Tokens included',
    renewal: 'Next renewal',
    cta: 'Go to your dashboard',
  },
  scan: {
    subject: (s) => `Your scan of ${s} is complete`,
    heading: 'Your scan is complete',
    body: (s) => `We finished analyzing ${s}. Here are the highlights.`,
    overall: 'Overall score',
    seo: 'SEO',
    performance: 'Performance',
    security: 'Security',
    accessibility: 'Accessibility',
    topFindings: 'Top findings',
    more: (n) => `+ ${n} more findings in your report`,
    cta: 'View full results',
  },
  fix: {
    subject: (s) => `Fix applied on ${s}`,
    heading: 'Your fix has been applied',
    body: (s) => `We applied a fix on ${s}.`,
    category: 'Category',
    impact: 'Impact',
    tokensUsed: 'Tokens used',
    tokensRemaining: 'Tokens remaining',
    cta: 'Open site cockpit',
  },
  receipt: {
    subject: 'Your GetSafe 360 AI receipt',
    heading: 'Payment received',
    body: 'Thank you. Here is your receipt.',
    invoice: 'Invoice',
    date: 'Date',
    plan: 'Plan',
    period: 'Billing period',
    amount: 'Amount paid',
    card: 'Payment method',
    renewal: 'Next renewal',
    download: 'Download invoice (PDF)',
  },
};

const de: EmailMessages = {
  common: {
    hi: (n) => `Hallo ${n},`,
    footer: 'Du erhältst diese E-Mail, weil du ein GetSafe 360 AI-Konto hast.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/Monat', year: '/Jahr' },
  severity: { critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', warning: 'Warnung', low: 'Niedrig', info: 'Info' },
  welcome: {
    subject: 'Dein GetSafe360 AI-Konto ist bereit',
    heading: 'Willkommen bei GetSafe 360 AI',
    body: 'Dein Konto ist bereit. Gib eine URL ein und erhalte eine kostenlose Analyse zu SEO, Performance, Sicherheit und Barrierefreiheit deiner Website – und behebe das Wichtigste mit dem KI-Co-Piloten.',
    cta: 'Dashboard öffnen',
  },
  subscription: {
    subject: (p) => `Dein Tarif ${p} ist aktiv`,
    heading: 'Danke für dein Abonnement',
    body: (p) => `Du nutzt jetzt den Tarif ${p}. Hier ist die Zusammenfassung deines Abonnements.`,
    plan: 'Tarif',
    amount: 'Abrechnung',
    tokens: 'Enthaltene Tokens',
    renewal: 'Nächste Verlängerung',
    cta: 'Zum Dashboard',
  },
  scan: {
    subject: (s) => `Dein Scan von ${s} ist abgeschlossen`,
    heading: 'Dein Scan ist abgeschlossen',
    body: (s) => `Wir haben die Analyse von ${s} abgeschlossen. Die wichtigsten Ergebnisse:`,
    overall: 'Gesamtbewertung',
    seo: 'SEO',
    performance: 'Performance',
    security: 'Sicherheit',
    accessibility: 'Barrierefreiheit',
    topFindings: 'Wichtigste Ergebnisse',
    more: (n) => `+ ${n} weitere Ergebnisse in deinem Bericht`,
    cta: 'Vollständige Ergebnisse ansehen',
  },
  fix: {
    subject: (s) => `Korrektur auf ${s} angewendet`,
    heading: 'Deine Korrektur wurde angewendet',
    body: (s) => `Wir haben eine Korrektur auf ${s} angewendet.`,
    category: 'Kategorie',
    impact: 'Wirkung',
    tokensUsed: 'Verbrauchte Tokens',
    tokensRemaining: 'Verbleibende Tokens',
    cta: 'Website-Cockpit öffnen',
  },
  receipt: {
    subject: 'Dein GetSafe 360 AI-Beleg',
    heading: 'Zahlung erhalten',
    body: 'Vielen Dank. Hier ist dein Beleg.',
    invoice: 'Rechnung',
    date: 'Datum',
    plan: 'Tarif',
    period: 'Abrechnungszeitraum',
    amount: 'Gezahlter Betrag',
    card: 'Zahlungsmethode',
    renewal: 'Nächste Verlängerung',
    download: 'Rechnung herunterladen (PDF)',
  },
};

const es: EmailMessages = {
  common: {
    hi: (n) => `Hola ${n},`,
    footer: 'Recibes este correo porque tienes una cuenta de GetSafe 360 AI.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/mes', year: '/año' },
  severity: { critical: 'Crítico', high: 'Alto', medium: 'Medio', warning: 'Advertencia', low: 'Bajo', info: 'Info' },
  welcome: {
    subject: 'Tu cuenta de GetSafe360 AI está lista',
    heading: 'Te damos la bienvenida a GetSafe 360 AI',
    body: 'Tu cuenta está lista. Introduce una URL para obtener un análisis gratuito del SEO, el rendimiento, la seguridad y la accesibilidad de tu sitio, y corrige lo importante con el Copiloto de IA.',
    cta: 'Abrir tu panel',
  },
  subscription: {
    subject: (p) => `Tu plan ${p} está activo`,
    heading: 'Gracias por suscribirte',
    body: (p) => `Ahora tienes el plan ${p}. Este es el resumen de tu suscripción.`,
    plan: 'Plan',
    amount: 'Facturación',
    tokens: 'Tokens incluidos',
    renewal: 'Próxima renovación',
    cta: 'Ir a tu panel',
  },
  scan: {
    subject: (s) => `El análisis de ${s} ha finalizado`,
    heading: 'Tu análisis ha finalizado',
    body: (s) => `Hemos terminado de analizar ${s}. Estos son los puntos principales.`,
    overall: 'Puntuación global',
    seo: 'SEO',
    performance: 'Rendimiento',
    security: 'Seguridad',
    accessibility: 'Accesibilidad',
    topFindings: 'Hallazgos principales',
    more: (n) => `+ ${n} hallazgos más en tu informe`,
    cta: 'Ver resultados completos',
  },
  fix: {
    subject: (s) => `Corrección aplicada en ${s}`,
    heading: 'Tu corrección se ha aplicado',
    body: (s) => `Hemos aplicado una corrección en ${s}.`,
    category: 'Categoría',
    impact: 'Impacto',
    tokensUsed: 'Tokens utilizados',
    tokensRemaining: 'Tokens restantes',
    cta: 'Abrir el panel del sitio',
  },
  receipt: {
    subject: 'Tu recibo de GetSafe 360 AI',
    heading: 'Pago recibido',
    body: 'Gracias. Este es tu recibo.',
    invoice: 'Factura',
    date: 'Fecha',
    plan: 'Plan',
    period: 'Periodo de facturación',
    amount: 'Importe pagado',
    card: 'Método de pago',
    renewal: 'Próxima renovación',
    download: 'Descargar factura (PDF)',
  },
};

const fr: EmailMessages = {
  common: {
    hi: (n) => `Bonjour ${n},`,
    footer: 'Tu reçois cet e-mail parce que tu as un compte GetSafe 360 AI.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/mois', year: '/an' },
  severity: { critical: 'Critique', high: 'Élevée', medium: 'Moyenne', warning: 'Avertissement', low: 'Faible', info: 'Info' },
  welcome: {
    subject: 'Ton compte GetSafe360 AI est prêt',
    heading: 'Bienvenue sur GetSafe 360 AI',
    body: 'Ton compte est prêt. Saisis une URL pour obtenir une analyse gratuite du SEO, des performances, de la sécurité et de l’accessibilité de ton site, puis corrige l’essentiel avec le Copilote IA.',
    cta: 'Ouvrir ton tableau de bord',
  },
  subscription: {
    subject: (p) => `Ton offre ${p} est active`,
    heading: 'Merci pour ton abonnement',
    body: (p) => `Tu es maintenant sur l’offre ${p}. Voici le récapitulatif de ton abonnement.`,
    plan: 'Offre',
    amount: 'Facturation',
    tokens: 'Tokens inclus',
    renewal: 'Prochain renouvellement',
    cta: 'Accéder à ton tableau de bord',
  },
  scan: {
    subject: (s) => `L’analyse de ${s} est terminée`,
    heading: 'Ton analyse est terminée',
    body: (s) => `Nous avons terminé l’analyse de ${s}. Voici les points essentiels.`,
    overall: 'Score global',
    seo: 'SEO',
    performance: 'Performances',
    security: 'Sécurité',
    accessibility: 'Accessibilité',
    topFindings: 'Principaux constats',
    more: (n) => `+ ${n} autres constats dans ton rapport`,
    cta: 'Voir les résultats complets',
  },
  fix: {
    subject: (s) => `Correction appliquée sur ${s}`,
    heading: 'Ta correction a été appliquée',
    body: (s) => `Nous avons appliqué une correction sur ${s}.`,
    category: 'Catégorie',
    impact: 'Impact',
    tokensUsed: 'Tokens utilisés',
    tokensRemaining: 'Tokens restants',
    cta: 'Ouvrir le cockpit du site',
  },
  receipt: {
    subject: 'Ton reçu GetSafe 360 AI',
    heading: 'Paiement reçu',
    body: 'Merci. Voici ton reçu.',
    invoice: 'Facture',
    date: 'Date',
    plan: 'Offre',
    period: 'Période de facturation',
    amount: 'Montant payé',
    card: 'Moyen de paiement',
    renewal: 'Prochain renouvellement',
    download: 'Télécharger la facture (PDF)',
  },
};

const it: EmailMessages = {
  common: {
    hi: (n) => `Ciao ${n},`,
    footer: 'Ricevi questa e-mail perché hai un account GetSafe 360 AI.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/mese', year: '/anno' },
  severity: { critical: 'Critico', high: 'Alto', medium: 'Medio', warning: 'Avviso', low: 'Basso', info: 'Info' },
  welcome: {
    subject: 'Il tuo account GetSafe360 AI è pronto',
    heading: 'Benvenuto in GetSafe 360 AI',
    body: 'Il tuo account è pronto. Inserisci un URL per ottenere un’analisi gratuita di SEO, prestazioni, sicurezza e accessibilità del tuo sito, poi correggi ciò che conta con il Co-Pilot IA.',
    cta: 'Apri la tua dashboard',
  },
  subscription: {
    subject: (p) => `Il tuo piano ${p} è attivo`,
    heading: 'Grazie per l’abbonamento',
    body: (p) => `Ora sei sul piano ${p}. Ecco il riepilogo del tuo abbonamento.`,
    plan: 'Piano',
    amount: 'Fatturazione',
    tokens: 'Token inclusi',
    renewal: 'Prossimo rinnovo',
    cta: 'Vai alla dashboard',
  },
  scan: {
    subject: (s) => `L’analisi di ${s} è completata`,
    heading: 'La tua analisi è completata',
    body: (s) => `Abbiamo terminato l’analisi di ${s}. Ecco i risultati principali.`,
    overall: 'Punteggio complessivo',
    seo: 'SEO',
    performance: 'Prestazioni',
    security: 'Sicurezza',
    accessibility: 'Accessibilità',
    topFindings: 'Risultati principali',
    more: (n) => `+ altri ${n} risultati nel tuo report`,
    cta: 'Vedi i risultati completi',
  },
  fix: {
    subject: (s) => `Correzione applicata su ${s}`,
    heading: 'La tua correzione è stata applicata',
    body: (s) => `Abbiamo applicato una correzione su ${s}.`,
    category: 'Categoria',
    impact: 'Impatto',
    tokensUsed: 'Token utilizzati',
    tokensRemaining: 'Token rimanenti',
    cta: 'Apri il cockpit del sito',
  },
  receipt: {
    subject: 'La tua ricevuta GetSafe 360 AI',
    heading: 'Pagamento ricevuto',
    body: 'Grazie. Ecco la tua ricevuta.',
    invoice: 'Fattura',
    date: 'Data',
    plan: 'Piano',
    period: 'Periodo di fatturazione',
    amount: 'Importo pagato',
    card: 'Metodo di pagamento',
    renewal: 'Prossimo rinnovo',
    download: 'Scarica la fattura (PDF)',
  },
};

// 'pt' is Brazilian Portuguese in this app (see i18n/locales.ts); informal "você".
const pt: EmailMessages = {
  common: {
    hi: (n) => `Olá ${n},`,
    footer: 'Você está recebendo este e-mail porque tem uma conta no GetSafe 360 AI.',
    copyright: (y) => `© ${y} GetSafe 360 AI`,
  },
  perPeriod: { month: '/mês', year: '/ano' },
  severity: { critical: 'Crítico', high: 'Alto', medium: 'Médio', warning: 'Aviso', low: 'Baixo', info: 'Info' },
  welcome: {
    subject: 'Sua conta GetSafe360 AI está pronta',
    heading: 'Boas-vindas ao GetSafe 360 AI',
    body: 'Sua conta está pronta. Informe uma URL para receber uma análise gratuita de SEO, desempenho, segurança e acessibilidade do seu site — e corrija o que importa com o Copiloto de IA.',
    cta: 'Abrir seu painel',
  },
  subscription: {
    subject: (p) => `Seu plano ${p} está ativo`,
    heading: 'Obrigado por assinar',
    body: (p) => `Você agora está no plano ${p}. Veja o resumo da sua assinatura.`,
    plan: 'Plano',
    amount: 'Cobrança',
    tokens: 'Tokens incluídos',
    renewal: 'Próxima renovação',
    cta: 'Ir para seu painel',
  },
  scan: {
    subject: (s) => `A análise de ${s} foi concluída`,
    heading: 'Sua análise foi concluída',
    body: (s) => `Terminamos de analisar ${s}. Veja os destaques.`,
    overall: 'Pontuação geral',
    seo: 'SEO',
    performance: 'Desempenho',
    security: 'Segurança',
    accessibility: 'Acessibilidade',
    topFindings: 'Principais descobertas',
    more: (n) => `+ ${n} descobertas a mais no seu relatório`,
    cta: 'Ver resultados completos',
  },
  fix: {
    subject: (s) => `Correção aplicada em ${s}`,
    heading: 'Sua correção foi aplicada',
    body: (s) => `Aplicamos uma correção em ${s}.`,
    category: 'Categoria',
    impact: 'Impacto',
    tokensUsed: 'Tokens usados',
    tokensRemaining: 'Tokens restantes',
    cta: 'Abrir o cockpit do site',
  },
  receipt: {
    subject: 'Seu recibo do GetSafe 360 AI',
    heading: 'Pagamento recebido',
    body: 'Obrigado. Aqui está o seu recibo.',
    invoice: 'Fatura',
    date: 'Data',
    plan: 'Plano',
    period: 'Período de cobrança',
    amount: 'Valor pago',
    card: 'Forma de pagamento',
    renewal: 'Próxima renovação',
    download: 'Baixar fatura (PDF)',
  },
};

export const EMAIL_MESSAGES: Record<Locale, EmailMessages> = { en, de, es, fr, it, pt };
