'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLounge } from '@/hooks/useLounge'
import { getLounge } from '@/app/actions/lounge'

import YouTube from 'react-youtube'

import {
  LiveKitRoom, RoomAudioRenderer, useParticipants,
  useLocalParticipant, useIsSpeaking, TrackToggle,
  useTracks, StartAudio,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'

// ── SVG Icons ─────────────────────────────────────────────────────────────
const Ic = {
  mic: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  micOff: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  volume: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  volumeOff: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
  music: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  chat: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  copy: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  exit: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  send: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  edit: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  keyboard: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/></svg>,
  users: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  check: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  alert: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  minimize: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  maximize: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  screen: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  screenStop: (cls='w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  arrowUp: (cls='w-5 h-5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  arrowDown: (cls='w-5 h-5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  arrowLeft: (cls='w-5 h-5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  arrowRight: (cls='w-5 h-5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
}

// ── CSS animations ─────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes avatarWalk {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  25%      { transform: translateY(-3px) rotate(-1deg); }
  75%      { transform: translateY(-3px) rotate(1deg); }
}
@keyframes avatarIdle {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-2px); }
}
@keyframes shadowWalk {
  0%,100% { transform: scaleX(1) translateX(-50%); opacity: 0.35; }
  25%,75%  { transform: scaleX(0.8) translateX(-50%); opacity: 0.2; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }

/* Glowing Header Start Audio Button */
.header-start-audio {
  background: #44bfef !important; color: #fff !important;
  border: 1px solid #0c59bd !important; border-radius: 8px !important;
  padding: 4px 10px !important; font-size: 11px !important; font-weight: 700 !important;
  cursor: pointer !important; animation: pulse-audio 1.5s infinite;
  white-space: nowrap; height: 26px; display: flex; align-items: center;
}
@keyframes pulse-audio {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(239,68,68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68, 0); }
}
`

// ── Speaking visualiser ────────────────────────────────────────────────────
function SpeakingBars({ active }) {
  const heights = [0.45, 0.85, 0.6, 1, 0.7, 0.9, 0.5]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width: 2.5, borderRadius: 2, height: active ? `${h*100}%` : '15%', background: active ? '#4ade80' : '#3f3f46', transition: `height ${0.08+i*0.03}s ease` }} />
      ))}
    </div>
  )
}

// ── Animated Avatar ────────────────────────────────────────────────────────
function Avatar({ x, y, displayName, avatarColor, sprite, isMe=false, size=48, userId, hasVoice, isIdle, isMoving=false }) {
  if (hasVoice) return <VoiceAvatar x={x} y={y} displayName={displayName} avatarColor={avatarColor} sprite={sprite} isMe={isMe} size={size} userId={userId} isIdle={isIdle} isMoving={isMoving} />
  return <BaseAvatar x={x} y={y} displayName={displayName} avatarColor={avatarColor} sprite={sprite} isMe={isMe} size={size} isSpeaking={false} isIdle={isIdle} isMoving={isMoving} />
}

function VoiceAvatar(props) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const participant = props.isMe ? localParticipant : participants.find(p => p.identity === props.userId)
  if (!participant) return <BaseAvatar {...props} isSpeaking={false} />
  return <SpeakingAvatarInner {...props} participant={participant} />
}

function SpeakingAvatarInner({ participant, ...props }) {
  const isSpeaking = useIsSpeaking(participant)
  return <BaseAvatar {...props} isSpeaking={isSpeaking} />
}

function BaseAvatar({ x, y, displayName, avatarColor, sprite, isMe, size, isSpeaking, isIdle, isMoving }) {
  const walkAnim = isMoving ? 'avatarWalk 0.32s ease-in-out infinite' : isIdle ? 'none' : 'avatarIdle 2.5s ease-in-out infinite'

  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, transition: isMe ? 'none' : 'left 0.06s linear, top 0.06s linear', zIndex: isMe ? 10 : 5 }}>
      {isIdle && (
        <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(0,0,0,0.75)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', border: '1px solid rgba(167,139,250,0.2)' }}>
          Idle
        </div>
      )}
      <div style={{ animation: walkAnim, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: size, height: size, background: sprite ? 'transparent' : avatarColor, borderRadius: 8, boxShadow: isSpeaking ? '0 0 0 3px #4ade80, 0 0 14px rgba(74,222,128,0.35)' : isMe ? '0 0 0 2px rgba(99,102,241,0.5)' : 'none', transform: isSpeaking ? 'scale(1.07)' : 'scale(1)', transition: 'box-shadow 0.12s ease, transform 0.12s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isIdle ? 0.45 : 1, overflow: 'hidden', imageRendering: 'pixelated' }}>
          {sprite ? <img src={sprite} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }} /> : <span style={{ fontSize: size*0.35, fontWeight: 700, color: '#fff' }}>{(displayName||'?').slice(0,2).toUpperCase()}</span>}
        </div>
        <div style={{ width: size * 0.65, height: 6, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', marginTop: -3, marginLeft: 'auto', marginRight: 'auto', animation: isMoving ? 'shadowWalk 0.32s ease-in-out infinite' : 'none', transformOrigin: 'center' }} />
      </div>
      <div style={{ position: 'absolute', top: size + 9, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', color: isSpeaking ? '#4ade80' : '#d4d4d8', background: 'rgba(0,0,0,0.82)', borderRadius: 4, padding: '2px 7px', border: `1px solid ${isSpeaking ? 'rgba(74,222,128,0.28)' : 'rgba(255,255,255,0.07)'}` }}>
        {isMe ? `${displayName} (you)` : displayName}
      </div>
    </div>
  )
}

function TypewriterText({ content }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    let i = 0
    const t = setInterval(() => { i += 3; setShown(content.slice(0, i)); if (i >= content.length) clearInterval(t) }, 15)
    return () => clearInterval(t)
  }, [content])
  return <span>{shown}</span>
}

function ScreenShareViewer({ onClose }) {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const screenTrack = tracks[0]

  if (!screenTrack) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#52525b' }}>
      {Ic.screen('w-10 h-10')}
      <span style={{ fontSize: 13 }}>No one is sharing their screen</span>
      <span style={{ fontSize: 11, color: '#3f3f46' }}>Use the screen share button in the voice bar</span>
    </div>
  )

  return (
    <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <video ref={el => { if (el && screenTrack.publication?.track) screenTrack.publication.track.attach(el) }} autoPlay playsInline muted style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)' }}>
        Sharing: {screenTrack.participant?.identity?.slice(0, 12) || 'Unknown'}
      </div>
    </div>
  )
}

function ChatPanel({ presenceList, chatMessages, onSendChat, myUserId, myName, mySprite, onUpdateIdentity }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(myName)
  const [editSprite, setEditSprite] = useState(mySprite || '/sprites/char1.png')
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [chatMessages])

  const uniqueUsers = Array.from(new Map(presenceList.map(u => [u.userId, u])).values())
  const sprites = ['/sprites/char1.png','/sprites/char2.png','/sprites/char3.png','/sprites/char4.png','/sprites/char5.png']

  const panelStyle = { display:'flex', flexDirection:'column', height:'100%', background:'rgba(9,9,11,0.98)', borderLeft:'1px solid rgba(255,255,255,0.06)' }
  const sectionStyle = { padding:'13px 15px', borderBottom:'1px solid rgba(255,255,255,0.06)' }
  const labelStyle = { fontSize:9, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:10, display:'flex', alignItems:'center', gap:5 }

  return (
    <div style={panelStyle}>
      <div style={sectionStyle}>
        <div style={labelStyle}>{Ic.edit('w-3 h-3')} Your identity</div>
        {editing ? (
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            <div style={{ display:'flex', gap:6 }}>
              <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={12} autoFocus style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:12, padding:'6px 10px', borderRadius:8, outline:'none' }} />
              <button onClick={() => { onUpdateIdentity(editName, editSprite); setEditing(false) }} style={{ background:'#4f46e5', border:'none', borderRadius:8, padding:'0 11px', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center' }}>{Ic.check('w-3.5 h-3.5')}</button>
              <button onClick={() => setEditing(false)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'0 9px', cursor:'pointer', color:'#71717a', display:'flex', alignItems:'center' }}>{Ic.x('w-3.5 h-3.5')}</button>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {sprites.map(s => (
                <button key={s} onClick={() => setEditSprite(s)} style={{ flex:1, aspectRatio:'1', background:'rgba(255,255,255,0.05)', border:editSprite===s ? '2px solid #4f46e5' : '2px solid transparent', borderRadius:6, overflow:'hidden', cursor:'pointer', padding:2 }}>
                  <img src={s} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated' }} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:30, height:30, background:'rgba(255,255,255,0.06)', borderRadius:7, overflow:'hidden', flexShrink:0 }}><img src={mySprite||'/sprites/char1.png'} alt="me" style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated' }} /></div>
              <span style={{ fontSize:13, fontWeight:700, color:'#e4e4e7', fontFamily:'monospace' }}>{myName}</span>
            </div>
            <button onClick={() => setEditing(true)} style={{ background:'transparent', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', color:'#52525b', display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600 }}>{Ic.edit('w-3 h-3')} Edit</button>
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>{Ic.users('w-3 h-3')} Online — {uniqueUsers.length} / 20</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {uniqueUsers.map((u, i) => (
            <div key={`${u.userId}-${i}`} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
              <img src={u.sprite||'/sprites/char1.png'} alt="" style={{ width:16, height:16, imageRendering:'pixelated' }} />
              <span style={{ fontSize:11, color:u.userId===myUserId ? '#e4e4e7' : '#71717a', fontFamily:'monospace', fontWeight:u.userId===myUserId ? 700 : 400 }}>{u.displayName}{u.userId===myUserId ? ' (you)' : ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={messagesRef} style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10, scrollbarWidth:'none' }}>
        {chatMessages.length === 0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, opacity:0.25, paddingTop:40 }}>
            {Ic.chat('w-7 h-7')}
            <span style={{ fontSize:11, color:'#71717a', textAlign:'center' }}>No messages yet.<br/>Say something or mention @aguila.</span>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              {msg.userId==='aguila-bot' && msg.sprite && <img src={msg.sprite} style={{ width:13, height:13, imageRendering:'pixelated' }} alt="Aguila" />}
              <span style={{ fontSize:10, fontWeight:700, color:msg.userId==='aguila-bot' ? '#818cf8' : (msg.avatarColor||'#a1a1aa') }}>{msg.displayName}</span>
            </div>
            <div style={{ fontSize:12, color:'#d4d4d8', lineHeight:1.55, background:msg.userId==='aguila-bot' ? 'rgba(79,70,229,0.1)' : 'rgba(255,255,255,0.04)', border:`1px solid ${msg.userId==='aguila-bot' ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)'}`, borderRadius:10, padding:'7px 10px', wordBreak:'break-word', whiteSpace:'pre-wrap' }}>
              {msg.userId==='aguila-bot' ? <TypewriterText content={msg.text} /> : msg.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { onSendChat(draft); setDraft('') } }} style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', gap:7 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message or @aguila..." style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 11px', fontSize:12, color:'#fff', outline:'none' }} onFocus={e => e.target.style.border='1px solid rgba(99,102,241,0.4)'} onBlur={e => e.target.style.border='1px solid rgba(255,255,255,0.08)'} />
        <button type="submit" disabled={!draft.trim()} style={{ background:draft.trim() ? '#4f46e5' : 'rgba(255,255,255,0.05)', border:'none', borderRadius:10, padding:'8px 11px', cursor:draft.trim() ? 'pointer' : 'default', color:draft.trim() ? '#fff' : '#3f3f46', display:'flex', alignItems:'center' }}>{Ic.send('w-3.5 h-3.5')}</button>
      </form>
    </div>
  )
}

