// lib/reports/pdf.ts
//
// Prints the report HTML to an A4 PDF. The page may load nothing but data:
// URLs (the logo is embedded), so report content never makes the server fetch anything.

import { getRenderContext, resetRenderContext } from '@/lib/browser/chromium';

async function print(html: string): Promise<Buffer> {
  const context = await getRenderContext();
  try {
    const page = await context.newPage();
    try {
      await page.route('**/*', (route) => (route.request().url().startsWith('data:') ? route.continue() : route.abort()));
      await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    } finally {
      await page.close().catch(() => undefined);
    }
  } catch (error) {
    resetRenderContext(context);
    throw error;
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  try {
    return await print(html);
  } catch {
    // A reused browser may have exited since the last request: one retry with a fresh one.
    return print(html);
  }
}
