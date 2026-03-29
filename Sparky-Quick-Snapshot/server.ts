import "dotenv/config";
import express, { type Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "METRIC" | "ERROR";

interface StreamLogPayload {
  level: LogLevel;
  stage: string;
  message: string;
  metric?: string;
  timestamp: string;
}

const MAX_HTML_CHARS = 140_000;

function nowTime(): string {
  return new Date().toISOString();
}

function normalizeUrl(input: string): string | null {
  const candidate = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function writeSseEvent(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeLog(res: Response, payload: Omit<StreamLogPayload, "timestamp">) {
  writeSseEvent(res, "log", {
    ...payload,
    timestamp: nowTime(),
  } satisfies StreamLogPayload);
}

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/fetch-html", async (req, res) => {
    const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
    const normalized = normalizeUrl(targetUrl);
    if (!normalized) {
      return res.status(400).json({ error: "Valid URL is required" });
    }

    try {
      const response = await fetch(normalized, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return res.json({ html: html.substring(0, MAX_HTML_CHARS) });
    } catch (error) {
      console.error("fetch-html error", error);
      return res.status(500).json({ error: "Could not fetch the website content." });
    }
  });

  app.get("/api/sparky/stream", async (req, res) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    const locale = typeof req.query.locale === "string" ? req.query.locale : "en";
    const targetUrl = normalizeUrl(rawUrl);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    if (!targetUrl) {
      writeSseEvent(res, "error", { message: "Please provide a valid http/https URL." });
      writeSseEvent(res, "done", { ok: false });
      res.end();
      return;
    }

    try {
      writeLog(res, { level: "INFO", stage: "Fetch", message: `Fetching source for ${targetUrl}` });

      const htmlResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (!htmlResponse.ok) {
        throw new Error(`Unable to fetch HTML: ${htmlResponse.status}`);
      }

      const html = (await htmlResponse.text()).substring(0, MAX_HTML_CHARS);
      writeLog(res, {
        level: "SUCCESS",
        stage: "Fetch",
        message: "Source acquired",
        metric: `${(html.length / 1024).toFixed(1)}KB`,
      });

      writeLog(res, {
        level: "INFO",
        stage: "Gemini",
        message: "Sending payload to Gemini data model",
      });

      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: `Locale: ${locale}\n\nAnalyze the HTML from ${targetUrl}. Produce a strict JSON response with actionable sections for: accessibility, performance, seo, security, content.\n\nFor each section use { status, summary, metric, evidence, actionHint }.\n\nStatus must be one of: good, warning, critical.\n\nAlso detect WordPress and return wordpress object with fields: detected(boolean), version(optional), theme(optional), insightsSummary(optional), pluginRisks(optional array), automationHints(optional array).\n\nInclude summary and cta with { headline, body, buttonText, deepLink }.\n\nHTML:\n${html}`,
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              accessibility: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  metric: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  actionHint: { type: Type.STRING },
                },
                required: ["status", "summary", "metric", "evidence", "actionHint"],
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
                required: ["status", "summary", "metric", "evidence", "actionHint"],
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
                required: ["status", "summary", "metric", "evidence", "actionHint"],
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
                required: ["status", "summary", "metric", "evidence", "actionHint"],
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
                required: ["status", "summary", "metric", "evidence", "actionHint"],
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
                required: ["detected"],
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
                required: ["headline", "body", "buttonText", "deepLink"],
              },
            },
            required: ["accessibility", "performance", "seo", "security", "content", "summary", "cta"],
          },
        },
      });

      const text = response.text ?? "{}";
      const parsed = JSON.parse(text) as Record<string, unknown>;

      writeLog(res, {
        level: "SUCCESS",
        stage: "Gemini",
        message: "Analysis complete. Rendering cards.",
      });

      writeSseEvent(res, "result", parsed);
      writeSseEvent(res, "done", { ok: true });
      res.end();
    } catch (error) {
      console.error("sparky stream error", error);
      const message = error instanceof Error ? error.message : "Unexpected analysis failure.";
      writeSseEvent(res, "error", { message });
      writeSseEvent(res, "done", { ok: false });
      res.end();
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
