// This components/ui/pricing-table.tsx is part of the SaaS UX project
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/clerk-react";
import { CheckCircle2, ChevronDown, Mail } from "lucide-react";

const featureGroups = [
  {
    group: "SEO Optimization",
    items: [
      "AI-powered meta tags & descriptions",
      "OpenGraph & Twitter cards",
      "Sitemap.xml generation",
      "SEO health monitoring",
      "Structured data optimization",
    ],
  },
  {
    group: "Performance",
    items: [
      "AI image optimization",
      "Page load optimization",
      "Advanced caching strategies",
      "Performance analytics",
      "Core Web Vitals tracking",
    ],
  },
  {
    group: "Security",
    items: [
      "SSL certificate monitoring",
      "AI-powered threat detection",
      "Vulnerability scanning",
      "Security audits",
      "Real-time alerts",
    ],
  },
  {
    group: "Accessibility",
    items: [
      "WCAG 2.2 compliance checking",
      "AI accessibility scanner",
      "Keyboard navigation testing",
      "Screen reader optimization",
      "Color contrast analysis",
    ],
  },
];

const starterFeatures = [
  "1 website",
  "Basic AI site analysis",
  "Weekly scans",
  "Basic security checks",
  "Email support",
];

const agentFeatures = [
  "Up to 5 websites",
  "Advanced AI optimization",
  "Daily automated scans",
  "WordPress plugin integration",
  "Real-time monitoring",
  "Priority support",
];

const enterpriseFeatures = [
  "Unlimited websites",
  "Custom AI optimization rules",
  "Real-time continuous monitoring",
  "White-label reports",
  "API access",
  "Dedicated account manager",
  "Custom integrations",
  "SLA guarantee",
];

export function PricingTable() {
  // For mobile: collapse feature groups if needed
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="max-w-7xl mx-auto py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Starter Plan - Free */}
        <Card className="shadow-lg shadow-green-500/20 dark:bg-[#1f2123] border-[--thin-border] border-green-700 rounded-xl flex flex-col">
          <CardHeader>
            <CardTitle className="text-3xl mb-2">Starter</CardTitle>
            <div className="text-4xl font-bold mb-2">Free</div>
            <div className="text-muted-foreground text-sm mb-4">
              Perfect for getting started
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            <ul className="mb-6 space-y-3">
              {starterFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="text-green-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <SignUpButton mode="modal">
                <SubmitButton variant="green" className="w-full" />
              </SignUpButton>
            </div>
          </CardContent>
        </Card>

        {/* Agent Plan - $19/€19 */}
        <Card className="shadow-xl shadow-blue-500/30 dark:bg-[#1f2123] border-[--thin-border] border-blue-800 rounded-xl flex flex-col relative transform md:scale-105 z-10">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-1.5 rounded-full text-xs font-bold shadow-lg">
            Most Popular
          </span>
          <CardHeader className="pt-8">
            <CardTitle className="text-3xl mb-2">Agent</CardTitle>
            <div className="mb-3">
              <div className="text-4xl font-bold">
                $19<span className="text-lg font-normal text-muted-foreground">/mo</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                or €19/mo • Save 20% with yearly billing
              </div>
            </div>
            <div className="text-muted-foreground text-sm mb-4">
              For professionals and growing sites
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            <div className="text-sm font-semibold text-muted-foreground mb-3">
              Everything in Starter, plus:
            </div>
            <ul className="mb-6 space-y-3">
              {agentFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="text-blue-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <SignUpButton mode="modal">
                <SubmitButton variant="blue" className="w-full" />
              </SignUpButton>
            </div>
          </CardContent>
        </Card>

        {/* Enterprise Plan - Contact */}
        <Card className="shadow-lg shadow-purple-500/20 dark:bg-[#1f2123] border-[--thin-border] border-purple-700 rounded-xl flex flex-col">
          <CardHeader>
            <CardTitle className="text-3xl mb-2">Enterprise</CardTitle>
            <div className="text-4xl font-bold mb-2">Custom</div>
            <div className="text-muted-foreground text-sm mb-4">
              Tailored for large organizations
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col">
            <div className="text-sm font-semibold text-muted-foreground mb-3">
              Everything in Agent, plus:
            </div>
            <ul className="mb-6 space-y-3">
              {enterpriseFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="text-purple-600 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <a
                href="mailto:sales@getsafe360.ai?subject=Enterprise%20Plan%20Inquiry"
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
              >
                <Mail className="h-5 w-5" />
                Contact Sales
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison Table - Collapsible */}
      <div className="mt-16">
        <h3 className="text-2xl font-bold text-center mb-8">Full Feature Comparison</h3>
        <div className="grid grid-cols-1 gap-6">
          {featureGroups.map(({ group, items }) => (
            <div key={group} className="bg-card dark:bg-[#1f2123] rounded-xl p-6 border border-[--thin-border]">
              <div
                className="flex items-center justify-between cursor-pointer mb-4"
                onClick={() => setOpen(open === group ? null : group)}
              >
                <h4 className="text-xl font-semibold">{group}</h4>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${
                    open === group ? "rotate-180" : ""
                  }`}
                />
              </div>
              <ul
                className={`space-y-2 transition-all overflow-hidden ${
                  open === group ? "max-h-96" : "max-h-0"
                } duration-300`}
              >
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
