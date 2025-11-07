// components/analyzer/utils/screenshotPrefetch.ts
export type ScreenshotUrls = {
  desktopHi: string;
  desktopLo: string;
  mobileHi: string;
  mobileLo: string;
};

export function buildScreenshotUrls(
  finalUrl: string, 
  locale: string = 'en-US'
): ScreenshotUrls {
  const enc = encodeURIComponent;
  const al = enc(locale);
  const url = enc(finalUrl);

  return {
    desktopHi: `/api/screenshot?w=650&q=60&al=${al}&url=${url}`,
    desktopLo: `/api/screenshot?w=24&q=30&al=${al}&url=${url}`,
    mobileHi: `/api/screenshot?mobile=1&w=390&h=720&q=60&dpr=1&al=${al}&url=${url}`,
    mobileLo: `/api/screenshot?mobile=1&w=24&h=44&q=30&dpr=1&al=${al}&url=${url}`,
  };
}

export async function prefetchScreenshots(urls: ScreenshotUrls): Promise<void> {
  try {
    await Promise.all([
      fetch(urls.desktopHi),
      fetch(urls.desktopLo),
      fetch(urls.mobileHi),
      fetch(urls.mobileLo),
    ]);
  } catch {
    // Fail silently - individual images will load on demand
  }
}