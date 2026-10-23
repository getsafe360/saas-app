// lib/fix/types.ts
//
// A fix proposal is what the user approves. It is written to Blob before
// anything touches their site, so the "Apply" click has something concrete
// and reviewable behind it rather than a spinner and a hope.

export type FixOperation =
  | {
      kind: 'head_snippet';
      issueId: string;
      title: string;
      /** Exactly what will be injected into <head> — shown to the user verbatim. */
      snippet: string;
      /** Plain-language description of the effect. */
      effect: string;
    }
  | {
      kind: 'connector_setting';
      issueId: string;
      title: string;
      key: 'disableXmlRpc' | 'blockUserEnumeration';
      enabled: boolean;
      effect: string;
    };

export type FixProposal = {
  siteId: string;
  siteUrl: string;
  generatedAt: string;
  operations: FixOperation[];
  /** Issues the user asked for that we cannot actually fix, with the reason. */
  rejected: Array<{ issueId: string; reason: string }>;
  estTokens: number;
};

export type FixOperationResult = {
  issueId: string;
  title: string;
  status: 'applied' | 'failed' | 'skipped';
  message: string;
};

export type FixResult = {
  jobId: string;
  siteUrl: string;
  appliedAt: string;
  results: FixOperationResult[];
  appliedCount: number;
  failedCount: number;
};
