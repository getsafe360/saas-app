// components/analyzer/display/StreamingIntroText.tsx
"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

type Props = {
  locale: string;
};

const INTRO_TEXTS = {
  en: "Nice to meet you! I'm your Co-Pilot, here to help you make your website faster, more secure, and easier to find. Let's discover what we can improve together!",
  de: "Schön, Sie kennenzulernen! Ich bin Ihr Co-Pilot und helfe Ihnen, Ihre Website schneller, sicherer und leichter auffindbar zu machen. Lassen Sie uns gemeinsam entdecken, was wir verbessern können!",
  es: "¡Encantado de conocerte! Soy tu Co-Piloto, aquí para ayudarte a hacer tu sitio web más rápido, más seguro y más fácil de encontrar. ¡Descubramos juntos qué podemos mejorar!",
  fr: "Ravi de vous rencontrer! Je suis votre Co-Pilote, ici pour vous aider à rendre votre site web plus rapide, plus sûr et plus facile à trouver. Découvrons ensemble ce que nous pouvons améliorer !",
  it: "Piacere di conoscerti! Sono il tuo Co-Pilota, qui per aiutarti a rendere il tuo sito web più veloce, più sicuro e più facile da trovare. Scopriamo insieme cosa possiamo migliorare!",
  pt: "Prazer em conhecê-lo! Sou o seu Co-Piloto, aqui para ajudá-lo a tornar o seu website mais rápido, mais seguro e mais fácil de encontrar. Vamos descobrir juntos o que podemos melhorar!",
};

export default function StreamingIntroText({ locale }: Props) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  const text =
    INTRO_TEXTS[locale as keyof typeof INTRO_TEXTS] || INTRO_TEXTS.en;

  useEffect(() => {
    setDisplayedText("");
    setIsComplete(false);

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, 20); // Typing speed

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl border border-neutral-700">
      <div className="mb-6 flex items-center gap-3">
        <div className="relative">
          <Sparkles className="h-12 w-12 text-sky-400" />
          {!isComplete && (
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-sky-400 animate-pulse" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-white">Co-Pilot</h2>
      </div>

      <div className="relative max-w-md">
        <p className="text-lg leading-relaxed text-neutral-300">
          {displayedText}
          {!isComplete && (
            <span className="inline-block w-0.5 h-5 bg-sky-400 ml-1 animate-pulse" />
          )}
        </p>
      </div>

      {isComplete && (
        <div className="mt-8 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Analysis in progress...</span>
          </div>
        </div>
      )}
    </div>
  );
}
