import { useTranslations } from "next-intl";

export default function TermsPage() {
  const t = useTranslations("terms");

  return (
    <div className="max-w-full">
      <section className="py-4 border-t dark:border-[#1b2430]">
        <div className="space-y-2 p-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-sky-500 via-purple-800 to-red-600 bg-clip-text text-transparent">
              Terms and Conditions
            </span>
          </h1>
        </div>
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-lg">
            Please read these Terms and Conditions ("Terms") carefully before
            using the getsafe360.ai website (the "Service") operated by GetSafe
            360 Ltd. ("we", "us", or "our"). These Terms govern your access to
            and use of the Service, including the conditions under which you may
            purchase and receive access to GPLv2-licensed software products.
          </p>
          <ol className="text-base py-4 sm:py-6 lg:py-8">
            <li>
              Acceptance of Terms: By accessing or using the Service, or by
              purchasing or downloading any software product from GetSafe 360,
              you agree to be bound by these Terms, our End-User License
              Agreement ("EULA"), and our Privacy Policy. If you do not agree,
              do not use the Service or access any product.
            </li>
            <li>
              Access Contract for GPL Software: Our products may be licensed
              under the GNU General Public License version 2 ("GPLv2"). Nothing
              in these Terms restricts your rights under the GPLv2 once you have
              lawfully received the software.
            </li>
            <li>
              However, access to GPLv2-licensed software products distributed by
              GetSafe 360, including the Analizer and Optimizer, is gated behind
              a commercial contract. By purchasing access, you are entering into
              a binding agreement that governs:
            </li>
            <li>Who may receive and use the product,</li>
            <li>The business purpose for which it is obtained,</li>
            <li>The scope of acceptable access and deployment,</li>
            <li>Enforcement rights in the event of abuse.</li>
            <li>
              You may only access our software through this Service if you agree
              to the following conditions:
            </li>
            <li>
              You represent that the software will be used only for websites
              that you or your organization directly own and operate.
            </li>
            <li>
              You may not purchase access on behalf of hosting providers,
              clients, customers, or third parties without an enterprise
              agreement.
            </li>
            <li>
              Any use of our access-gated software for mass distribution,
              automated services, or commercial deployment across unrelated
              websites constitutes a breach of this access agreement, regardless
              of GPLv2 rights.
            </li>
            <li>
              Purchases and Distribution Terms: Purchases made via the Service
              form part of this access agreement. GetSafe 360 reserves the right
              to deny, cancel, or revoke any transaction if we suspect that the
              purchase is intended to bypass enterprise-level licensing or
              otherwise violates our access policy.
            </li>
            <li>
              Commercial Use Restriction: Hosting companies, managed service
              providers, digital agencies, and entities offering customer
              migration or deployment services must not use GPLv2-licensed
              software accessed through this Service without a signed enterprise
              agreement. Such entities must contact GetSafe 360 for appropriate
              licensing terms.
            </li>
            <li>
              Monitoring and Enforcement: GetSafe 360 reserves the right to:
            </li>
            <li>Audit usage to verify compliance with access terms,</li>
            <li>
              Revoke access and disable license keys or support where misuse is
              detected,
            </li>
            <li>
              Pursue legal remedies for breach of access terms, including
              damages based on unauthorized usage at commercial scale.
            </li>
            <li>
              Termination: We may terminate or suspend your access at any time
              for breach of these Terms or our access conditions. Termination
              does not affect your rights under the GPLv2 with respect to the
              software you have already received, but it does bar any further
              access to updates, support, or new versions.
            </li>
            <li>
              Indemnification: You agree to indemnify, defend, and hold harmless
              GetSafe 360 from any claim or dispute arising from your misuse of
              software acquired through this Service, or violation of these
              Terms.
            </li>
            <li>
              Limitation of Liability: GetSafe 360 shall not be liable for any
              indirect or consequential damages related to use of the Service.
              Our maximum liability under this agreement shall not exceed the
              amount paid by you for access.
            </li>
            <li>
              Changes to Terms: We may modify these Terms at any time. Continued
              use of the Service constitutes acceptance of any modified Terms.
            </li>
            <li>
              Privacy: Use of our website and services is subject to our Privacy
              Policy, incorporated herein by reference.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
