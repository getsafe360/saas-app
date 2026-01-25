// app/[locale]/(dashboard)/dashboard/components/AccountSummary.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CreditCard, Zap, Crown } from "lucide-react";

interface AccountSummaryProps {
  team: {
    id: number;
    name: string;
    planName: string;
    tokensRemaining: number;
    tokensIncluded: number;
    tokensUsed: number;
    subscriptionStatus: string;
  } | null;
}

export function AccountSummary({ team }: AccountSummaryProps) {
  if (!team) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading account information...
          </p>
        </CardContent>
      </Card>
    );
  }

  const tokensPercentage = Math.round((team.tokensRemaining / team.tokensIncluded) * 100);
  const isFreePlan = team.planName === "free";

  // Get progress bar color based on remaining tokens
  const getProgressColor = () => {
    if (tokensPercentage >= 50) return "bg-green-500";
    if (tokensPercentage >= 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleManageBilling = () => {
    // TODO: Implement Stripe Customer Portal redirect
    console.log("Open Stripe Customer Portal");
  };

  const handleUpgrade = () => {
    // TODO: Navigate to pricing/upgrade page
    window.location.href = "/pricing";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Account Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Info */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Current Plan
            </span>
            <Badge
              className={
                isFreePlan
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-gradient-to-r from-purple-500 to-blue-600 text-white"
              }
            >
              {isFreePlan ? (
                "Free"
              ) : (
                <>
                  <Crown className="w-3 h-3 mr-1" />
                  {team.planName.toUpperCase()}
                </>
              )}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Status: {team.subscriptionStatus}
          </p>
        </div>

        {/* Token Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Zap className="w-4 h-4 text-orange-500" />
              Tokens
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {tokensPercentage}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
              style={{ width: `${tokensPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{team.tokensRemaining.toLocaleString()} remaining</span>
            <span>{team.tokensIncluded.toLocaleString()} total</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {team.tokensUsed.toLocaleString()} tokens used this month
          </p>
        </div>

        {/* Low Token Warning */}
        {tokensPercentage < 20 && (
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-orange-700 dark:text-orange-300">
              ⚠️ Running low on tokens. Consider upgrading your plan to continue using AI features.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {isFreePlan ? (
            <Button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          ) : (
            <Button
              onClick={handleManageBilling}
              variant="outline"
              className="w-full"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Manage Billing
            </Button>
          )}
        </div>

        {/* Plan Features Preview (for Free users) */}
        {isFreePlan && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Upgrade to unlock:
            </p>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>50,000 tokens/month</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Unlimited sites</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Priority support</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Advanced AI features</span>
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
