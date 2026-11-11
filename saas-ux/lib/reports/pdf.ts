// lib/reports/pdf.ts
//
// Prints the report HTML to an A4 PDF. The page may load nothing but the
// branding logo, so report content can never make the server fetch anything else.

import { getRenderContext, resetRenderContext } from '@/lib/browser/chromium';

async function print(html: string, allowedUrls: ReadonlyArray<string>): Promise<Buffer> {
  const context = await getRenderContext();
  try {
    const page = await context.newPage();
    try {
      await page.route('**/*', (route) => {
        const url = route.request().url();
        return url.startsWith('data:') || allowedUrls.includes(url) ? route.continue() : route.abort();
      });
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

export async function htmlToPdf(html: string, allowedUrls: ReadonlyArray<string> = []): Promise<Buffer> {
  try {
    return await print(html, allowedUrls);
  } catch {
    // A reused browser may have exited since the last request: one retry with a fresh one.
    return print(html, allowedUrls);
  }
}
