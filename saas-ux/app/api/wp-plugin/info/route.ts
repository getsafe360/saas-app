import { NextResponse } from 'next/server';

// Update channel of the old "GetSafe360 Connector" (folder getsafe360-connector),
// versions up to 1.10.0, which asked this route for updates.
// From 1.11.0 the plugin is "GetSafe 360 AI" in the folder getsafe-360-ai and
// updates come from WordPress.org. WordPress cannot move a plugin to a new
// folder through an update, so this channel is closed: the old updater only
// offers an update on a 200 response, so every legacy version stays as it is,
// and owners install the new plugin once (settings carry over).
export async function GET() {
    return NextResponse.json(
        {
            error: 'GetSafe360 Connector is now GetSafe 360 AI on WordPress.org. Install it from there and delete the old plugin; your connection is kept.',
            replacement: 'https://wordpress.org/plugins/getsafe-360-ai/',
        },
        { status: 410 }
    );
}
