import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Try local Python ML inference server (PyTorch GRU)
    try {
      const mlRes = await fetch('http://127.0.0.1:8000/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: body.latitude || 13.0827,
          longitude: body.longitude || 80.2707,
          timestamp: body.timestamp,
          rainfall_mm: body.rainfall_mm,
          citizen_report_count: body.citizen_report_count || 0,
          is_volunteer_verified: Boolean(body.is_volunteer_verified),
          hazard_type: body.hazard_type || 'Flood'
        }),
        signal: AbortSignal.timeout(3000)
      });

      if (mlRes.ok) {
        const mlData = await mlRes.json();
        return NextResponse.json({
          ...mlData,
          engine: 'ml_pytorch_gru',
          status: 'ONLINE'
        });
      } else {
        const errorText = await mlRes.text();
        throw new Error(`ML server returned ${mlRes.status}: ${errorText}`);
      }
    } catch (err: any) {
      console.error('Python ML forecast server unavailable:', err);
      return NextResponse.json(
        { error: 'Forecast unavailable: Model offline or unreachable', details: err.message },
        { status: 503 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Forecast processing failed' }, { status: 500 });
  }
}
