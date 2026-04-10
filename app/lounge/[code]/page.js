'use client'

/**
 * app/lounge/[code]/page.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The main Student Lounge room. Renders:
 *   • A 2D virtual room with WASD-controlled avatar
 *   • Other users' avatars synced in real-time via Supabase Broadcast
 *   • A chat sidebar powered by Supabase Broadcast
 *   • A voice chat bar powered by LiveKit
 *
 * The Supabase Realtime logic lives in hooks/useLounge.js — see that file
 * for a full explanation of the Presence vs Broadcast architecture.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLounge } from '@/hooks/useLounge'
import { getLounge } from '@/app/actions/lounge'

// LiveKit imports
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  TrackToggle,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'


// ── Sub-components ─────────────────────────────────────────────────────────

/**
 * Avatar — renders a single avatar circle with name tag.
 * Used for both "my" avatar and all "other" avatars.
 */
function Avatar({ x, y, displayName, avatarColor, isMe = false, size = 48 }) {
  const initials = (displayName || '?').slice(0, 2).toUpperCase()
  return (
    <div
      style={{
        position:   'absolute',
        left:       x,
        top:        y,
        width:      size,
        height:     size,
        transition: isMe ? 'none' : 'left 0.06s linear, top 0.06s linear',
      }}
    >
      {/* Circle */}
      <div
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          background:   avatarColor,
          border:       isMe ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.25)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     size * 0.33,
          fontWeight:   600,
          color:        '#fff',
          userSelect:   'none',
          boxShadow:    isMe
            ? `0 0 0 3px ${avatarColor}55, 0 4px 12px rgba(0,0,0,0.5)`
            : '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        {initials}
      </div>
      {/* Name tag */}
      <div style={{
        position:   'absolute',
        top:        size + 4,
        left:       '50%',
        transform:  'translateX(-50%)',
        fontSize:   10,
        fontWeight: 600,
        color:      '#fff',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: 4,
        padding:    '1px 5px',
        whiteSpace: 'nowrap',
        maxWidth:   80,
        overflow:   'hidden',
        textOverflow: 'ellipsis',
      }}>
        {isMe ? `${displayName} (you)` : displayName}
      </div>
    </div>
  )
}

/**
 * ChatPanel — scrollable sidebar with user list + messages + input.
 */
