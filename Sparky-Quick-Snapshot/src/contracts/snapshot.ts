import { z } from "zod";

export const auditSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export const auditItemSchema = z.object({
  finding: z.string(),
  severity: auditSeveritySchema,
  impact: z.string(),
  fix: z.string().optional(),
});

export const wordpressInsightSchema = z.object({
  detected: z.boolean(),
  version: z.string().optional(),
  insights: z.string().optional(),
  vulnerabilities: z.array(auditItemSchema).optional(),
});

export const analysisResultSchema = z.object({
  accessibility: auditItemSchema,
  performance: auditItemSchema,
  seo: auditItemSchema,
  security: auditItemSchema,
  content: auditItemSchema,
  wordpress: wordpressInsightSchema.optional(),
  summary: z.string(),
  cta: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

const auditItemPartialSchema = auditItemSchema.partial();

export const analysisResultPartialSchema = z.object({
  accessibility: auditItemPartialSchema.optional(),
  performance: auditItemPartialSchema.optional(),
  seo: auditItemPartialSchema.optional(),
  security: auditItemPartialSchema.optional(),
  content: auditItemPartialSchema.optional(),
  wordpress: z
    .object({
      detected: z.boolean().optional(),
      version: z.string().optional(),
      insights: z.string().optional(),
      vulnerabilities: z.array(auditItemPartialSchema).optional(),
    })
    .optional(),
  summary: z.string().optional(),
  cta: z.string().optional(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

export const supportedLocaleSchema = z.enum(["en", "de", "es", "fr", "pt", "it"]);

export const logLevelSchema = z.enum(["INFO", "WARN", "ERROR", "SUCCESS"]);

export const terminalLogEntrySchema = z.object({
  timestamp: z.string(),
  level: logLevelSchema,
  stage: z.string(),
  message: z.string(),
  metric: z.string().optional(),
});

export const streamProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  stage: z.string(),
  message: z.string(),
  elapsedMs: z.number().nonnegative().optional(),
});

export type AuditItem = z.infer<typeof auditItemSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisResultPatch = z.infer<typeof analysisResultPartialSchema>;
export type SupportedLocale = z.infer<typeof supportedLocaleSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;
export type TerminalLogEntry = z.infer<typeof terminalLogEntrySchema>;
export type StreamProgress = z.infer<typeof streamProgressSchema>;
export type Category =
  | "accessibility"
  | "performance"
  | "seo"
  | "security"
  | "content"
  | "wordpress";
