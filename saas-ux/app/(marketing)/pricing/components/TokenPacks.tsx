import { TOKEN_PACKS } from "@/config/plans.config";

import {
  MICROCOPY_TOOLTIPS,
  MicrocopyTooltip,
} from "./MicrocopyTooltips";

export default function TokenPacks() {
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-semibold text-white">Token Packs</h2>
        <p className="mt-2 text-neutral-300">
          Buy tokens on demand and keep AI operations moving with no subscription lock-in.
          <MicrocopyTooltip text={MICROCOPY_TOOLTIPS.tokenPackUsage} />
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TOKEN_PACKS.map((pack) => (
          <article
            key={pack.name}
            className="rounded-xl border border-neutral-700 bg-[#1b1b1b] p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg md:p-8"
          >
            <h3 className="text-xl font-semibold text-white">{pack.name}</h3>
            <p className="mt-2 text-3xl font-semibold text-white">{pack.price}</p>

            <a
              href={pack.stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center bg-slate-900 border border-neutral-600 rounded-md px-4 py-2.5 text-base font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:bg-slate-800"
            >
              Buy tokens
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
