"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";

// Define all agent modules
const ALL_AGENTS = [
    { key: "seo", label: "SEO" },
    { key: "performance", label: "Performance" },
    { key: "security", label: "Security" },
    { key: "accessibility", label: "Accessibility" },
    { key: "content", label: "Content" }
];

export default function Optimizer() {
    const { isSignedIn } = useUser();
    const [url, setUrl] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [teaser, setTeaser] = useState<any>(null);

    // Teaser: Show only first card or summary
    function showTeaser(raw: any) {
        if (!raw || !raw.results) return raw;
        const firstKey = raw.selected_modules?.[0] || Object.keys(raw.results)[0];
        const teaserObj: any = {
            ...raw,
            results: { [firstKey]: raw.results[firstKey] },
            teaser: true
        };
        return teaserObj;
    }

    async function analyze(full: boolean = false) {
        setLoading(true);
        setResult(null);
        setTeaser(null);

        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, agents: selected }),
            });
            const data = await res.json();

            if (!full && !isSignedIn) {
                setTeaser(showTeaser(data));
            } else {
                setResult(data);
            }
        } catch (err) {
            setResult({ error: "Failed to analyze. Please try again." });
        }
        setLoading(false);
    }

    return (
    <main className="min-h-screen flex flex-col items-center p-6">
            {/* Analyzer Form */}
            <div className="w-full max-w-2xl bg-neutral-800 rounded-xl p-6 shadow-2xl">
			<h1 className="text-3xl font-bold mt-6 mb-2">
                <span className="bg-gradient-to-r from-sky-500 via-purple-800 to-red-600 bg-clip-text text-transparent">
                    GetSafe360 Website Optimizer
                </span>
            </h1>
                <input
                    type="text"
                    placeholder="Enter URL (e.g. https://example.com)"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="w-full p-2 rounded mb-4 border-white-500 text-white"
                />
                <div className="mb-4 flex flex-wrap gap-4">
                    {ALL_AGENTS.map(a =>
                        <label key={a.key} className="flex items-center gap-1 cursor-pointer text-white">
                            <input
                                type="checkbox"
                                checked={selected.includes(a.key)}
                                onChange={e =>
                                    setSelected(s =>
                                        e.target.checked ? [...s, a.key] : s.filter(x => x !== a.key)
                                    )
                                }
                            /> <span>{a.label}</span>
                        </label>
                    )}
                </div>
                <button
                    className="bg-sky-500 hover:bg-sky-600 font-bold px-6 py-2 rounded w-full mb-2"
                    onClick={() => analyze(isSignedIn)}
                    disabled={loading || !url || selected.length === 0}
                >
                    {loading ? "Analyzing..." : "Analyze"}
                </button>
            </div>

            {/* Card output area */}
            <div className="w-full max-w-4xl mt-8 flex flex-wrap gap-6 justify-center">
                {/* Teaser for non-logged in users */}
                {teaser && teaser.results && teaser.selected_modules && (
                    <>
                        <div className="bg-neutral-800 rounded-xl shadow-xl p-5 min-w-[300px] max-w-[350px] flex flex-col">
                            <h3 className="text-lg font-bold mb-2 text-sky-400">
                                {teaser.selected_modules[0]?.toUpperCase() || "RESULT"}
                            </h3>
                            <pre className="text-xs whitespace-pre-wrap text-neutral-100">
                                {teaser.results[teaser.selected_modules[0]].summary ||
                                    teaser.results[teaser.selected_modules[0]].raw ||
                                    JSON.stringify(teaser.results[teaser.selected_modules[0]], null, 2)}
                            </pre>
                        </div>
                        <div className="bg-purple-900 rounded-xl p-6 mt-8 text-center w-full font-bold text-lg">
                            <div>
							  Please <SignInButton mode="modal">
								<button className="underline text-sky-300">sign in</button>
							  </SignInButton> to see the full results.
                            </div>
                        </div>
                    </>
                )}

                {/* Full results for logged in users */}
                {result && result.results && result.selected_modules && result.selected_modules.map((mod: string) => {
                    const output = result.results[mod];
                    let cardText = "";
                    if (output) {
                        cardText = output.summary || output.raw || output.markdown || JSON.stringify(output, null, 2);
                    }
                    return (
                        <div
                            key={mod}
                            className="bg-neutral-800 rounded-xl shadow-xl p-5 min-w-[300px] max-w-[350px] flex flex-col"
                        >
                            <h3 className="text-lg font-bold mb-2 text-sky-400">{mod.toUpperCase()}</h3>
                            <pre className="text-xs whitespace-pre-wrap text-neutral-100">{cardText}</pre>
                        </div>
                    );
                })}

                {/* Full markdown report */}
                {result && result.markdown_report_file && (
                    <div className="bg-neutral-900 rounded-xl shadow-xl p-5 w-full mt-4">
                        <h3 className="text-lg font-bold mb-2 text-purple-300">Audit Report Saved:</h3>
                        <p className="text-sm">{result.markdown_report_file}</p>
                    </div>
                )}
                {/* Token usage metrics */}
                {result && result.usage_metrics && (
                    <div className="bg-neutral-800 rounded-xl shadow-lg p-5 min-w-[300px]">
                        <h4 className="font-semibold text-green-400">Token Usage</h4>
                        <pre className="text-xs text-neutral-100">{JSON.stringify(result.usage_metrics, null, 2)}</pre>
                    </div>
                )}
                {result && result.error && (
                    <div className="bg-red-700 text-white rounded-xl p-4 mt-6 font-bold">{result.error}</div>
                )}
            </div>
        </main>
    );
}
