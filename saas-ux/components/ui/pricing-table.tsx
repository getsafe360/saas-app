// This components/ui/pricing-table.tsx is part of the SaaS UX project
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/clerk-react";
import { CheckCircle2, ChevronDown } from "lucide-react";
const featureGroups = [
  {
    group: "SEO",
    items: [
      "Auto meta tags & descriptions",
      "OpenGraph & Twitter cards",
      "Sitemap.xml generation",
      "SEO health monitoring",
    ],
  },
  {
    group: "Performance",
    items: [
      "AI image optimization",
      "Instant page load",
      "Advanced caching",
      "Performance analytics",
    ],
  },
  {
    group: "Security",
    items: [
      "Auto SSL certificates",
      "AI-powered threat detection",
      "Rate limiting",
      "Daily security audits",
    ],
  },
  {
    group: "Accessibility",
    items: [
      "WCAG 2.2 compliance",
      "AI accessibility checker",
      "Keyboard nav support",
      "Screen reader optimizations",
    ],
  },
];

const freeFeatures = [
  "Unlimited pages",
  "Basic AI page creation",
  "Basic site analytics",
  "Email support",
];

const agentExtraFeatures = [
  "AI content rewriting",
  "Automated SEO improvements",
  "Real-time security monitoring",
  "Priority email & chat support",
];

export function PricingTable() {
  // For mobile: collapse feature groups if needed
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="max-w-5xl mx-auto py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Free Plan shadow-[0_35px_35px_rgba(0,0,0,0.25)] */}
        <Card className="shadow-xl shadow-green-500/30 dark:bg-[#1f2123] border-[--thin-border] border-green-700 rounded-xl flex flex-col">
          <CardHeader>
            <CardTitle className="text-4xl mb-1">Starter</CardTitle>
            <div className="text-3xl font-bold mb-2">Free</div>
            <div className="text-muted-foreground mb-2">Forever free</div>
          </CardHeader>

            <div className="flex justify-center mt-6">
            <SignUpButton mode="modal">
                <SubmitButton variant="green" />
            </SignUpButton>
            </div>

          <CardContent className="flex-1 flex flex-col gap-2">
            <ul className="mb-6">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="text-green-500 w-5 h-5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <hr className="border-[--thin-border] border-gray-600/60 mb-4" />
            {/* Feature Groups */}
            {featureGroups.map(({ group, items }) => (
              <div key={group} className="mb-2">
                <div className="flex items-center cursor-pointer font-semibold text-base" onClick={() => setOpen(open === group ? null : group)}>
                  <span>{group}</span>
                  <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${open === group ? "rotate-180" : ""}`} />
                </div>
                <ul className={`pl-4 transition-all overflow-hidden ${open === group ? "max-h-40" : "max-h-6"} duration-300`}>
                  {items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-center mt-6">
            <SignUpButton mode="modal">
                <SubmitButton variant="green" />
            </SignUpButton>
            </div>

          </CardContent>
        </Card>

        {/* Agent Plan */}
        <Card className="shadow-xl shadow-blue-500/30 dark:bg-[#1f2123] border-[--thin-border] border-blue-800 rounded-xl flex flex-col relative">
          <span className="absolute -top-4 right-6 bg-blue-800 text-white px-4 py-1 rounded-xl text-xs font-bold shadow">Best Value</span>
          <CardHeader>
            <CardTitle className="text-2xl mb-1">Agent</CardTitle>
            <div className="text-3xl font-bold mb-2">
              $49
              <span className="text-base font-normal text-muted-foreground">/mo</span>
            </div>
            <div className="text-muted-foreground mb-2">
              or <span className="font-semibold">$40/mo</span> billed yearly
            </div>
          </CardHeader>

        <div className="flex justify-center mt-6">
        <SignUpButton mode="modal">
            <SubmitButton variant="blue" />
        </SignUpButton>
        </div>

          <CardContent className="flex-1 flex flex-col gap-2">
            <div className="mb-3 text-base text-muted-foreground">Everything in Free, plus:</div>
            <ul className="mb-4">
              {agentExtraFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="text-blue-600 w-5 h-5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <hr className="border-[--thin-border] border-gray-600/60 mb-4" />
            {/* Feature Groups */}
            {featureGroups.map(({ group, items }) => (
              <div key={group} className="mb-2">
                <div className="flex items-center cursor-pointer font-semibold text-base" onClick={() => setOpen(open === group ? null : group)}>
                  <span>{group}</span>
                  <ChevronDown className={`ml-2 w-4 h-4 transition-transform ${open === group ? "rotate-180" : ""}`} />
                </div>
                <ul className={`pl-4 transition-all overflow-hidden ${open === group ? "max-h-40" : "max-h-6"} duration-300`}>
                  {items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
 
            <div className="flex justify-center mt-6">
            <SignUpButton mode="modal">
                <SubmitButton variant="blue" />
            </SignUpButton>
            </div>
 
          </CardContent>
        </Card>
      </div>
    </section>
  );
}