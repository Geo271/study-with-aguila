'use client'

/**
 * useLounge — The Multiplayer Realtime Engine
 * ─────────────────────────────────────────────
 * This hook owns the entire Supabase Realtime connection for a lounge.
 * It uses TWO Realtime primitives on the same channel:
 *
 *   1. PRESENCE  — Tracks who is currently connected.
 *                  Each client calls channel.track() with their metadata
 *                  (userId, displayName, avatarColor). Supabase maintains a
 *                  server-side map that syncs to all clients on join/leave.
 *                  Use this for: online user list, avatar color assignments.
 *
 *   2. BROADCAST — Ephemeral, low-latency pub/sub messages.
 *                  Unlike Presence, messages are NOT stored on the server.
 *                  They are sent directly to all channel subscribers.
 *                  Use this for: avatar X/Y positions (high frequency, ~20fps)
 *                  and text chat (event-driven).
 *
 * Why separate them? Presence has ~500ms reconciliation overhead — perfect
 * for join/leave but too slow for 60fps movement. Broadcast has ~50ms
 * latency and no server storage overhead — perfect for positions and chat.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOM_WIDTH   = 1200 // virtual room canvas size in px
const ROOM_HEIGHT  = 680
const AVATAR_SIZE  = 48
const MOVE_SPEED   = 4    // px per animation frame (~60fps = 240px/s)
const BROADCAST_HZ = 20   // position broadcast rate (every 50ms)

// Visually distinct colors for avatar circles
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#10b981', '#3b82f6', '#f97316',
]

function getAvatarColor(userId = '') {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getDisplayName(email = '') {
  return email.split('@')[0].slice(0, 12)
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLounge({ loungeCode, user }) {
  // ── Channel ref ──────────────────────────────────────────────
  const channelRef = useRef(null)

  // ── Movement state (refs for rAF loop, state for React render) ──
  const myPositionRef = useRef({
    x: ROOM_WIDTH  / 2 - AVATAR_SIZE / 2,
    y: ROOM_HEIGHT / 2 - AVATAR_SIZE / 2,
  })
  const keysRef           = useRef({})      // currently held keys
  const animFrameRef      = useRef(null)    // rAF handle
  const broadcastTimerRef = useRef(null)    // throttle timer for position broadcasts

  // ── React state ──────────────────────────────────────────────
  const [myPosition,    setMyPosition]    = useState(myPositionRef.current)
  const [otherUsers,    setOtherUsers]    = useState({})  // { [userId]: { x, y, displayName, avatarColor } }
  const [presenceList,  setPresenceList]  = useState([])  // array of presence metadata objects
  const [chatMessages,  setChatMessages]  = useState([])  // { userId, displayName, text, ts }
  const [isConnected,   setIsConnected]   = useState(false)

  const userId       = user?.id
  const displayName  = getDisplayName(user?.email)
  const avatarColor  = getAvatarColor(userId)

  // ── Broadcast: send my position (throttled to BROADCAST_HZ) ──
  const broadcastPosition = useCallback((x, y) => {
    if (!channelRef.current) return
    if (broadcastTimerRef.current) return // still in throttle window

    // Fire the broadcast immediately, then lock for 1/BROADCAST_HZ seconds
    channelRef.current.send({
      type:    'broadcast',
      event:   'position',
      payload: { userId, x, y },
    })

    broadcastTimerRef.current = setTimeout(() => {
      broadcastTimerRef.current = null
    }, 1000 / BROADCAST_HZ)
  }, [userId])

  // ── Broadcast: send a chat message ────────────────────────────
  const sendChat = useCallback((text) => {
    if (!channelRef.current || !text.trim()) return
    const message = {
      userId,
      displayName,
      avatarColor,
      text: text.trim().slice(0, 300), // cap message length
      ts:   Date.now(),
    }
    // Optimistically add to local state immediately for snappy UX
    setChatMessages(prev => [...prev.slice(-99), message]) // keep last 100

    channelRef.current.send({
      type:    'broadcast',
      event:   'chat',
      payload: message,
    })
  }, [userId, displayName, avatarColor])

  // ── Movement: requestAnimationFrame loop ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.key] = true
      // Prevent page scroll while in the room
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault()
      }
    }
    const handleKeyUp = (e) => { keysRef.current[e.key] = false }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup',   handleKeyUp)

    const loop = () => {
      const keys = keysRef.current
      let { x, y } = myPositionRef.current
      let moved = false

      const maxX = ROOM_WIDTH  - AVATAR_SIZE
      const maxY = ROOM_HEIGHT - AVATAR_SIZE

      if (keys['w'] || keys['W'] || keys['ArrowUp'])    { y = Math.max(0,    y - MOVE_SPEED); moved = true }
      if (keys['s'] || keys['S'] || keys['ArrowDown'])  { y = Math.min(maxY, y + MOVE_SPEED); moved = true }
      if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { x = Math.max(0,    x - MOVE_SPEED); moved = true }
      if (keys['d'] || keys['D'] || keys['ArrowRight']) { x = Math.min(maxX, x + MOVE_SPEED); moved = true }

      if (moved) {
        myPositionRef.current = { x, y }
        setMyPosition({ x, y })
        broadcastPosition(x, y)
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup',   handleKeyUp)
      cancelAnimationFrame(animFrameRef.current)
      clearTimeout(broadcastTimerRef.current)
    }
  }, [broadcastPosition])

  // ── Supabase Realtime: channel setup ─────────────────────────
  useEffect(() => {
    if (!loungeCode || !userId) return

    /**
     * Channel name format: "lounge:{INVITE_CODE}"
     * Every user joining via the same code connects to the same channel.
     *
     * config.broadcast.self = false means we do NOT receive our own
     * broadcast events — we already apply them locally for zero-latency
     * self-movement. Set to true only for debugging.
     *
     * config.presence.key = userId ensures each user has exactly ONE
     * presence entry (reconnects overwrite rather than duplicate).
     */
    const channel = supabase.channel(`lounge:${loungeCode}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence:  { key: userId },
      },
    })

    channelRef.current = channel

    // ── Presence: sync → rebuild online user list ──────────────
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      // presenceState() returns { [presenceKey]: [metadata, ...] }
      const list = Object.values(state).flat()
      setPresenceList(list)

      // Merge into otherUsers so position + metadata stay together
      setOtherUsers(prev => {
        const next = { ...prev }
        list.forEach(u => {
          if (u.userId === userId) return // skip ourselves
          next[u.userId] = {
            ...(next[u.userId] || {}), // keep last known position
            displayName:  u.displayName,
            avatarColor:  u.avatarColor,
          }
        })
        // Remove users who left
        const activeIds = new Set(list.map(u => u.userId))
        Object.keys(next).forEach(id => {
          if (!activeIds.has(id)) delete next[id]
        })
        return next
      })
    })

    // ── Broadcast: receive position updates from other users ───
    channel.on('broadcast', { event: 'position' }, ({ payload }) => {
      if (payload.userId === userId) return // ignore our own (self=false but guard anyway)
      setOtherUsers(prev => ({
        ...prev,
        [payload.userId]: {
          ...(prev[payload.userId] || {}),
          x: payload.x,
          y: payload.y,
        },
      }))
    })

    // ── Broadcast: receive chat messages from other users ──────
    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.userId === userId) return // we already added ours optimistically
      setChatMessages(prev => [...prev.slice(-99), payload])
    })

    // ── Subscribe and track our own presence ──────────────────
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)

        // Track — this is what other users see in presenceState()
        await channel.track({
          userId,
          displayName,
          avatarColor,
          joinedAt: new Date().toISOString(),
        })
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false)
      }
    })

    return () => {
      // Untrack removes us from presence immediately on leave
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
    }
  }, [loungeCode, userId, displayName, avatarColor])

  return {
    // My own position (reactive for rendering)
    myPosition,
    // Other users: { [userId]: { x, y, displayName, avatarColor } }
    otherUsers,
    // Flat list of presence metadata (for sidebar user list)
    presenceList,
    // Chat history
    chatMessages,
    // Call this to send a chat message
    sendChat,
    // Whether the Realtime channel is active
    isConnected,
    // Constants needed for rendering
    ROOM_WIDTH,
    ROOM_HEIGHT,
    AVATAR_SIZE,
    // Avatar helpers for the my-avatar render
    myMeta: { userId, displayName, avatarColor },
  }
}