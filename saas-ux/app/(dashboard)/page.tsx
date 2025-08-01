import { Button } from '@/components/ui/button';
import { ArrowRight, CreditCard, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Mindmap from '@/components/ui/mindmap';
import { mindMapData } from "@/components/ui/mindmap-data";
import { useTranslations } from 'next-intl';


export default function HomePage() {
   const t = useTranslations('home');
   return (
    <main>
      <section className="py-20">
        <div className="w-full h-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center md:w-full md:mx-auto lg:w-full lg:mx-0">
            <h1 className="text-7xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-white via-blue-300 to-blue-900/80 bg-clip-text text-transparent">
                    {t.rich("title", {
                        span: (chunks: React.ReactNode) => <span className="font-extrabold tracking-tighter">{chunks}</span>
                    })}
                </span>
            </h1>
            <h2 className="text-5xl font-thin tracking-tight sm:text-6xl md:text-5xl mb-4">
                {t.rich("optimize", {
                    span: (chunks) => <span className="font-bold font-blue-500/60 text-white tracking-tight">{chunks}</span>
                })}
            </h2>
              <Mindmap data={mindMapData} />
              <div className="mt-8 sm:max-w-lg sm:mx-auto text-center lg:mx-0">
                <a
                  href="/"
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg rounded-full border border-blue-500/50 rounded-md hover:bg-blue-500/10 hover:border-blue-500/70 transition-colors duration-300"
                  >
                    Get started now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
              </div>
            </div>
        </div>
      </section>
 
      {/* 2-Column Intro */}
      <section className="grid md:grid-cols-2 gap-8 mb-10">
        <div className="dark:bg-[#1f2123] rounded-xl p-5 shadow-xl border border-[--thin-border] border-gray-700 text-lg leading-relaxed">
          {t('intro_left')}
        </div>
        <div className="dark:bg-[#1f2123] rounded-xl p-5 shadow-xl border border-[--thin-border] border-gray-700 text-lg leading-relaxed">
          {t('intro_right')}
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-2 gap-8 mb-10 py-16 border-t dark:border-[#1b2430]">
                <div className="dark:bg-[#1f2123] rounded-xl p-5 shadow-xl border border-[--thin-border] border-gray-700 text-lg leading-relaxed">
            <h2 className="text-4xl font-bold dark:text-slate-300 sm:text-6xl">
                Ready to optimize your Websites?
            </h2>
                 <Button
                  size="lg"
                  variant="outline"
                  className="text-lg rounded-full"
                >
                  Get started for FREE now
                  <ArrowRight className="ml-3 h-6 w-6" />
                </Button>
            </div>
              <div className="dark:bg-[#1f2123] rounded-xl p-5 shadow-xl border border-[--thin-border] border-gray-700 text-lg leading-relaxed">
              <p className="mt-3 text-base sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                {t.rich("details", {
                    b: (chunks) => <span className="font-semibold text-sky-500 dark:text-yellow-600">{chunks}</span>
                })}
              </p>
              <p className="mt-3 text-base sm:mt-5 sm:text-lg lg:text-base xl:text-lg">
                {t('description')}
              </p>
              
              </div>
      </section>
    </main>
  );
}
