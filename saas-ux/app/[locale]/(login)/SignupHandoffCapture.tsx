'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SignupHandoffCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const testedUrl = searchParams.get('testedUrl');
    const testId = searchParams.get('testId');
    if (!testedUrl || !testId) return;

    sessionStorage.setItem(
      'getsafe360_signup_handoff',
      JSON.stringify({ testedUrl, testId, source: 'sign-up-page' }),
    );
  }, [searchParams]);

  return null;
}
