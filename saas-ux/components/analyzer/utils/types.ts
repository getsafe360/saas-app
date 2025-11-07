// components/analyzer/utils/types.ts

export type ParsedMarkdown = {
  findings: import('../types').Finding[];
  rawText: string;
  sections: {
    [key: string]: string;
  };
};

export type ScreenshotOptions = {
  width?: number;
  height?: number;
  quality?: number;
  mobile?: boolean;
  deviceScaleFactor?: number;
  locale?: string;
};

export type PrefetchResult = {
  success: boolean;
  urls: string[];
  errors?: string[];
};