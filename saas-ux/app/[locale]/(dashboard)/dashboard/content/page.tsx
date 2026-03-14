import { FileText } from "lucide-react";

export default function ContentPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div
        className="rounded-2xl border bg-white/60 p-6 dark:bg-white/[0.03]"
        style={{ borderColor: "oklch(from var(--category-content) l c h / 0.35)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: "oklch(from var(--category-content) l c h / 0.16)",
              color: "var(--category-content)",
            }}
          >
            <FileText className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Content
          </h1>
        </div>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          Content optimization insights will appear here.
        </p>
      </div>
    </section>
  );
}
