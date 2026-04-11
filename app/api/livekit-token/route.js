/**
 * GET /api/livekit-token?room={loungeCode}&identity={userId}
 * Enforces 20-person room limit using LiveKit RoomServiceClient.
 */

import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const MAX_PARTICIPANTS = 20

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const room     = searchParams.get('room')?.toUpperCase().trim()
  const identity = searchParams.get('identity')?.trim()

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
  if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  if (user.id !== identity) return NextResponse.json({ error: 'Identity mismatch' }, { status: 403 })

  // ── Verify lounge exists ─────────────────────────────────────────
  const { data: lounge } = await supabase
    .from('study_lounges')
    .select('id, invite_code')
    .eq('invite_code', room)
    .maybeSingle()

  if (!lounge) return NextResponse.json({ error: 'Lounge not found' }, { status: 404 })

  // ── Check env vars ────────────────────────────────────────────────
  const apiKey    = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const lkUrl     = process.env.NEXT_PUBLIC_LIVEKIT_URL

  if (!apiKey || !apiSecret || !lkUrl) {
    console.error('LiveKit env vars missing')
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  // ── Room limit check (20 persons) ─────────────────────────────────
  try {
    // Convert wss:// to https:// for the REST API
    const httpUrl = lkUrl.replace(/^wss?:\/\//, 'https://')
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret)

    const participants = await roomService.listParticipants(room)
    const alreadyIn = participants.some(p => p.identity === identity)

    // Only block if they're not already in the room (rejoin allowed)
    if (!alreadyIn && participants.length >= MAX_PARTICIPANTS) {
      return NextResponse.json(
        { error: `This lounge is full (${MAX_PARTICIPANTS}/${MAX_PARTICIPANTS}). Try again later.` },
        { status: 403 }
      )
    }
  } catch (err) {
    // Room doesn't exist yet in LiveKit (first person joining) — that's fine
    if (!err.message?.includes('room not found') && err.status !== 404) {
      console.warn('[route] RoomService check failed (non-critical):', err.message)
      // Continue — don't block the user if the check itself fails
    }
  }

  // ── Mint token ────────────────────────────────────────────────────
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user.email?.split('@')[0] || identity.slice(0, 8),
    ttl: '4h',
  })

  at.addGrant({
    roomJoin:       true,
    room,                 // must exactly match what client passes
    canPublish:     true,
    canSubscribe:   true,
    canPublishData: true, // required for avatar position sync
  })

  const token = await at.toJwt()
  console.log(`[LiveKit] Token issued: ${identity} → room:${room}`)

  return NextResponse.json({ token, roomName: room })
}