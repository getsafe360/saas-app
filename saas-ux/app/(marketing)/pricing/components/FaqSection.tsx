import { PRICING_FAQ } from "@/config/plans.config";

export default function FaqSection() {
  return (
    <section className="mx-auto mt-16 w-full max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 className="text-center text-3xl font-semibold text-white">Pricing & Tokens FAQ</h2>

      <div className="mt-8 space-y-3">
        {PRICING_FAQ.map((item) => (
          <details
            key={item.question}
            className="rounded-xl border border-neutral-700 bg-[#1b1b1b] p-5"
          >
            <summary className="cursor-pointer list-none text-base font-medium text-white">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
