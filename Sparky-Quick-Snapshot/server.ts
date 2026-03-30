import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { streamObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch HTML of a target URL
  app.get("/api/fetch-html", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const html = await response.text();
      res.json({ html: html.substring(0, 100000) });
    } catch (error) {
      console.error("Fetch error:", error);
      res.status(500).json({ error: "Could not fetch the website content." });
    }
  });

  // Vercel AI SDK Style Streaming Endpoint
  app.post("/api/analyze", async (req, res) => {
    const { url, html } = req.body;

    if (!url || !html) {
      return res.status(400).json({ error: "URL and HTML are required" });
    }

    try {
      const auditItemSchema = z.object({
        finding: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        impact: z.string(),
        fix: z.string().optional(),
      });

      const result = await streamObject({
        model: google("gemini-3-flash-preview"),
        schema: z.object({
          accessibility: auditItemSchema,
          performance: auditItemSchema,
          seo: auditItemSchema,
          security: auditItemSchema,
          content: auditItemSchema,
          wordpress: z.object({
            detected: z.boolean(),
            version: z.string().optional(),
            insights: z.string().optional(),
            vulnerabilities: z.array(auditItemSchema).optional(),
          }).optional(),
          summary: z.string(),
          cta: z.string(),
        }),
        prompt: `Analyze the following HTML content of a website (${url}) and provide a comprehensive developer-focused audit. 
        Categorize findings into: Accessibility, Performance, SEO, Security, and Content.
        For each category, provide:
        - finding: a concise description of the main issue.
        - severity: low, medium, high, or critical.
        - impact: how this issue affects the user or developer.
        - fix: a brief automated-style fix suggestion.
        
        Also, detect if it's a WordPress site (look for wp-content, wp-includes, generator meta tags).
        Provide a summary and a clear call-to-action for the developer.
        
        HTML Content:
        ${html.substring(0, 100000)}`,
      });

      result.pipeTextStreamToResponse(res);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Analysis failed." });
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
