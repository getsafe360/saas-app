// components/reports/BrandingSettings.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, ImageUp, Loader2, Palette, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { BRANDING_LIMITS, DEFAULT_PRIMARY_COLOR, LOGO_MAX_BYTES } from "@/lib/reports/branding";

interface Branding {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  website: string;
  email: string;
  footerText: string;
}

const EMPTY: Branding = { companyName: "", logoUrl: null, primaryColor: DEFAULT_PRIMARY_COLOR, website: "", email: "", footerText: "" };
const ERRORS = new Set([
  "COMPANY_REQUIRED", "INVALID_LOGO", "LOGO_TOO_LARGE", "INVALID_COLOR", "INVALID_WEBSITE", "INVALID_EMAIL", "TOO_LONG", "RATE_LIMITED", "GENERIC",
]);
const card = { background: "var(--header-bg)", borderColor: "var(--border-default)" } as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Agency branding for white-label reports, with a live preview of the report header and footer. */
export function BrandingSettings({ allowed }: { allowed: boolean }) {
  const t = useTranslations("Reports.branding");
  const tDoc = useTranslations("Reports.document");
  const tNav = useTranslations("DashboardNav");
  const locale = useLocale();
  const [form, setForm] = useState<Branding>(EMPTY);
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState<"load" | "save" | "upload" | "remove" | null>(allowed ? "load" : null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Saving replaces the whole branding, so it stays off until the stored one has loaded
  // (or is known not to exist): a failed load must never be saved over.
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setBusy("load");
    setLoadFailed(false);
    try {
      const response = await fetch("/api/reports/branding", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error("load");
      const b = body.branding;
      if (b) {
        setForm({
          companyName: b.companyName ?? "",
          logoUrl: b.logoUrl ?? null,
          primaryColor: b.primaryColor ?? DEFAULT_PRIMARY_COLOR,
          website: b.website ?? "",
          email: b.email ?? "",
          footerText: b.footerText ?? "",
        });
      }
      setStored(!!b);
      setLoaded(true);
    } catch {
      setLoadFailed(true);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const update = (patch: Partial<Branding>) => {
    setForm((current) => ({ ...current, ...patch }));
    setStatus(null);
    setError(null);
  };
  const fail = (code: unknown) => setError(typeof code === "string" && ERRORS.has(code) ? code : "GENERIC");

  const upload = async (file: File) => {
    if (file.size > LOGO_MAX_BYTES) return fail("LOGO_TOO_LARGE");
    setBusy("upload");
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/reports/branding/logo", { method: "POST", body: data });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) return fail(body?.error);
      update({ logoUrl: body.logoUrl });
    } catch {
      fail("GENERIC");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/reports/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) return fail(body?.error);
      // Show what was stored (e.g. the website with https:// added).
      const b = body.branding;
      setForm({ ...form, website: b.website ?? "", email: b.email ?? "", footerText: b.footerText ?? "", primaryColor: b.primaryColor });
      setStored(true);
      setStatus(t("saved"));
    } catch {
      fail("GENERIC");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    setBusy("remove");
    try {
      const response = await fetch("/api/reports/branding", { method: "DELETE" });
      if (!response.ok) return fail("GENERIC");
      setForm(EMPTY);
      setStored(false);
      setStatus(t("removed"));
    } catch {
      fail("GENERIC");
    } finally {
      setBusy(null);
    }
  };

  const color = HEX.test(form.primaryColor) ? form.primaryColor : DEFAULT_PRIMARY_COLOR;
  const contact = [form.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), form.email].filter(Boolean).join(" · ");
  const input = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50";
  const inputStyle = { ...card, color: "var(--text-primary)" };
  const label = "mb-1 block text-xs font-semibold";
  const hint = "mt-1 text-xs";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/dashboard/settings" className="mb-3 inline-flex items-center gap-1.5 text-xs hover:underline" style={{ color: "var(--text-subtle)" }}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {tNav("settings")}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          <Palette className="h-6 w-6" style={{ color: "var(--color-primary-400, #60a5fa)" }} />
          {t("title")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--text-subtle)" }}>{t("description")}</p>
      </div>

      {!allowed ? (
        <section className="rounded-2xl border p-6" style={card}>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            <Crown className="h-4 w-4 text-amber-400" />
            {t("upgradeTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-subtle)" }}>{t("upgradeText")}</p>
          <Link href="/pricing" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {t("upgradeCta")}
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <section className="space-y-5 rounded-2xl border p-5" style={card} aria-busy={busy === "load"}>
            <div>
              <label htmlFor="brand-company" className={label} style={{ color: "var(--text-primary)" }}>{t("companyName")}</label>
              <input id="brand-company" value={form.companyName} maxLength={BRANDING_LIMITS.companyName} onChange={(e) => update({ companyName: e.target.value })} className={input} style={inputStyle} />
              <p className={hint} style={{ color: "var(--text-subtle)" }}>{t("companyNameHint")}</p>
            </div>

            <div>
              <span className={label} style={{ color: "var(--text-primary)" }}>{t("logo")}</span>
              <div className="flex flex-wrap items-center gap-3">
                {form.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="h-10 max-w-[180px] rounded bg-white object-contain p-1" />
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  id="brand-logo"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                <label
                  htmlFor="brand-logo"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-white/5"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                >
                  {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                  {busy === "upload" ? t("uploading") : form.logoUrl ? t("replaceLogo") : t("uploadLogo")}
                </label>
                {form.logoUrl && (
                  <button type="button" onClick={() => update({ logoUrl: null })} className="text-xs underline" style={{ color: "var(--text-subtle)" }}>
                    {t("removeLogo")}
                  </button>
                )}
              </div>
              <p className={hint} style={{ color: "var(--text-subtle)" }}>{t("logoHint")}</p>
            </div>

            <div>
              <label htmlFor="brand-color" className={label} style={{ color: "var(--text-primary)" }}>{t("color")}</label>
              <div className="flex items-center gap-2">
                <input id="brand-color" type="color" value={color} onChange={(e) => update({ primaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border bg-transparent" style={{ borderColor: "var(--border-default)" }} />
                <input aria-label={t("color")} value={form.primaryColor} maxLength={7} onChange={(e) => update({ primaryColor: e.target.value })} className={`${input} max-w-[8rem] font-mono`} style={inputStyle} />
              </div>
              <p className={hint} style={{ color: "var(--text-subtle)" }}>{t("colorHint")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="brand-website" className={label} style={{ color: "var(--text-primary)" }}>{t("website")}</label>
                <input id="brand-website" value={form.website} maxLength={BRANDING_LIMITS.website} inputMode="url" onChange={(e) => update({ website: e.target.value })} className={input} style={inputStyle} />
              </div>
              <div>
                <label htmlFor="brand-email" className={label} style={{ color: "var(--text-primary)" }}>{t("email")}</label>
                <input id="brand-email" type="email" value={form.email} maxLength={BRANDING_LIMITS.email} onChange={(e) => update({ email: e.target.value })} className={input} style={inputStyle} />
              </div>
              <p className={`${hint} sm:col-span-2 -mt-2`} style={{ color: "var(--text-subtle)" }}>{t("contactHint")}</p>
            </div>

            <div>
              <label htmlFor="brand-footer" className={label} style={{ color: "var(--text-primary)" }}>{t("footerText")}</label>
              <textarea id="brand-footer" rows={2} value={form.footerText} maxLength={BRANDING_LIMITS.footerText} onChange={(e) => update({ footerText: e.target.value })} className={input} style={inputStyle} />
              <p className={hint} style={{ color: "var(--text-subtle)" }}>{t("footerTextHint")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={busy !== null || !loaded}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy === "save" ? t("saving") : t("save")}
              </button>
              {stored && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy !== null || !loaded}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {confirmRemove ? t("removeConfirm") : t("remove")}
                </button>
              )}
            </div>
            {loadFailed && (
              <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 p-2 text-xs text-amber-300">
                {t("errors.LOAD_FAILED")}
                <button type="button" onClick={() => void load()} className="underline">{t("retry")}</button>
              </p>
            )}
            {status && <p role="status" className="text-xs text-emerald-300">{status}</p>}
            {error && <p role="alert" className="rounded-md border border-red-500/40 p-2 text-xs text-red-300">{t(`errors.${error}`)}</p>}
          </section>

          <aside aria-label={t("preview")}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-subtle)" }}>{t("preview")}</div>
            <div className="rounded-xl bg-white p-5 text-[11px] text-gray-800 shadow-lg">
              <div className="flex items-end justify-between pb-2" style={{ borderBottom: `3px solid ${color}` }}>
                <div className="min-w-0">
                  {form.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="" className="mb-1 max-h-8 max-w-[140px] object-contain" />
                  )}
                  <div className="truncate font-semibold">{form.companyName || t("companyName")}</div>
                </div>
              </div>
              <div className="mt-3 text-lg font-bold" style={{ color }}>{t("previewTitle")}</div>
              <div className="font-semibold">{t("previewSite")}</div>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-11/12 rounded bg-gray-200" />
                <div className="h-2 w-9/12 rounded bg-gray-200" />
                <div className="h-2 w-10/12 rounded bg-gray-200" />
              </div>
              <div className="mt-4 border-t border-gray-200 pt-2 text-[10px] text-gray-500">
                <div>{tDoc("footer.method", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date()) })}</div>
                {form.footerText && <div className="mt-1 text-gray-700">{form.footerText}</div>}
                {form.companyName && contact && (
                  <div className="mt-1 font-semibold" style={{ color }}>
                    {form.companyName} · {contact}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
