import { NextRequest, NextResponse } from "next/server";

// Get backend URL from environment, fallback to localhost
const flaskUrl = process.env.NEXT_PUBLIC_FLASK_URL || "http://localhost:5555";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Call Flask backend dynamically
        const flaskRes = await fetch(`${flaskUrl}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        // Handle network errors
        if (!flaskRes.ok) {
            const errorText = await flaskRes.text();
            return NextResponse.json(
                { error: `Failed to fetch from Flask backend: ${errorText}` },
                { status: 500 }
            );
        }

        // Check for valid JSON response
        const contentType = flaskRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await flaskRes.text();
            return NextResponse.json(
                { error: "Flask did not return JSON. Instead got:\n" + text },
                { status: 500 }
            );
        }

        const data = await flaskRes.json();
        return NextResponse.json(data);

    } catch (error: any) {
        return NextResponse.json(
            { error: "API route failed: " + error?.message },
            { status: 500 }
        );
    }
}