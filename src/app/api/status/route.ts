import { NextResponse } from 'next/server';

export async function GET() {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  const hasCloudBrowser = Boolean(process.env.BROWSER_WS_ENDPOINT && process.env.BROWSER_WS_ENDPOINT.startsWith('ws'));

  return NextResponse.json({
    gemini: {
      configured: hasGemini,
      model: 'gemini-2.5-flash',
      status: hasGemini ? 'Active (Gemini 2.5 Flash)' : 'Demo / Heuristic Mode',
    },
    browser: {
      configured: hasCloudBrowser,
      endpointType: hasCloudBrowser ? 'Cloud WebSocket CDP' : 'Local Chrome / Auto-Detection',
      status: hasCloudBrowser ? 'Cloud CDP Connected' : 'Local Dev Chrome Ready',
    },
    vercelReady: true,
  });
}
