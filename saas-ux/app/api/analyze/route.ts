import { NextRequest, NextResponse } from "next/server";

// Get backend URL from environment, fallback to localhost
const flaskUrl = process.env.NEXT_PUBLIC_FLASK_URL || "http://localhost:5555";

export async function POST(req: NextRequest) {
    try {
        // Optionally: add type for expected request body
        // type AnalyzeBody = { url: string, ... }
        const body = await req.json();

        // POST to Flask backend /analyze endpoint
        const flaskRes = await fetch(`${flaskUrl}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!flaskRes.ok) {
            const errorText = await flaskRes.text();
            // Optionally log to server console for easier debug
            console.error("Flask backend error:", errorText);
            return NextResponse.json(
                { error: `Failed to fetch from Flask backend: ${errorText}` },
                { status: 500 }
            );
        }

        // Ensure Flask returns valid JSON
        const contentType = flaskRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await flaskRes.text();
            console.error("Flask returned non-JSON:", text);
            return NextResponse.json(
                { error: "Flask did not return JSON. Instead got:\n" + text },
                { status: 500 }
            );
        }

        // All good: forward result to client
        const data = await flaskRes.json();
        return NextResponse.json(data);

    } catch (error: any) {
        // Optionally log to server for debugging
        console.error("API route failed:", error);
        return NextResponse.json(
            { error: "API route failed: " + error?.message },
            { status: 500 }
        );
    }
}