/**
 * GET /api/livekit-token?room={loungeCode}&identity={userId}
 *
 * Issues a short-lived LiveKit access token for the given room + user.
 * Called client-side by the <LiveKitRoom> component before connecting.
 *
 * Required env vars:
 *   LIVEKIT_URL         — wss://your-project.livekit.cloud
 *   LIVEKIT_API_KEY     — starts with "API..."
 *   LIVEKIT_API_SECRET  — your signing secret
 */

import { AccessToken } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const room     = searchParams.get('room')
  const identity = searchParams.get('identity')

  if (!room || !identity) {
    return NextResponse.json({ error: 'room and identity are required' }, { status: 400 })
  }

  // ── Auth check: verify this is a real logged-in user ──────────
  // We read the Authorization header that the client must send with the
  // Supabase access token (set via supabase.auth.getSession()).
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const jwt = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user || user.id !== identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Verify the lounge actually exists ─────────────────────────
  const { data: lounge } = await supabase
    .from('study_lounges')
    .select('id')
    .eq('invite_code', room.toUpperCase())
    .single()
  if (!lounge) {
    return NextResponse.json({ error: 'Lounge not found' }, { status: 404 })
  }

  // ── Mint the token ─────────────────────────────────────────────
  const apiKey    = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    // Token expires in 4 hours — enough for a long study session
    ttl: '4h',
  })

  at.addGrant({
    roomJoin:     true,
    room:         `lounge-${room.toUpperCase()}`, // room name = "lounge-X4K2PQ"
    canPublish:   true,   // user can send their microphone
    canSubscribe: true,   // user can hear others
    canPublishData: false, // we use Supabase Broadcast for data, not LiveKit DataChannel
  })

  const token = await at.toJwt()
  return NextResponse.json({ token })
}