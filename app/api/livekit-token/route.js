import { AccessToken } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const room     = searchParams.get('room')?.toUpperCase().trim()
  const identity = searchParams.get('identity')?.trim()

  // ── Validate inputs ──────────────────────────────────────────────
  if (!room || !identity) {
    return NextResponse.json({ error: 'room and identity are required' }, { status: 400 })
  }

  // ── Auth check ───────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
  }

  const jwt = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session token' }, { status: 401 })
  }
  if (user.id !== identity) {
    return NextResponse.json({ error: 'Identity mismatch' }, { status: 403 })
  }

  // ── Verify lounge exists ─────────────────────────────────────────
  const { data: lounge, error: loungeError } = await supabase
    .from('study_lounges')
    .select('id, invite_code')
    .eq('invite_code', room)
    .maybeSingle()

  if (loungeError || !lounge) {
    return NextResponse.json({ error: `Lounge "${room}" not found` }, { status: 404 })
  }

  // ── Env check ────────────────────────────────────────────────────
  const apiKey    = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    console.error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set')
    return NextResponse.json({ error: 'LiveKit server credentials not configured' }, { status: 500 })
  }

  // ── Mint token ───────────────────────────────────────────────────
  // IMPORTANT: the room value in the grant must be EXACTLY what
  // the client passes to <LiveKitRoom serverUrl={} token={} />
  const roomName = lounge.invite_code  // e.g. "55PHTT"

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user.email?.split('@')[0] || identity.slice(0, 8),
    ttl: '4h',
  })

  at.addGrant({
    roomJoin:       true,
    room:           roomName,   // ← must match exactly what client uses
    canPublish:     true,       // audio + video
    canSubscribe:   true,       // hear others
    canPublishData: true,       // ← MUST be true: avatar position, chat, cursor
  })

  const token = await at.toJwt()

  console.log(`[LiveKit] Minted token for ${identity} → room:${roomName}`)

  return NextResponse.json({
    token,
    roomName,       // echo back so client can confirm
    serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,  // debug only — remove in prod
  })
}