function ChatPanel({ presenceList, chatMessages, onSendChat, myUserId, code }) {
  const [draft,     setDraft]     = useState('')
  const messagesRef               = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatMessages])

  const submit = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    onSendChat(draft)
    setDraft('')
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      background:    'rgba(10,10,10,0.95)',
      borderLeft:    '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Online · {presenceList.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {presenceList.map(u => (
            <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: u.avatarColor, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: u.userId === myUserId ? '#fff' : '#a1a1aa', fontWeight: u.userId === myUserId ? 600 : 400 }}>
                {u.displayName}{u.userId === myUserId ? ' (you)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite code pill */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: 10, color: '#52525b', marginBottom: 3 }}>Invite code</div>
        <div style={{
          fontSize: 16, fontFamily: 'monospace', fontWeight: 700,
          color: '#818cf8', letterSpacing: '0.25em', background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6,
          padding: '3px 8px', display: 'inline-block',
        }}>
          {code}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {chatMessages.length === 0 && (
          <p style={{ fontSize: 11, color: '#3f3f46', textAlign: 'center', marginTop: 20 }}>
            No messages yet. Say hello!
          </p>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: msg.avatarColor, fontWeight: 600 }}>
              {msg.userId === myUserId ? 'You' : msg.displayName}
            </span>
            <span style={{
              fontSize: 12, color: '#d4d4d8', lineHeight: 1.5,
              background: 'rgba(255,255,255,0.04)', borderRadius: 8,
              padding: '5px 9px', alignSelf: 'flex-start', maxWidth: '100%',
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={submit} style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Message..."
          maxLength={300}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#fff',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
          onBlur={e => e.target.style.borderColor  = 'rgba(255,255,255,0.1)'}
        />
        <button type="submit" disabled={!draft.trim()} style={{
          background: '#4f46e5', border: 'none', borderRadius: 8,
          padding: '7px 10px', cursor: 'pointer', color: '#fff', fontSize: 12,
          opacity: draft.trim() ? 1 : 0.4, transition: 'opacity 0.15s',
        }}>
          Send
        </button>
      </form>
    </div>
  )
}

/**
 * VoiceBar — minimal mute toggle + participant list.
 * Must be rendered INSIDE a <LiveKitRoom> tree.
 */
function VoiceBar() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const participants = useParticipants()

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        12,
      padding:    '0 16px',
      height:     '100%',
      background: 'transparent',
    }}>
      {/* Mic toggle */}
      <TrackToggle
        source={Track.Source.Microphone}
        style={{
          background:   isMicrophoneEnabled ? 'rgba(99,102,241,0.15)' : 'rgba(239,68,68,0.15)',
          border:       `1px solid ${isMicrophoneEnabled ? 'rgba(99,102,241,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: 8,
          padding:      '5px 10px',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          fontSize:     11,
          color:        isMicrophoneEnabled ? '#818cf8' : '#f87171',
          fontWeight:   600,
        }}
      >
        {isMicrophoneEnabled ? '🎤 Mic on' : '🔇 Muted'}
      </TrackToggle>

      {/* Participant dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {participants.map(p => (
          <div key={p.identity} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: p.isMicrophoneEnabled ? '#22c55e' : '#3f3f46',
            title: p.identity,
          }} />
        ))}
        <span style={{ fontSize: 10, color: '#52525b' }}>
          {participants.length} in voice
        </span>
      </div>

      {/* Renders other participants' audio tracks to the speakers */}
      <RoomAudioRenderer />
    </div>
  )
}


// ── Main page ───────────────────────────────────────────────────────────────

export default function LoungePage() {
  const { code }               = useParams()
  const router                 = useRouter()
  const [user,    setUser]     = useState(null)
  const [lounge,  setLounge]   = useState(null)
  const [token,   setToken]    = useState(null)    // LiveKit JWT
  const [loading, setLoading]  = useState(true)
  const [error,   setError]    = useState('')
  const [chatOpen, setChatOpen] = useState(true)   // mobile toggle

  // ── Auth + lounge fetch ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // 🌟 NEW: Wait for Next.js to parse the URL before doing anything!
      if (!code) return;

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      const loungeResult = await getLounge(code)
      if (!loungeResult.success) { setError(loungeResult.error); setLoading(false); return }
      setLounge(loungeResult.lounge)

      // Fetch LiveKit token (pass Supabase JWT for server-side auth)
      const tokenRes = await fetch(
        `/api/livekit-token?room=${code}&identity=${session.user.id}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (tokenRes.ok) {
        const { token: lkToken } = await tokenRes.json()
        setToken(lkToken)
      }
      setLoading(false)
    }
    
    init()
  }, [code]) // <-- Make sure 'code' is in this dependency array!

  // ── Multiplayer engine ────────────────────────────────────────
  const {
    myPosition,
    otherUsers,
    presenceList,
    chatMessages,
    sendChat,
    isConnected,
    ROOM_WIDTH,
    ROOM_HEIGHT,
    AVATAR_SIZE,
    myMeta,
  } = useLounge({ loungeCode: lounge?.invite_code, user })

  // ── Loading / error states ────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500 text-sm">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-indigo-500 rounded-full animate-spin" />
        Connecting to lounge...
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/lounge" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
          ← Back to lobby
        </Link>
      </div>
    </div>
  )

  const TOOLBAR_H  = 44  // top toolbar height
  const VOICEBAR_H = 44  // bottom voice bar height
  const CHAT_W     = 260 // right chat panel width

  return (
    <div style={{
      height:         '100dvh',
      display:        'flex',
      flexDirection:  'column',
      background:     '#09090b',
      overflow:       'hidden',
      fontFamily:     'var(--font-geist-sans, system-ui, sans-serif)',
      color:          '#fff',
    }}>

      {/* ── Top toolbar ───────────────────────────────────────── */}
      <div style={{
        height:         TOOLBAR_H,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 14px',
        borderBottom:   '1px solid rgba(255,255,255,0.07)',
        flexShrink:     0,
        background:     'rgba(10,10,12,0.95)',
        backdropFilter: 'blur(8px)',
        zIndex:         20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/lounge" style={{ fontSize: 12, color: '#71717a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            ← Exit
          </Link>
          <span style={{ color: '#27272a', fontSize: 12 }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            {lounge?.name || 'Study Lounge'}
          </span>
          {/* Connection indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 6, padding: '2px 7px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#22c55e' : '#ef4444' }} />
            <span style={{ fontSize: 10, color: isConnected ? '#4ade80' : '#f87171', fontWeight: 600 }}>
              {isConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: '#52525b' }}>WASD or arrow keys to move</span>
          {/* Chat toggle on mobile */}
          <button
            onClick={() => setChatOpen(v => !v)}
            style={{
              background: chatOpen ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${chatOpen ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
              fontSize: 11, color: chatOpen ? '#818cf8' : '#71717a', fontWeight: 600,
            }}
          >
            Chat
          </button>
        </div>
      </div>

      {/* ── Middle: room + chat sidebar ───────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Virtual Room ──────────────────────────────────── */}
        <div style={{
          flex:     1,
          position: 'relative',
          overflow: 'auto',
          cursor:   'crosshair',
        }}>
          {/* The room canvas — fixed virtual size, scrollable on small screens */}
          <div style={{
            position:   'relative',
            width:      ROOM_WIDTH,
            height:     ROOM_HEIGHT,
            minWidth:   ROOM_WIDTH,
            background: '#111113',
            // Subtle grid for spatial orientation
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}>

            {/* Decorative room furniture (pure CSS) */}
            <RoomDecor />

            {/* Other users' avatars */}
            {Object.entries(otherUsers).map(([uid, data]) => {
              if (data.x === undefined || data.y === undefined) return null
              return (
                <Avatar
                  key={uid}
                  x={data.x}
                  y={data.y}
                  displayName={data.displayName || uid.slice(0, 6)}
                  avatarColor={data.avatarColor || '#6366f1'}
                  size={AVATAR_SIZE}
                />
              )
            })}

            {/* My avatar */}
            <Avatar
              x={myPosition.x}
              y={myPosition.y}
              displayName={myMeta.displayName}
              avatarColor={myMeta.avatarColor}
              isMe
              size={AVATAR_SIZE}
            />
          </div>
        </div>

        {/* ── Chat sidebar ──────────────────────────────────── */}
        {chatOpen && (
          <div style={{ width: CHAT_W, flexShrink: 0, height: '100%' }}>
            <ChatPanel
              presenceList={presenceList}
              chatMessages={chatMessages}
              onSendChat={sendChat}
              myUserId={myMeta.userId}
              code={code}
            />
          </div>
        )}
      </div>

      {/* ── Bottom voice bar ──────────────────────────────────── */}
      <div style={{
        height:       VOICEBAR_H,
        flexShrink:   0,
        borderTop:    '1px solid rgba(255,255,255,0.07)',
        background:   'rgba(10,10,12,0.95)',
        backdropFilter: 'blur(8px)',
        display:      'flex',
        alignItems:   'center',
      }}>
        {token ? (
          /**
           * <LiveKitRoom> connects to the LiveKit server using the JWT token
           * minted by /api/livekit-token. It provides context for all
           * @livekit/components-react hooks used inside <VoiceBar>.
           *
           * audio={true}   — automatically subscribes to other participants' audio
           * connect={true} — connect immediately on mount
           */
          <LiveKitRoom
            token={token}
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
            audio={true}
            connect={true}
            style={{ width: '100%', height: '100%' }}
          >
            <VoiceBar />
          </LiveKitRoom>
        ) : (
          <div style={{ padding: '0 16px', fontSize: 11, color: '#3f3f46', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3f3f46' }} />
            Voice chat unavailable — check LIVEKIT_* environment variables
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * RoomDecor — purely decorative furniture drawn with CSS divs.
 * Gives the room a cozy study lounge feel without any images.
 */
function RoomDecor() {
  const shelf = (x, y, w = 180) => (
    <div key={`${x}-${y}`} style={{
      position: 'absolute', left: x, top: y,
      width: w, height: 14, borderRadius: 4,
      background: 'rgba(120,72,30,0.25)',
      border: '1px solid rgba(120,72,30,0.3)',
      display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px',
    }}>
      {/* Book spines */}
      {Array.from({ length: Math.floor(w / 14) }).map((_, i) => (
        <div key={i} style={{
          width: 8, height: '100%', flexShrink: 0,
          background: ['#312e81','#1e3a5f','#3d1a00','#14532d','#4a1942'][i % 5],
          opacity: 0.6, borderRadius: 1,
        }} />
      ))}
    </div>
  )

  const table = (x, y, w = 200, h = 80, label = '') => (
    <div key={`t-${x}-${y}`} style={{
      position: 'absolute', left: x, top: y,
      width: w, height: h, borderRadius: 10,
      background: 'rgba(60,40,15,0.2)',
      border: '1px solid rgba(120,72,30,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {label && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>}
    </div>
  )

  const plant = (x, y) => (
    <div key={`p-${x}-${y}`} style={{ position: 'absolute', left: x, top: y }}>
      <div style={{ width: 20, height: 24, background: 'rgba(21,128,61,0.3)', borderRadius: '50% 50% 40% 40%', border: '1px solid rgba(21,128,61,0.3)' }} />
      <div style={{ width: 14, height: 10, background: 'rgba(120,53,15,0.3)', borderRadius: '2px 2px 4px 4px', margin: '0 auto', border: '1px solid rgba(120,53,15,0.2)' }} />
    </div>
  )

  return (
    <>
      {/* Bookshelves along top wall */}
      {shelf(40,  30, 200)}
      {shelf(280, 30, 220)}
      {shelf(560, 30, 180)}
      {shelf(800, 30, 200)}
      {shelf(1060, 30, 120)}

      {/* Study tables in the room */}
      {table(80,  200, 220, 90, 'Study table')}
      {table(400, 160, 260, 100, 'Group table')}
      {table(780, 220, 200, 80, 'Study table')}
      {table(80,  460, 180, 80, 'Table')}
      {table(700, 460, 180, 80, 'Table')}
      {table(940, 380, 200, 100, 'Group table')}

      {/* Plants in corners */}
      {plant(30, 620)}
      {plant(1145, 620)}
      {plant(30, 110)}
      {plant(1145, 110)}
    </>
  )
}