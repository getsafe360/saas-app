// app/api/sites/[id]/backup/check/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sites/[id]/backup/check
 * 
 * Check if backup plugin is installed on WordPress site
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    // TODO: Implement WordPress plugin check
    // This should call the WordPress REST API to check for backup plugin
    // GET https://site.com/wp-json/wp/v2/plugins
    
    // For now, return mock response
    return NextResponse.json({
      installed: false, // Change to true when plugin is detected
      plugin: null,
      message: "Backup plugin not detected. Consider installing UpdraftPlus.",
    });

  } catch (error: any) {
    console.error(`[Backup Check] Error for site ${id}:`, error);
    
    return NextResponse.json(
      {
        installed: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}