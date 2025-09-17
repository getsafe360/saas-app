// app/[locale]/(dashboard)/dashboard/layout.tsx  (CLIENT component)
'use client';

import { useState } from 'react';
import {Link} from '@/navigation';
import { usePathname } from 'next/navigation';
import { Settings, Shield, Activity, Menu, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { UserGreeting } from "@/components/ui/user-greeting";
export const experimental_ppr = true;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const t = useTranslations('DashboardNav');
  const { user } = useUser();

  const navItems = [
    { href: '/dashboard/sites',    icon: Globe,    label: 'websites' },
    { href: '/dashboard/activity', icon: Activity, label: 'activity' },
    { href: '/dashboard/security', icon: Shield,   label: 'security' },
    { href: '/dashboard/settings', icon: Settings, label: 'settings' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full">
      {/* Mobile header (no navItems loop here!) */}
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">Dashboard</span>
        <Button
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden h-full">
        {/* Sidebar */}
        <aside
          className={`w-64 border-r border-gray-200 dark:border-gray-800
            lg:block ${isSidebarOpen ? 'block' : 'hidden'}
            lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
            lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* User info / branding */}
          <div className="flex items-center gap-3 mb-6 px-2 pt-3">
           <UserGreeting />
          </div>
          {/* Navigation items */}
          <nav className="h-full overflow-y-auto p-2">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} passHref>
                <Button
                  variant="ghost"
                  className={`
                    shadow-none my-1 w-full justify-start gap-3 rounded-xl transition
                    border
                    ${pathname === item.href
                      ? 'border-[--thin-border] border-blue-500 dark:border-blue-400 font-bold text-blue-700 dark:text-blue-200 bg-white dark:bg-gray-950'
                      : 'border-transparent text-gray-700 dark:text-gray-300'
                    }
                  `}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{t(item.label)}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-0 lg:p-6 bg-gray-50 dark:bg-[#10131a] min-h-screen transition-colors">
          {children}
        </main>
      </div>
    </div>
  );
}
