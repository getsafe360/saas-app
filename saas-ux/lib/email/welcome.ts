import 'server-only';
import { sendWelcomeEmail } from './send';

/**
 * Welcome email for a user row that was JUST inserted.
 *
 * A new Clerk user can be provisioned by several code paths (auth sync,
 * ensureAppUserId, sites/add) depending on which request arrives first. Call
 * this only where an insert actually succeeded — never for an existing row — so
 * the email goes out exactly once.
 *
 * Await it: on serverless the invocation can be frozen as soon as the response
 * returns, which would drop an un-awaited send. It never throws (failures are
 * logged), so awaiting cannot break provisioning.
 */
export async function sendWelcomeToNewUser(user: {
  email: string;
  name?: string | null;
  language?: string | null;
}): Promise<void> {
  // Placeholder addresses are generated when Clerk gives us no email.
  if (user.email.endsWith('@example.invalid')) return;

  try {
    await sendWelcomeEmail({
      to: user.email,
      firstName: (user.name?.trim() || user.email.split('@')[0]).split(' ')[0],
      language: user.language,
    });
  } catch (e) {
    console.error('[welcome] email failed', e);
  }
}