function VoiceBar({ onScreenShare, isSharing }) {
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant()
  const participants = useParticipants()
  const isSpeaking = useIsSpeaking(localParticipant)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isPTT, setIsPTT] = useState(false)

  useEffect(() => {
    if (!isPTT || !localParticipant) return
    const onDown = async (e) => {
      if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.repeat) return
      if (e.key.toLowerCase()==='v') await localParticipant.setMicrophoneEnabled(true).catch(()=>{})
    }
    const onUp = async (e) => {
      if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return
      if (e.key.toLowerCase()==='v') await localParticipant.setMicrophoneEnabled(false).catch(()=>{})
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [isPTT, localParticipant])

  const handleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
      onScreenShare(!isScreenShareEnabled)
    } catch (e) { console.warn('Screen share failed:', e) }
  }

  const micActive = isMicrophoneEnabled && !isPTT
  const speakingNow = micActive && isSpeaking
  const btnBase = { display:'flex', alignItems:'center', gap:6, borderRadius:9, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s', flexShrink:0, border:'none' }

  return (
    <div className="hide-scroll" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', height:'100%', gap:6, overflowX:'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <TrackToggle source={Track.Source.Microphone} disabled={isPTT} style={{ ...btnBase, background:micActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border:`1px solid ${micActive ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, color:micActive ? '#4ade80' : '#f87171', opacity:isPTT?0.45:1, cursor:isPTT?'not-allowed':'pointer' }}>
          {micActive ? Ic.mic('w-3.5 h-3.5') : Ic.micOff('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{micActive ? 'Mic on' : 'Muted'}</span>
        </TrackToggle>
        <div style={{ ...btnBase, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', cursor:'default', padding:'4px 8px' }}>
          <SpeakingBars active={speakingNow} />
          <span className="hidden sm:inline" style={{ color:speakingNow ? '#4ade80' : '#3f3f46' }}>{micActive ? (isSpeaking ? 'Speaking' : 'Listening') : 'Mic off'}</span>
        </div>
        <button onClick={() => setIsDeafened(d => !d)} style={{ ...btnBase, background:isDeafened ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isDeafened ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`, color:isDeafened ? '#f87171' : '#a1a1aa' }}>
          {isDeafened ? Ic.volumeOff('w-3.5 h-3.5') : Ic.volume('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{isDeafened ? 'Deafened' : 'Sound on'}</span>
        </button>
        <button onClick={() => setIsPTT(p => !p)} className="hidden sm:flex" style={{ ...btnBase, background:isPTT ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isPTT ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, color:isPTT ? '#818cf8' : '#71717a' }}>
          {Ic.keyboard('w-3.5 h-3.5')}<span>{isPTT ? 'PTT — hold V' : 'Voice act.'}</span>
        </button>
        <button onClick={handleScreenShare} style={{ ...btnBase, background:isScreenShareEnabled ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isScreenShareEnabled ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`, color:isScreenShareEnabled ? '#818cf8' : '#71717a' }}>
          {isScreenShareEnabled ? Ic.screenStop('w-3.5 h-3.5') : Ic.screen('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{isScreenShareEnabled ? 'Stop share' : 'Present'}</span>
        </button>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0, paddingLeft: 16 }}>
        {participants.map(p => (
          <div key={p.identity} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', padding:'4px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:p.isMicrophoneEnabled ? '#22c55e' : '#3f3f46' }} />
            <span style={{ fontSize:10, color:'#a1a1aa', fontWeight:600, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.identity}</span>
            <input type="range" min="0" max="1" step="0.05" defaultValue="1" onChange={(e) => { const trackPub = p.getTrackPublication(Track.Source.Microphone); if (trackPub && trackPub.track) trackPub.track.setVolume(parseFloat(e.target.value)) }} style={{ width:40, height:4, accentColor:'#4f46e5', cursor:'pointer' }} />
          </div>
        ))}
      </div>
      {!isDeafened && <RoomAudioRenderer />}
    </div>
  )
}

function DPadBtn({ icon, dir, setMovement }) {
  return (
    <button
      onPointerDown={() => setMovement(dir, true)} onPointerUp={() => setMovement(dir, false)} onPointerLeave={() => setMovement(dir, false)} onPointerCancel={() => setMovement(dir, false)}
      style={{ background:'rgba(9,9,11,0.88)', border:'1px solid rgba(255,255,255,0.16)', borderRadius:12, height:48, width:48, color:'#e4e4e7', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', touchAction:'none', userSelect:'none', outline: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {icon}
    </button>
  )
}

function MusicWidget({ globalMusic, setGlobalMusic }) {
  const [minimized, setMinimized] = useState(false)
  if (!globalMusic?.url) return null

  const isYT = globalMusic.url.includes('youtube.com') || globalMusic.url.includes('youtu.be')
  const isSpotify = globalMusic.url.includes('spotify.com')

  let embedUrl = globalMusic.url
  if (isYT && !embedUrl.includes('mute=1')) { embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'mute=1&playsinline=1&rel=0' }

  return (
    <div className="music-widget" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background:'rgba(255,255,255,0.04)', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {Ic.music('w-3 h-3')}
          <span style={{ fontSize:10, color:'#71717a', fontWeight:600 }}>Room DJ</span>
          {minimized && <span style={{ fontSize:10, color:'#52525b' }}>— playing</span>}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={() => setMinimized(m => !m)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#52525b', padding:3, display:'flex', borderRadius:4 }}>{minimized ? Ic.maximize('w-3.5 h-3.5') : Ic.minimize('w-3.5 h-3.5')}</button>
          <button onClick={() => setGlobalMusic({ url:'' })} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#52525b', padding:3, display:'flex', borderRadius:4 }}>{Ic.x('w-3.5 h-3.5')}</button>
        </div>
      </div>
      {!minimized && (
        isYT ? (
          <div style={{ pointerEvents:'auto' }}>
            <YouTube 
              videoId={globalMusic.url.includes('videoseries') ? null : globalMusic.url.split('embed/')[1].split('?')[0]}
              opts={{ height:'152', width:'100%', playerVars: { autoplay:1, controls:1, listType: globalMusic.url.includes('videoseries') ? 'playlist' : undefined, list: globalMusic.url.includes('videoseries') ? new URLSearchParams(globalMusic.url.split('?')[1]).get('list') : undefined } }}
              onPlay={(e) => setGlobalMusic({ isPlaying: true, time: e.target.getCurrentTime() })}
              onPause={(e) => setGlobalMusic({ isPlaying: false, time: e.target.getCurrentTime() })}
              onReady={(e) => { if (!globalMusic.isPlaying) e.target.pauseVideo(); e.target.seekTo(globalMusic.time) }}
            />
          </div>
        ) : (
          <iframe src={embedUrl} width="100%" height={isSpotify ? 152 : 160} frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen style={{ display:'block' }} />
        )
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LoungePage() {
  const { code } = useParams()
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [lounge, setLounge] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [showMusicInput, setShowMusicInput] = useState(false)
  const [musicLink, setMusicLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [micPermission, setMicPermission] = useState('unknown')
  const [isSharing, setIsSharing] = useState(false)
  const [showPresent, setShowPresent] = useState(false)

  const scrollViewRef = useRef(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); setMicPermission('granted') })
      .catch(err => { console.warn('Mic permission:', err.name); setMicPermission('denied') })
  }, [])

  useEffect(() => {
    const init = async () => {
      if (!code) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      const loungeResult = await getLounge(code)
      if (!loungeResult.success) { setError(loungeResult.error); setLoading(false); return }
      setLounge(loungeResult.lounge)
      const tokenRes = await fetch(`/api/livekit-token?room=${code}&identity=${session.user.id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (tokenRes.ok) { const { token: lkToken } = await tokenRes.json(); setToken(lkToken) }
      else {
        const body = await tokenRes.json().catch(() => ({}))
        if (body.error?.includes('full')) { setError('This lounge is full (20/20). Try again later.'); setLoading(false); return }
      }
      setLoading(false)
    }
    init()
  }, [code, router])

  const {
    myPosition, otherUsers, presenceList, chatMessages, sendChat,
    ROOM_WIDTH, ROOM_HEIGHT, AVATAR_SIZE, myMeta, updateIdentity, setMovement,
    globalMusic, setGlobalMusic, isMoving,
  } = useLounge({ loungeCode: lounge?.invite_code, user })

  useEffect(() => {
    const el = scrollViewRef.current
    if (!el) return
    const targetX = myPosition.x + AVATAR_SIZE / 2 - el.clientWidth / 2
    const targetY = myPosition.y + AVATAR_SIZE / 2 - el.clientHeight / 2
    el.scrollLeft = Math.max(0, targetX)
    el.scrollTop = Math.max(0, targetY)
  }, [myPosition, AVATAR_SIZE])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) setChatOpen(true)
  }, [])

  const handleCopyCode = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2200) }

  const handleSetMusic = (e) => {
    e.preventDefault()
    let link = musicLink.trim()
    if (!link) return
    if (!link.startsWith('http')) link = 'https://' + link
    try {
      const urlObj = new URL(link)
      let finalUrl = ''
      if (link.includes('youtube.com') || link.includes('youtu.be')) {
        if (link.includes('list=')) {
          const listId = new URLSearchParams(urlObj.search).get('list')
          finalUrl = `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&mute=1&playsinline=1`
        } else {
          const vid = link.includes('youtu.be') ? urlObj.pathname.slice(1) : new URLSearchParams(urlObj.search).get('v')
          if (vid) finalUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&playsinline=1&rel=0`
        }
      } else if (link.includes('spotify.com')) {
        const path = urlObj.pathname
        finalUrl = path.startsWith('/embed/') ? link : `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`
      }
      if (finalUrl) setGlobalMusic({ url: finalUrl, isPlaying: true, time: 0 })
    } catch {}
    setShowMusicInput(false)
    setMusicLink('')
  }

  const [roomOptions] = useState({ 
    audioCaptureDefaults: { 
      autoGainControl: true, 
      echoCancellation: true, 
      noiseSuppression: true 
    },
    publishDefaults: {
      red: true, // 🌟 ADD THIS: Eliminates choppy robot voices on bad wifi!
      audioBitrate: 32000, // High-quality voice bitrate
    }
  })

  if (loading) return (
    <div style={{ height:'100dvh', background:'#09090b', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#52525b', gap:14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width:22, height:22, border:'2px solid #3f3f46', borderTopColor:'#4f46e5', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <span style={{ fontSize:12, fontWeight:600 }}>Connecting...</span>
    </div>
  )

  if (error) return (
    <div style={{ height:'100dvh', background:'#09090b', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, color:'#f87171', fontSize:13, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 20px' }}>{Ic.alert('w-4 h-4')} {error}</div>
      <Link href="/lounge" style={{ color:'#818cf8', fontSize:12, textDecoration:'none' }}>Back to lobby</Link>
    </div>
  )

  const RoomCanvas = (
    <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative', WebkitTapHighlightColor: 'transparent' }}>

      {showPresent && (
        <div style={{ width:'60%', flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', background:'#09090b' }}>
          <div style={{ padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>{Ic.screen('w-4 h-4')}<span style={{ fontSize:11, color:'#a1a1aa', fontWeight:600 }}>Presentation</span></div>
            <button onClick={() => setShowPresent(false)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#52525b', display:'flex' }}>{Ic.x('w-4 h-4')}</button>
          </div>
          <ScreenShareViewer />
        </div>
      )}

      {/* D-Pad moved OUTSIDE the map so it floats properly and never disappears */}
      <div className="mobile-dpad">
        <div /><DPadBtn icon={Ic.arrowUp('w-5 h-5')} dir="w" setMovement={setMovement} /><div />
        <DPadBtn icon={Ic.arrowLeft('w-5 h-5')} dir="a" setMovement={setMovement} />
        <DPadBtn icon={Ic.arrowDown('w-5 h-5')} dir="s" setMovement={setMovement} />
        <DPadBtn icon={Ic.arrowRight('w-5 h-5')} dir="d" setMovement={setMovement} />
      </div>

      <div ref={scrollViewRef} className="hide-scroll" style={{ flex:1, position:'relative', overflow:'auto', background:'#000', cursor:'grab', outline:'none' }}>
        <div style={{ position:'relative', width:ROOM_WIDTH, height:ROOM_HEIGHT, minWidth:ROOM_WIDTH, minHeight:ROOM_HEIGHT, backgroundImage:`url('/pixel-room.png')`, backgroundSize:'100% 100%', imageRendering:'pixelated', overflow:'visible' }}>
          {Object.entries(otherUsers).map(([uid, data]) => (
            <Avatar key={uid} x={data.x} y={data.y} displayName={data.displayName} avatarColor={data.avatarColor} sprite={data.sprite} size={AVATAR_SIZE} userId={uid} hasVoice={!!token} isIdle={data.isIdle} isMoving={data.isMoving||false} />
          ))}
          <Avatar x={myPosition.x} y={myPosition.y} displayName={myMeta.displayName} avatarColor={myMeta.avatarColor} sprite={myMeta.sprite} isMe size={AVATAR_SIZE} userId={myMeta.userId} hasVoice={!!token} isIdle={myMeta.isIdle} isMoving={isMoving} />
        </div>
      </div>

      {chatOpen && (
        <div className="chat-container">
          <ChatPanel presenceList={presenceList} chatMessages={chatMessages} onSendChat={sendChat} myUserId={myMeta.userId} myName={myMeta.displayName} mySprite={myMeta.sprite} onUpdateIdentity={updateIdentity} />
        </div>
      )}

      <MusicWidget globalMusic={globalMusic} setGlobalMusic={setGlobalMusic} />

      {micPermission === 'denied' && (
        <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', zIndex:100, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'7px 14px', display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#f87171', backdropFilter:'blur(10px)', whiteSpace:'nowrap' }}>
          {Ic.micOff('w-3.5 h-3.5')} Microphone access denied — enable in browser settings
        </div>
      )}
    </div>
  )

  const pageContent = (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#09090b', overflow:'hidden', color:'#fff', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <style>{ANIM_CSS + `
        .hide-scroll::-webkit-scrollbar { display:none; }
        .hide-scroll { -ms-overflow-style:none; scrollbar-width:none; }
        .chat-container { width:262px; height:100%; flex-shrink:0; }
        .music-widget { position:absolute; bottom:14px; left:14px; width:290px; background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; z-index:50; }
        .mobile-dpad { display:none !important; }
        @media (max-width:768px) {
          .mobile-dpad { display:grid !important; position:absolute; bottom:20px; left:14px; z-index:50; grid-template-columns:repeat(3,48px); gap:7px; pointer-events:auto; }
          .chat-container { position:absolute; top:0; right:0; width:88%; max-width:310px; height:100%; z-index:40; box-shadow:-4px 0 20px rgba(0,0,0,0.5); }
          .music-widget { left:auto; right:12px; bottom:16px; width:260px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ height:46, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(9,9,11,0.98)', backdropFilter:'blur(12px)', flexShrink:0, zIndex:100, position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Link href="/lounge" style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#52525b', textDecoration:'none', fontWeight:600, padding:'5px 8px', borderRadius:8, border:'1px solid transparent' }} onMouseEnter={e=>{e.currentTarget.style.color='#e4e4e7';e.currentTarget.style.border='1px solid rgba(255,255,255,0.1)'}} onMouseLeave={e=>{e.currentTarget.style.color='#52525b';e.currentTarget.style.border='1px solid transparent'}}>
            {Ic.exit('w-3.5 h-3.5')} <span className="hidden sm:inline">Exit</span>
          </Link>
          <div style={{ width:1, height:16, background:'rgba(255,255,255,0.08)' }} />
          <span className="hidden sm:inline" style={{ fontSize:12, fontWeight:600, color:'#e4e4e7', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lounge?.name||'Study Lounge'}</span>
          <button onClick={handleCopyCode} style={{ display:'flex', alignItems:'center', gap:5, background:copied ? 'rgba(74,222,128,0.1)' : 'rgba(79,70,229,0.1)', border:`1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(99,102,241,0.25)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:copied ? '#4ade80' : '#818cf8', fontSize:11, fontWeight:700, fontFamily:'monospace', transition:'all 0.2s' }}>
            {copied ? Ic.check('w-3 h-3') : Ic.copy('w-3 h-3')} <span style={{ letterSpacing:'0.08em' }}>{code}</span> {copied && <span style={{ fontSize:10 }}>Copied</span>}
          </button>
        </div>

        {/* Right side buttons - hide-scroll for horizontal scrolling on small screens */}
        <div className="hide-scroll" style={{ display:'flex', alignItems:'center', gap:7, overflowX:'auto' }}>
          {token && roomOptions && <StartAudio label=" Enable Audio" className="header-start-audio" />}

          <button onClick={() => setShowPresent(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:showPresent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${showPresent ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:showPresent ? '#818cf8' : '#71717a', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.screen('w-3.5 h-3.5')} <span className="hidden sm:inline">Present</span>
          </button>

          <button onClick={() => setShowMusicInput(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:showMusicInput ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'#a1a1aa', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.music('w-3.5 h-3.5')} <span className="hidden sm:inline">Music</span>
          </button>

          <button onClick={() => setChatOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:chatOpen ? 'rgba(79,70,229,0.14)' : 'rgba(255,255,255,0.05)', border:`1px solid ${chatOpen ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:chatOpen ? '#818cf8' : '#71717a', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.chat('w-3.5 h-3.5')} Chat
          </button>
        </div>

        {/* Music Form moved OUTSIDE the overflow container so it drops down cleanly! */}
        {showMusicInput && (
          <form onSubmit={handleSetMusic} style={{ position:'absolute', top:48, right:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:12, display:'flex', gap:7, zIndex:200, boxShadow:'0 8px 30px rgba(0,0,0,0.7)' }}>
            <input value={musicLink} onChange={e=>setMusicLink(e.target.value)} placeholder="YouTube or Spotify..." autoFocus style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:8, padding:'7px 11px', fontSize:11, outline:'none', width:'200px', maxWidth:'50vw' }} />
            <button type="submit" style={{ background:'#4f46e5', border:'none', borderRadius:8, padding:'7px 14px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>Set</button>
          </form>
        )}
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
        {RoomCanvas}
        <div style={{ height:48, borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(9,9,11,0.98)', flexShrink:0 }}>
          {token && roomOptions ? (
            <VoiceBar onScreenShare={setIsSharing} isSharing={isSharing} />
          ) : (
            <div style={{ height:'100%', padding:'0 14px', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#3f3f46' }} />
              <span style={{ fontSize:11, color:'#3f3f46', fontWeight:600 }}>Voice offline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return token && roomOptions ? (
    <LiveKitRoom token={token} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL} audio={false} video={false} connect={true} options={roomOptions} style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', position:'relative' }}>
      {pageContent}
    </LiveKitRoom>
  ) : pageContent;
}