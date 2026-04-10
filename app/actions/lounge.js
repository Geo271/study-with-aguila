'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 6-character alphanumeric invite code.
 * Uses only uppercase letters + digits for readability (no 0/O or 1/I confusion).
 * Example output: "X4K2PQ"
 */
function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars, no ambiguous chars
  const randomBytes = new Uint8Array(length)
  crypto.getRandomValues(randomBytes)
  return Array.from(randomBytes)
    .map(b => chars[b % chars.length])
    .join('')
}

// ── Actions ─────────────────────────────────────────────────────

/**
 * Creates a new Study Lounge for the given host.
 * Retries up to 3 times if there's a rare invite_code collision.
 */
export async function createLounge(userId, name = 'Study Lounge') {
  if (!userId) return { success: false, error: 'Not authenticated.' }

  let attempt = 0
  while (attempt < 3) {
    const invite_code = generateInviteCode()
    const { data, error } = await supabase
      .from('study_lounges')
      .insert([{ invite_code, host_id: userId, name }])
      .select()
      .single()

    if (!error) return { success: true, lounge: data }

    // 23505 = unique_violation — the code already exists, retry with a new one
    if (error.code === '23505') { attempt++; continue }

    // Any other error is a hard failure
    console.error('[createLounge]', error)
    return { success: false, error: error.message }
  }
  return { success: false, error: 'Could not generate a unique code. Please try again.' }
}

/**
 * Validates an invite code and returns the lounge if it exists.
 * This is called when a user enters a code on the lobby screen.
 */
export async function joinLounge(rawCode) {
  if (!rawCode) return { success: false, error: 'No code provided.' }

  // Normalize: strip spaces, uppercase
  const invite_code = rawCode.trim().toUpperCase()
  if (invite_code.length !== 6) {
    return { success: false, error: 'Invite codes are exactly 6 characters.' }
  }

  const { data, error } = await supabase
    .from('study_lounges')
    .select('id, invite_code, host_id, name, created_at')
    .eq('invite_code', invite_code)
    .single()

  if (error || !data) {
    return { success: false, error: 'That code is invalid or the lounge no longer exists.' }
  }

  return { success: true, lounge: data }
}

/**
 * Fetches a single lounge by its invite code.
 * Used by the room page on load to verify the lounge exists
 * before connecting to Realtime.
 */
export async function getLounge(invite_code) {
  // 🌟 NEW: Safety guard! If undefined or not a string, stop immediately.
  if (!invite_code || typeof invite_code !== 'string') {
    return { success: false, error: 'Invalid or missing lounge code.' }
  }

  const { data, error } = await supabase
    .from('study_lounges')
    .select('id, invite_code, host_id, name, created_at')
    .eq('invite_code', invite_code.trim().toUpperCase())
    .single()

  if (error || !data) return { success: false, error: 'Lounge not found.' }
  return { success: true, lounge: data }
}

/**
 * Deletes a lounge. Only the host can do this.
 * When the host leaves, the lounge should be cleaned up.
 */
export async function deleteLounge(loungeId, userId) {
  const { error } = await supabase
    .from('study_lounges')
    .delete()
    .eq('id', loungeId)
    .eq('host_id', userId) // RLS double-check at query level too

  return { success: !error, error: error?.message }
}