// lib/ai-visibility/types.ts

export interface TrackedQuestion {
  id: string;
  text: string;
}

export interface QuestionSet {
  questions: TrackedQuestion[];
  /** Language the questions are asked in (the site's, e.g. "de"). */
  language: string;
  updatedAt: string;
}

/** What one answer showed about the site. Measured from Claude's answer and its sources, not judged. */
export interface QuestionResult {
  questionId: string;
  question: string;
  /** The site's name or domain appears in the answer text. */
  mentioned: boolean;
  /** The answer cites a page of the site as a source. */
  cited: boolean;
  /** A page of the site came up in Claude's searches (cited or not). */
  foundInSearch: boolean;
  /** Pages of the site the answer cites. */
  citedUrls: string[];
  /** Other sites the answer cites, most cited first. */
  otherSources: Array<{ host: string; count: number }>;
  /** The sentence that mentions the site, or the answer's start. */
  excerpt: string;
  searches: number;
  error?: 'ANSWER_FAILED';
}

export interface VisibilityRun {
  checkedAt: string;
  trigger: 'trial' | 'manual' | 'weekly';
  /** 0–100: cited counts fully, mentioned without a citation half. */
  score: number;
  results: QuestionResult[];
  tokensUsed: number;
}
