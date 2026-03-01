const resultStore = new Map<string, { summary: string }>();

export function setTestResult(testId: string, summary: string) {
  resultStore.set(testId, { summary });
}

export function getTestResult(testId: string) {
  return resultStore.get(testId);
}
