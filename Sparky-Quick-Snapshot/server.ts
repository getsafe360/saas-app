import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { streamObject } from "ai";
import { google } from "@ai-sdk/google";
import {
  analysisResultSchema,
  logLevelSchema,
  supportedLocaleSchema,
  type AnalysisResult,
  type LogLevel,
} from "./src/contracts/snapshot";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  function normalizeUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

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

  function sendSseEvent(
    res: express.Response,
    event: "log" | "partial" | "result" | "done" | "error",
    data: unknown,
  ) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  app.get("/api/sparky/stream", async (req, res) => {
    const targetUrl = typeof req.query.url === "string" ? req.query.url : "";
    const normalizedUrl = normalizeUrl(targetUrl);
    const locale = typeof req.query.locale === "string" ? req.query.locale : "en";

    if (!normalizedUrl) {
      return res.status(400).json({ error: "A valid URL is required" });
    }

    const safeLocale = supportedLocaleSchema.safeParse(locale).success ? locale : "en";

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const emitLog = (level: LogLevel, stage: string, message: string, metric?: string) => {
      const validated = logLevelSchema.parse(level);
      sendSseEvent(res, "log", {
        level: validated,
        stage,
        message,
        metric,
        timestamp: new Date().toISOString(),
      });
    };

    try {
      emitLog("INFO", "Boot", `Initiating scan for: ${normalizedUrl}`);
      emitLog("INFO", "Fetch", "Fetching remote source code...");

      const fetchStartedAt = Date.now();
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const html = (await response.text()).substring(0, 100_000);
      const fetchElapsedMs = Date.now() - fetchStartedAt;
      emitLog("SUCCESS", "Fetch", "Source code acquired.", `${(html.length / 1024).toFixed(1)}KB`);
      emitLog("INFO", "Analyze", `Launching structured analysis (${safeLocale})...`, `${fetchElapsedMs}ms`);

      const result = await streamObject({
        model: google("gemini-3-flash-preview"),
        schema: analysisResultSchema,
        prompt: `Analyze the following HTML content of a website (${normalizedUrl}) and provide a comprehensive developer-focused audit.
        Categorize findings into: Accessibility, Performance, SEO, Security, and Content.
        For each category, provide:
        - finding: a concise description of the main issue.
        - severity: low, medium, high, or critical.
        - impact: how this issue affects the user or developer.
        - fix: a brief automated-style fix suggestion.
        
        Also, detect if it's a WordPress site (look for wp-content, wp-includes, generator meta tags).
        Provide a summary and a clear call-to-action for the developer.
        Output language locale preference: ${safeLocale}.
        
        HTML Content:
        ${html}`,
      });

      for await (const partial of result.partialObjectStream) {
        sendSseEvent(res, "partial", partial);
      }

      const finalResult = (await result.object) as AnalysisResult;
      sendSseEvent(res, "result", finalResult);
      emitLog("SUCCESS", "Analyze", "Analysis complete.");
      sendSseEvent(res, "done", { ok: true });
      res.end();
    } catch (error) {
      console.error("Analysis error:", error);
      sendSseEvent(res, "error", {
        message: "Analysis failed.",
      });
      sendSseEvent(res, "done", { ok: false });
      res.end();
    }
  });

  // Vite middleware for development
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
