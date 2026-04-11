'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLounge } from '@/hooks/useLounge'
import { getLounge } from '@/app/actions/lounge'
import { processPDF, uploadChatFile } from '@/app/actions/pdf'

import YouTube from 'react-youtube'
import {
  LiveKitRoom, RoomAudioRenderer, useParticipants,
  useLocalParticipant, useIsSpeaking, TrackToggle,
  useTracks, StartAudio,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'

// ─────────────────────────────────────────────────────────────────────────────
// SVG ICONS
// ─────────────────────────────────────────────────────────────────────────────
const Ic = {
  mic:        (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  micOff:     (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  volume:     (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  volumeOff:  (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>,
  music:      (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  chat:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  copy:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  exit:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  send:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  edit:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  keyboard:   (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/></svg>,
  users:      (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  check:      (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:          (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  alert:      (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  minimize:   (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  maximize2:  (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  screen:     (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  screenStop: (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  paperclip:  (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  smile:      (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  star:       (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  fullscreen: (c='w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  arrowUp:    (c='w-5 h-5') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  arrowDown:  (c='w-5 h-5') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  arrowLeft:  (c='w-5 h-5') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  arrowRight: (c='w-5 h-5') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES + ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes avatarWalk {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  25%      { transform: translateY(-4px) rotate(-1.5deg); }
  75%      { transform: translateY(-4px) rotate(1.5deg); }
}
@keyframes avatarIdle {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-2px); }
}
@keyframes shadowWalk {
  0%,100% { transform:scaleX(1) translateX(-50%); opacity:0.35; }
  25%,75%  { transform:scaleX(0.75) translateX(-50%); opacity:0.18; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
@keyframes floatUp {
  0%   { transform:translateY(0) scale(1); opacity:1; }
  80%  { transform:translateY(-80px) scale(1.4); opacity:0.9; }
  100% { transform:translateY(-120px) scale(1.6); opacity:0; }
}
@keyframes rewardPop {
  0%   { transform:scale(0.5); opacity:0; }
  60%  { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1); opacity:1; }
}
@keyframes xpBounce {
  0%,100% { transform:translateY(0); }
  50%      { transform:translateY(-4px); }
}
.hide-scroll::-webkit-scrollbar { display:none; }
.hide-scroll { -ms-overflow-style:none; scrollbar-width:none; }
.chat-container { width:280px; height:100%; flex-shrink:0; background:#09090b; z-index:300; }
.music-widget { position:absolute; bottom:14px; left:14px; width:290px; background:#18181b; border:1px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; z-index:50; }
.dpad-zone { display:none !important; }
@media (max-width:1024px) {
  .dpad-zone { display:block !important; position:absolute; bottom:20px; left:14px; z-index:60; pointer-events:auto; }
  .chat-container { position:absolute; top:0; right:0; width:88%; max-width:310px; height:100%; z-index:300; box-shadow:-10px 0 30px rgba(121, 67, 67, 0.8); }
  .music-widget { left:auto; right:12px; bottom:16px; width:260px; }
}
.header-start-audio {
  background:#4f46e5 !important; color:#fff !important;
  border:1px solid rgba(99,102,241,0.5) !important; border-radius:8px !important;
  padding:4px 10px !important; font-size:11px !important; font-weight:700 !important;
  cursor:pointer !important; white-space:nowrap; height:30px; display:flex; align-items:center;
}
input[type=range] { -webkit-appearance:none; appearance:none; height:4px; border-radius:2px; background:rgba(255,255,255,0.15); outline:none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#4f46e5; cursor:pointer; }
`

// ─────────────────────────────────────────────────────────────────────────────
// EMOTES CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const EMOTES = ['👏','🔥','💡','😂','😮','🎉','❤️','👀','😤','🤔']

// ─────────────────────────────────────────────────────────────────────────────
// SPEAKING BARS
// ─────────────────────────────────────────────────────────────────────────────
function SpeakingBars({ active }) {
  const heights = [0.45, 0.85, 0.6, 1, 0.7, 0.9, 0.5]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:2, height:16 }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width:2.5, borderRadius:2, height:active ? `${h*100}%` : '15%', background:active ? '#4ade80' : '#3f3f46', transition:`height ${0.08+i*0.03}s ease` }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR (animated walk + emote bubble)
// ─────────────────────────────────────────────────────────────────────────────
function Avatar({ x, y, displayName, avatarColor, sprite, isMe=false, size=48, userId, hasVoice, isIdle, isMoving=false, activeEmote=null }) {
  if (hasVoice) return <VoiceAvatar x={x} y={y} displayName={displayName} avatarColor={avatarColor} sprite={sprite} isMe={isMe} size={size} userId={userId} isIdle={isIdle} isMoving={isMoving} activeEmote={activeEmote} />
  return <BaseAvatar x={x} y={y} displayName={displayName} avatarColor={avatarColor} sprite={sprite} isMe={isMe} size={size} isSpeaking={false} isIdle={isIdle} isMoving={isMoving} activeEmote={activeEmote} />
}

function VoiceAvatar(props) {
  const participants = useParticipants()
  const { localParticipant } = useLocalParticipant()
  const p = props.isMe ? localParticipant : participants.find(p => p.identity === props.userId)
  if (!p) return <BaseAvatar {...props} isSpeaking={false} />
  return <SpeakingAvatarInner {...props} participant={p} />
}

function SpeakingAvatarInner({ participant, ...props }) {
  const isSpeaking = useIsSpeaking(participant)
  return <BaseAvatar {...props} isSpeaking={isSpeaking} />
}

function BaseAvatar({ x, y, displayName, avatarColor, sprite, isMe, size, isSpeaking, isIdle, isMoving, activeEmote }) {
  const walkAnim = isMoving ? 'avatarWalk 0.3s ease-in-out infinite' : isIdle ? 'none' : 'avatarIdle 2.6s ease-in-out infinite'

  return (
    <div style={{ position:'absolute', left:x, top:y, width:size, transition:isMe ? 'none' : 'left 0.06s linear, top 0.06s linear', zIndex:isMe ? 10 : 5 }}>
      {/* Emote bubble — floats up and disappears */}
      {activeEmote && (
        <div style={{ position:'absolute', top:-40, left:'50%', transform:'translateX(-50%)', fontSize:24, animation:'floatUp 2s ease forwards', zIndex:20, pointerEvents:'none' }}>
          {activeEmote}
        </div>
      )}

      {isIdle && (
        <div style={{ position:'absolute', top:-20, left:'50%', transform:'translateX(-50%)', fontSize:9, fontWeight:700, color:'#a78bfa', background:'rgba(0,0,0,0.75)', borderRadius:4, padding:'2px 6px', whiteSpace:'nowrap', border:'1px solid rgba(167,139,250,0.2)' }}>
          Idle
        </div>
      )}

      {/* Walk animation wrapper */}
      <div style={{ animation:walkAnim, display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div style={{
          width:size, height:size,
          background:sprite ? 'transparent' : avatarColor,
          borderRadius:8,
          boxShadow:isSpeaking ? '0 0 0 3px #4ade80, 0 0 14px rgba(74,222,128,0.35)' : isMe ? '0 0 0 2px rgba(99,102,241,0.5)' : 'none',
          transform:isSpeaking ? 'scale(1.07)' : 'scale(1)',
          transition:'box-shadow 0.12s ease, transform 0.12s ease',
          display:'flex', alignItems:'center', justifyContent:'center',
          opacity:isIdle ? 0.45 : 1, overflow:'hidden', imageRendering:'pixelated',
        }}>
          {sprite
            ? <img src={sprite} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated' }} />
            : <span style={{ fontSize:size*0.35, fontWeight:700, color:'#fff' }}>{(displayName||'?').slice(0,2).toUpperCase()}</span>}
        </div>
        {/* Ground shadow */}
        <div style={{ width:size*0.6, height:5, borderRadius:'50%', background:'rgba(0,0,0,0.35)', marginTop:-2, animation:isMoving ? 'shadowWalk 0.3s ease-in-out infinite' : 'none', transformOrigin:'50% center' }} />
      </div>

      {/* Name tag */}
      <div style={{
        position:'absolute', top:size+10, left:'50%', transform:'translateX(-50%)',
        fontSize:9, fontWeight:700, whiteSpace:'nowrap',
        color:isSpeaking ? '#4ade80' : '#d4d4d8',
        background:'rgba(0,0,0,0.82)', borderRadius:4, padding:'2px 7px',
        border:`1px solid ${isSpeaking ? 'rgba(74,222,128,0.28)' : 'rgba(255,255,255,0.07)'}`,
      }}>
        {isMe ? `${displayName} (you)` : displayName}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPEWRITER
// ─────────────────────────────────────────────────────────────────────────────
function TypewriterText({ content }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    let i = 0
    const t = setInterval(() => { i += 3; setShown(content.slice(0, i)); if (i >= content.length) clearInterval(t) }, 15)
    return () => clearInterval(t)
  }, [content])
  return <span>{shown}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN SHARE — TRUE FULLSCREEN OVERLAY
// Bug fix: was inside a flex panel. Now it's a fixed full-viewport overlay.
// ─────────────────────────────────────────────────────────────────────────────
function ScreenShareOverlay({ onClose }) {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const screenTrack = tracks[0]
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && screenTrack?.publication?.track) {
      screenTrack.publication.track.attach(videoRef.current)
      return () => screenTrack.publication.track.detach(videoRef.current)
    }
  }, [screenTrack])

  const sharerName = screenTrack?.participant?.identity?.slice(0, 20) || null

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:999,
      background:'rgba(0,0,0,0.97)',
      display:'flex', flexDirection:'column',
      animation:'fadeIn 0.18s ease',
    }}>
      {/* Top bar */}
      <div style={{ height:48, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'spin 2s linear infinite' }} />
          <span style={{ fontSize:13, fontWeight:700, color:'#e4e4e7' }}>
            {sharerName ? `${sharerName} is presenting` : 'Presentation'}
          </span>
        </div>
        <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'6px 14px', cursor:'pointer', color:'#f87171', fontSize:12, fontWeight:700 }}>
          {Ic.x('w-3.5 h-3.5')} Close
        </button>
      </div>

      {/* Video area */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        {screenTrack ? (
          <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
        ) : (
          <div style={{ textAlign:'center', color:'#52525b' }}>
            {Ic.screen('w-12 h-12')}
            <p style={{ marginTop:12, fontSize:13 }}>No one is sharing their screen yet.</p>
            <p style={{ fontSize:11, color:'#3f3f46', marginTop:4 }}>Click Present in the voice bar to share.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTED MESSAGE (markdown bold + quiz link)
// ─────────────────────────────────────────────────────────────────────────────
// ── Formatted message with images, files, and quizzes ─────────────────────
// ── Formatted message with quiz button, images, and files ──────────────────
function FormattedMessage({ text, roomCode, onOpenQuiz }) {
  let content = text || ''
  let quizId = null
  let attachments = []

  // Extract Quiz
  const quizMatch = content.match(/\[(?:TAKE_QUIZ|QUIZ_REQUEST):([^\]]+)\]/i)
  if (quizMatch) { quizId = quizMatch[1]; content = content.replace(quizMatch[0], '') }

  // Extract Images
  const imgRegex = /\[IMAGE:([^\]]+)\]/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    attachments.push({ type: 'image', url: match[1] });
    content = content.replace(match[0], '');
  }

  // Extract Generic Files
  const fileRegex = /\[FILE:([^|]+)\|([^\]]+)\]/g;
  while ((match = fileRegex.exec(content)) !== null) {
    attachments.push({ type: 'file', url: match[1], name: match[2] });
    content = content.replace(match[0], '');
  }

  const renderText = () => content.trim().split('\n').map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} style={{ color:'#fff' }}>{part.slice(2,-2)}</strong>
      return part
    })
    return <div key={i} style={{ marginBottom:4 }}>{parts}</div>
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {content.trim() && <div>{renderText()}</div>}

      {attachments.map((att, idx) => {
        if (att.type === 'image') return <img key={idx} src={att.url.trim()} alt="Shared image" style={{ maxWidth:'100%', maxHeight:'300px', objectFit:'contain', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)' }} />
        if (att.type === 'file') return (
          <a key={idx} href={att.url} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(96, 165, 250, 0.1)', padding:'12px 16px', borderRadius:8, textDecoration:'none', color:'#60a5fa', fontSize:13, border:'1px solid rgba(96, 165, 250, 0.3)', fontWeight:600, width:'fit-content' }}>
            📎 Download: {att.name}
          </a>
        )
      })}

      {quizId && (
        <button
          onClick={() => onOpenQuiz && onOpenQuiz(quizId)}
          style={{
            background:'rgba(99,102,241,0.14)', border:'1px solid rgba(99,102,241,0.4)',
            borderRadius:8, padding:'9px 14px', color:'#818cf8', width:'100%',
            fontSize:12, fontWeight:700, cursor:'pointer', textAlign:'center',
            display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Take Shared Quiz
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// XP REWARD BADGE (minimal in-chat indicator)
// ─────────────────────────────────────────────────────────────────────────────
function XPBadge({ xp, level }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, padding:'2px 7px' }}>
      {Ic.star('w-3 h-3')}
      <span style={{ fontSize:9, fontWeight:800, color:'#fbbf24' }}>Lv.{level}</span>
      <span style={{ fontSize:9, color:'#78716c' }}>{xp}xp</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMOTE PICKER
// ─────────────────────────────────────────────────────────────────────────────
function EmotePicker({ onEmote, onClose }) {
  return (
    <div style={{
      position:'absolute', bottom:52, left:0,
      background:'#1c1c1e', border:'1px solid rgba(255,255,255,0.1)',
      borderRadius:14, padding:10, display:'flex', gap:6, flexWrap:'wrap',
      width:200, zIndex:200, boxShadow:'0 8px 30px rgba(0,0,0,0.6)',
      animation:'fadeIn 0.15s ease',
    }}>
      {EMOTES.map(e => (
        <button key={e} onClick={() => { onEmote(e); onClose() }} style={{
          fontSize:22, background:'transparent', border:'none', cursor:'pointer',
          borderRadius:8, padding:'3px 5px', transition:'transform 0.1s',
        }}
          onMouseEnter={el => el.currentTarget.style.transform='scale(1.3)'}
          onMouseLeave={el => el.currentTarget.style.transform='scale(1)'}
        >{e}</button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT PANEL
// BUG FIX: onBroadcastPDF properly wired — no more DOM getElementById hack
// ─────────────────────────────────────────────────────────────────────────────
function ChatPanel({ presenceList, chatMessages, onSendChat, myUserId, myName, mySprite, onUpdateIdentity, roomCode, onBroadcastPDF, onSendEmote, myXP, myLevel, onOpenQuiz }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(myName)
  const [editSprite, setEditSprite] = useState(mySprite || '/sprites/char1.png')
  const [showEmotes, setShowEmotes] = useState(false)
  const [uploading, setUploading] = useState(false)
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [chatMessages])

  const uniqueUsers = Array.from(new Map(presenceList.map(u => [u.userId, u])).values())
  const sprites = ['/sprites/char1.png','/sprites/char2.png','/sprites/char3.png','/sprites/char4.png','/sprites/char5.png']

  const S = {
    panel:   { display:'flex', flexDirection:'column', height:'100%', background:'rgba(9,9,11,0.98)', borderLeft:'1px solid rgba(255,255,255,0.06)' },
    section: { padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,0.06)' },
    label:   { fontSize:9, color:'#52525b', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:8, display:'flex', alignItems:'center', gap:5 },
  }

  return (
    <div style={S.panel}>
      {/* Identity */}
      <div style={S.section}>
        <div style={S.label}>{Ic.edit('w-3 h-3')} Your identity</div>
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
              <div style={{ width:30, height:30, background:'rgba(255,255,255,0.06)', borderRadius:7, overflow:'hidden', flexShrink:0 }}>
                <img src={mySprite||'/sprites/char1.png'} alt="me" style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated' }} />
              </div>
              <div>
                <span style={{ fontSize:12, fontWeight:700, color:'#e4e4e7', fontFamily:'monospace', display:'block' }}>{myName}</span>
                <XPBadge xp={myXP} level={myLevel} />
              </div>
            </div>
            <button onClick={() => setEditing(true)} style={{ background:'transparent', border:'none', borderRadius:6, padding:'5px 8px', cursor:'pointer', color:'#52525b', display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600 }}>
              {Ic.edit('w-3 h-3')} Edit
            </button>
          </div>
        )}
      </div>

      {/* Online list */}
      <div style={S.section}>
        <div style={S.label}>{Ic.users('w-3 h-3')} Online — {uniqueUsers.length}/20</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {uniqueUsers.map((u, i) => (
            <div key={`${u.userId}-${i}`} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
              <img src={u.sprite||'/sprites/char1.png'} alt="" style={{ width:16, height:16, imageRendering:'pixelated' }} />
              <span style={{ fontSize:11, color:u.userId===myUserId ? '#e4e4e7' : '#71717a', fontFamily:'monospace', fontWeight:u.userId===myUserId ? 700 : 400 }}>
                {u.displayName}{u.userId===myUserId ? ' (you)' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10, scrollbarWidth:'none' }}>
        {chatMessages.length === 0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, opacity:0.25, paddingTop:40 }}>
            {Ic.chat('w-7 h-7')}
            <span style={{ fontSize:11, color:'#71717a', textAlign:'center' }}>
              No messages yet.<br/>@aguila to ask questions or request a quiz.
            </span>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              {msg.userId==='aguila-bot' && msg.sprite && <img src={msg.sprite} style={{ width:14, height:14, imageRendering:'pixelated' }} alt="Aguila" />}
              <span style={{ fontSize:10, fontWeight:700, color:msg.userId==='aguila-bot' ? '#a78bfa' : (msg.avatarColor||'#a1a1aa') }}>{msg.displayName}</span>
            </div>
            <div style={{
              fontSize:12, color:'#d4d4d8', lineHeight:1.55, wordBreak:'break-word', whiteSpace:'pre-wrap',
              padding:'8px 12px', borderRadius:10,
              background:msg.userId==='aguila-bot' ? 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(168,85,247,0.15))' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${msg.userId==='aguila-bot' ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow:msg.userId==='aguila-bot' ? '0 4px 15px rgba(168,85,247,0.1)' : 'none',
              borderTopLeftRadius:msg.userId==='aguila-bot' ? 2 : 10,
            }}>
              <FormattedMessage text={msg.text} roomCode={roomCode} onOpenQuiz={onOpenQuiz} />
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', gap:8, position:'relative' }}>
        {showEmotes && <EmotePicker onEmote={onSendEmote} onClose={() => setShowEmotes(false)} />}

        <form onSubmit={e => {
          e.preventDefault()
          if (draft.trim()) { onSendChat(draft, chatMessages); setDraft('') }
        }} style={{ display:'flex', gap:7 }}>

          {/* ── PDF UPLOAD
              BUG FIX: After processPDF succeeds, we call onBroadcastPDF(res.documentId)
              which updates loungeDocRef.current in useLounge via setLoungeDocument.
              Previously this was document.getElementById('lounge-pdf-state').value which
              is a separate DOM node that useLounge never reads.
          ── */}
          {/* Universal Uploader for Memes, Docs, and PDFs */}
          <input
            type="file" id="file-upload" accept="*/*" style={{ display:'none' }}
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              onSendChat(`⏳ Uploading ${file.name}...`, chatMessages)
              try {
                const formData = new FormData()
                formData.append('file', file)

                const uploadRes = await uploadChatFile(formData)
                if (!uploadRes.success) throw new Error(uploadRes.error)

                const publicUrl = uploadRes.publicUrl

                if (file.type.startsWith('image/')) {
                  onSendChat(`[IMAGE:${publicUrl}]`, chatMessages)
                } else {
                  onSendChat(`[FILE:${publicUrl}|${file.name}]`, chatMessages)
                  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.docx')) {
                    const res = await processPDF(formData, myUserId, null)
                    if (res.success) {
                      if (onBroadcastPDF) onBroadcastPDF(res.documentId)
                      onSendChat(`@aguila I just uploaded ${file.name}. Give everyone a 2-sentence summary of what it covers.`, chatMessages)
                    }
                  }
                }
              } catch (err) {
                console.error('Upload error:', err)
                onSendChat(` Failed to upload ${file.name}.`, chatMessages)
              }
              e.target.value = null
            }}
          />

          <button
            type="button"
            onClick={() => document.getElementById('file-upload').click()}
            title="Upload a file or image"
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, width:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#a1a1aa', flexShrink:0 }}
          >
            {Ic.paperclip('w-4 h-4')}
          </button>

          {/* Emote button */}
          <button type="button" onClick={() => setShowEmotes(v => !v)}
            style={{ background:showEmotes ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, width:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:showEmotes ? '#818cf8' : '#a1a1aa', flexShrink:0 }}>
            {Ic.smile('w-4 h-4')}
          </button>

          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message or @aguila..."
            style={{ 
              flex: 1, 
              minWidth: 0, /* 🌟 FIX: Stops the input from pushing the send button out! */
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: 10, 
              padding: '8px 11px', 
              fontSize: 12, 
              color: '#fff', 
              outline: 'none' 
            }}
            onFocus={e => e.target.style.border='1px solid rgba(99,102,241,0.4)'}
            onBlur={e => e.target.style.border='1px solid rgba(255,255,255,0.08)'}
          />

          <button type="submit" disabled={!draft.trim()}
            style={{ background:draft.trim() ? '#4f46e5' : 'rgba(255,255,255,0.05)', border:'none', borderRadius:10, padding:'8px 11px', cursor:draft.trim() ? 'pointer' : 'default', color:draft.trim() ? '#fff' : '#3f3f46', display:'flex', alignItems:'center', flexShrink:0 }}>
            {Ic.send('w-3.5 h-3.5')}
          </button>
        </form>

        <p style={{ fontSize:9, color:'#3f3f46', textAlign:'center', margin:0 }}>
          @aguila [topic] · @aguila generate [N] questions — unlimited quiz
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE BAR
// BUG FIX: volume slider now shows display name (from presence), not raw UUID
// ─────────────────────────────────────────────────────────────────────────────
function VoiceBar({ onScreenShare, presenceList }) {
  const { localParticipant, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant()
  const participants = useParticipants()
  const isSpeaking = useIsSpeaking(localParticipant)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isPTT, setIsPTT] = useState(false)

  // Map identity → display name using presence
  const nameMap = useMemo(() => {
    const m = {}
    presenceList.forEach(u => { if (u.userId) m[u.userId] = u.displayName || u.userId.slice(0,6) })
    return m
  }, [presenceList])

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
    try { await localParticipant.setScreenShareEnabled(!isScreenShareEnabled); onScreenShare(!isScreenShareEnabled) }
    catch (e) { console.warn('Screen share failed:', e) }
  }

  const micActive = isMicrophoneEnabled && !isPTT
  const speakingNow = micActive && isSpeaking
  const btn = { display:'flex', alignItems:'center', gap:6, borderRadius:9, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s', flexShrink:0, border:'none' }

  return (
    <div className="hide-scroll" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', height:'100%', gap:6, overflowX:'auto' }}>
      {/* Left: controls */}
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <TrackToggle source={Track.Source.Microphone} disabled={isPTT} style={{ ...btn, background:micActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border:`1px solid ${micActive ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, color:micActive ? '#4ade80' : '#f87171', opacity:isPTT?0.45:1, cursor:isPTT?'not-allowed':'pointer' }}>
          {micActive ? Ic.mic('w-3.5 h-3.5') : Ic.micOff('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{micActive ? 'Mic on' : 'Muted'}</span>
        </TrackToggle>

        <div style={{ ...btn, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', cursor:'default', padding:'4px 8px' }}>
          <SpeakingBars active={speakingNow} />
          <span className="hidden sm:inline" style={{ color:speakingNow ? '#4ade80' : '#3f3f46' }}>
            {micActive ? (isSpeaking ? 'Speaking' : 'Listening') : 'Mic off'}
          </span>
        </div>

        <button onClick={() => setIsDeafened(d => !d)} style={{ ...btn, background:isDeafened ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isDeafened ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.08)'}`, color:isDeafened ? '#f87171' : '#a1a1aa' }}>
          {isDeafened ? Ic.volumeOff('w-3.5 h-3.5') : Ic.volume('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{isDeafened ? 'Deafened' : 'Sound on'}</span>
        </button>

        <button onClick={() => setIsPTT(p => !p)} className="hidden sm:flex" style={{ ...btn, background:isPTT ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isPTT ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`, color:isPTT ? '#818cf8' : '#71717a' }}>
          {Ic.keyboard('w-3.5 h-3.5')} <span>{isPTT ? 'PTT — V' : 'Voice act.'}</span>
        </button>

        <button onClick={handleScreenShare} style={{ ...btn, background:isScreenShareEnabled ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border:`1px solid ${isScreenShareEnabled ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`, color:isScreenShareEnabled ? '#818cf8' : '#71717a' }}>
          {isScreenShareEnabled ? Ic.screenStop('w-3.5 h-3.5') : Ic.screen('w-3.5 h-3.5')}
          <span className="hidden sm:inline">{isScreenShareEnabled ? 'Stop share' : 'Present'}</span>
        </button>
      </div>

      {/* Right: per-participant volume — FIXED: shows display name not UUID */}
      <div className="hide-scroll" style={{ display:'flex', alignItems:'center', gap:10, overflowX:'auto', paddingLeft:8 }}>
        {participants.map(p => {
          const label = nameMap[p.identity] || p.identity.slice(0,8)
          return (
            <div key={p.identity} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.04)', padding:'4px 9px', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:p.isMicrophoneEnabled ? '#22c55e' : '#3f3f46' }} />
              {/* Display name — not UUID */}
              <span style={{ fontSize:10, color:'#a1a1aa', fontWeight:600, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={label}>
                {label}
              </span>
              {/* Volume slider */}
              {Ic.volume('w-3 h-3')}
              <input type="range" min="0" max="1" step="0.05" defaultValue="1"
                onChange={e => {
                  const pub = p.getTrackPublication(Track.Source.Microphone)
                  if (pub?.track) pub.track.setVolume(parseFloat(e.target.value))
                }}
                style={{ width:44, accentColor:'#4f46e5', cursor:'pointer' }}
                title={`${label} volume`}
              />
            </div>
          )
        })}
      </div>

      {!isDeafened && <RoomAudioRenderer />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUAL JOYSTICK (tablet + mobile, works with pointer events)
// BUG FIX: D-pad was display:none above 768px. Now shows ≤1024px.
// Added analogue joystick mode with full pointer-capture.
// ─────────────────────────────────────────────────────────────────────────────
function VirtualJoystick({ setMovement }) {
  const stickRef = useRef(null)
  const baseRef = useRef(null)
  const activeRef = useRef(false)
  const lastDirs = useRef({ w:false, a:false, s:false, d:false })

  const DEAD = 10  // px dead-zone
  const MAX  = 38  // px max radius

  const updateDirs = useCallback((dx, dy) => {
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len < DEAD) {
      // In dead zone — stop all
      Object.keys(lastDirs.current).forEach(k => {
        if (lastDirs.current[k]) { setMovement(k, false); lastDirs.current[k] = false }
      })
      return
    }
    const nx = dx / len, ny = dy / len
    const next = { w: ny < -0.4, s: ny > 0.4, a: nx < -0.4, d: nx > 0.4 }
    Object.keys(next).forEach(k => {
      if (next[k] !== lastDirs.current[k]) { setMovement(k, next[k]); lastDirs.current[k] = next[k] }
    })
  }, [setMovement])

  const stopAll = useCallback(() => {
    Object.keys(lastDirs.current).forEach(k => { if (lastDirs.current[k]) { setMovement(k, false); lastDirs.current[k] = false } })
    activeRef.current = false
    if (stickRef.current) stickRef.current.style.transform = 'translate(-50%,-50%)'
  }, [setMovement])

  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    activeRef.current = true
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!activeRef.current || !baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const len = Math.sqrt(dx*dx + dy*dy)
    const clampedX = len > MAX ? (dx/len)*MAX : dx
    const clampedY = len > MAX ? (dy/len)*MAX : dy
    if (stickRef.current) stickRef.current.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`
    updateDirs(dx, dy)
  }, [updateDirs])

  return (
    <div ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopAll}
      onPointerCancel={stopAll}
      style={{
        width:96, height:96, borderRadius:'50%',
        background:'rgba(9,9,11,0.75)',
        border:'2px solid rgba(99,102,241,0.35)',
        position:'relative', cursor:'grab', touchAction:'none', userSelect:'none',
        backdropFilter:'blur(10px)',
      }}
    >
      <div ref={stickRef} style={{
        position:'absolute', top:'50%', left:'50%',
        transform:'translate(-50%,-50%)',
        width:44, height:44, borderRadius:'50%',
        background:'rgba(99,102,241,0.7)',
        border:'2px solid rgba(99,102,241,0.9)',
        transition:'transform 0s',
        pointerEvents:'none',
        boxShadow:'0 0 12px rgba(99,102,241,0.4)',
      }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC WIDGET (minimizable, background play preserved)
// ─────────────────────────────────────────────────────────────────────────────
function MusicWidget({ globalMusic, setGlobalMusic }) {
  const [minimized, setMinimized] = useState(false)
  if (!globalMusic?.url) return null
  const isYT = globalMusic.url.includes('youtube.com') || globalMusic.url.includes('youtu.be')
  const isSpotify = globalMusic.url.includes('spotify.com')
  let embedUrl = globalMusic.url
  if (isYT && !embedUrl.includes('mute=1')) embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'mute=1&playsinline=1&rel=0'

  return (
    <div className="music-widget" style={{ animation:'fadeIn 0.2s ease' }}>
      <div style={{ background:'rgba(255,255,255,0.04)', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:minimized ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {Ic.music('w-3 h-3')}
          <span style={{ fontSize:10, color:'#71717a', fontWeight:600 }}>Room DJ</span>
          {minimized && <span style={{ fontSize:10, color:'#4ade80' }}>— playing</span>}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={() => setMinimized(m => !m)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#52525b', padding:3, display:'flex' }}>
            {minimized ? Ic.maximize2('w-3.5 h-3.5') : Ic.minimize('w-3.5 h-3.5')}
          </button>
          <button onClick={() => setGlobalMusic({ url:'' })} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#52525b', padding:3, display:'flex' }}>
            {Ic.x('w-3.5 h-3.5')}
          </button>
        </div>
      </div>
      {/* Keep DOM mounted when minimized so audio continues */}
      <div style={{ height:minimized ? 0 : (isSpotify ? 152 : 160), overflow:'hidden', transition:'height 0.3s ease' }}>
        {isYT ? (
          <YouTube
            videoId={globalMusic.url.includes('videoseries') ? null : globalMusic.url.split('embed/')[1]?.split('?')[0]}
            opts={{ height:'152', width:'100%', playerVars:{ autoplay:1, controls:1 } }}
            onPlay={e => setGlobalMusic({ isPlaying:true, time:e.target.getCurrentTime() })}
            onPause={e => setGlobalMusic({ isPlaying:false, time:e.target.getCurrentTime() })}
            onReady={e => { if (!globalMusic.isPlaying) e.target.pauseVideo(); e.target.seekTo(globalMusic.time||0) }}
          />
        ) : (
          <iframe src={embedUrl} width="100%" height={isSpotify ? 152 : 160} frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style={{ display:'block' }} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-LOUNGE QUIZ OVERLAY
// Renders fixed over the lounge — the lounge stays mounted underneath.
// Name, chat history, and avatar position are fully preserved.
// ─────────────────────────────────────────────────────────────────────────────
function InLoungeQuiz({ quizId, onClose, presenceList = [] }) {
  const [questions,    setQuestions]    = useState([])
  const [quizTitle,    setQuizTitle]    = useState('')
  const [loading,      setLoading]      = useState(true)
  const [answers,      setAnswers]      = useState({})
  const [index,        setIndex]        = useState(0)
  const [finished,     setFinished]     = useState(false)
  const [score,        setScore]        = useState(0)
  const [leaderboard,  setLeaderboard]  = useState([])
  const [user,         setUser]         = useState(null)

  // 🌟 FIX: Create a dictionary matching User IDs to their Custom Display Names
  const nameMap = useMemo(() => {
    const m = {}
    presenceList.forEach(u => { if (u.userId) m[u.userId] = u.displayName || u.userId.slice(0,6) })
    return m
  }, [presenceList])

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      const { data: quiz } = await supabase.from('quizzes').select('title').eq('id', quizId).single()
      setQuizTitle(quiz?.title || 'Shared Quiz')
      const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', quizId)
      setQuestions((qs || []).sort((a, b) => a.id.localeCompare(b.id)))
      setLoading(false)
    }
    load()
  }, [quizId])

  const currentQ = questions[index]
  const myAnswer = answers[currentQ?.id]
  const answered = !!myAnswer
  const progress = questions.length ? (index / questions.length) * 100 : 0

  const pick = (letter) => {
    if (answered) return
    setAnswers(prev => ({ ...prev, [currentQ.id]: letter }))
  }

  const next = async () => {
    if (index < questions.length - 1) {
      setIndex(i => i + 1)
    } else {
      let s = 0
      questions.forEach(q => { if (answers[q.id] === q.answer) s++ })
      setScore(s)
      if (user) {
        await supabase.from('quiz_results').insert([{
          quiz_id: quizId, user_id: user.id,
          score: s, total: questions.length, quiz_title: quizTitle,
        }])
      }
      const { data: lb } = await supabase
        .from('quiz_results').select('id, user_id, score, total')
        .eq('quiz_id', quizId).order('score', { ascending: false })
      const seen = new Set()
      const unique = []
      ;(lb || []).forEach(e => { if (!seen.has(e.user_id)) { seen.add(e.user_id); unique.push(e) } })
      setLeaderboard(unique.slice(0, 10))
      setFinished(true)
    }
  }

  const OL = {
    position:'fixed', inset:0, zIndex:900,
    background:'rgba(9,9,11,0.97)', backdropFilter:'blur(4px)',
    display:'flex', flexDirection:'column',
    fontFamily:'system-ui,-apple-system,sans-serif', color:'#e4e4e7',
  }
  const CARD = { background:'#111113', border:'1px solid rgba(255,255,255,0.09)', borderRadius:12 }

  const Header = (
    <div style={{ height:46, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(9,9,11,0.98)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#4f46e5' }} />
        <span style={{ fontSize:12, fontWeight:600, color:'#a1a1aa' }}>{quizTitle}</span>
      </div>
      <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 12px', color:'#71717a', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
        {Ic.x('w-3.5 h-3.5')} Back to lounge
      </button>
    </div>
  )

  if (loading) return (
    <div style={OL}>
      {Header}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:12, color:'#52525b' }}>Loading quiz...</span>
      </div>
    </div>
  )

  // ── Results ──────────────────────────────────────────────────────────────
  if (finished) {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
    const medals = ['🥇','🥈','🥉']
    return (
      <div style={OL}>
        {Header}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 16px' }}>
          <div style={{ maxWidth:540, margin:'0 auto' }}>
            <div style={{ ...CARD, padding:'28px 24px', textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:52, fontWeight:800, color:'#fff', lineHeight:1 }}>{pct}<span style={{ fontSize:20, color:'#52525b' }}>%</span></div>
              <div style={{ fontSize:12, color:'#71717a', marginTop:6 }}>{score} of {questions.length} correct</div>
              <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:18 }}>
                <span style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.25)', borderRadius:8, padding:'7px 18px', fontSize:12, color:'#4ade80', fontWeight:700 }}>{score} correct</span>
                <span style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'7px 18px', fontSize:12, color:'#f87171', fontWeight:700 }}>{questions.length - score} wrong</span>
              </div>
            </div>
            {leaderboard.length > 0 && (
              <div style={{ ...CARD, padding:'16px 18px', marginBottom:16 }}>
                <div style={{ fontSize:10, color:'#52525b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Room Scores</div>
                {leaderboard.map((e, i) => {
                  const isMe = e.user_id === user?.id
                  const epct = e.total ? Math.round((e.score / e.total) * 100) : 0
                  return (
                    <div key={e.id || i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background:isMe ? 'rgba(99,102,241,0.1)' : 'transparent', border:`1px solid ${isMe ? 'rgba(99,102,241,0.25)' : 'transparent'}`, marginBottom:4 }}>
                      <span style={{ width:22, textAlign:'center' }}>{medals[i] || `${i+1}.`}</span>
                      <span style={{ flex:1, fontSize:12, color:isMe ? '#c7d2fe' : '#a1a1aa', fontWeight:isMe ? 700 : 400 }}>{isMe ? 'You' : `Player ${e.user_id.slice(0,6)}`}</span>
                      <span style={{ fontSize:12, color:'#e4e4e7', fontWeight:600 }}>{epct}%</span>
                      <span style={{ fontSize:11, color:'#52525b' }}>{e.score}/{e.total}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ fontSize:10, color:'#52525b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Review</div>
            {questions.map((q, i) => {
              const myAns   = answers[q.id]
              const correct = myAns === q.answer
              return (
                <div key={q.id} style={{ ...CARD, padding:'13px 15px', marginBottom:10 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ width:17, height:17, borderRadius:'50%', background:correct ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', border:`1px solid ${correct ? '#4ade80' : '#f87171'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                      <span style={{ fontSize:8, color:correct ? '#4ade80' : '#f87171' }}>{correct ? '✓' : '✗'}</span>
                    </div>
                    <span style={{ fontSize:12, color:'#d4d4d8', lineHeight:1.5 }}>{i+1}. {q.question}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#4ade80', marginBottom:myAns && !correct ? 4 : q.explanation ? 8 : 0 }}>✓ {q.choices?.[q.answer] || q.answer}</div>
                  {!correct && myAns && <div style={{ fontSize:11, color:'#f87171', marginBottom:q.explanation ? 8 : 0 }}>✗ {q.choices?.[myAns] || myAns}</div>}
                  {q.explanation && <div style={{ fontSize:11, color:'#71717a', lineHeight:1.55, background:'rgba(255,255,255,0.03)', borderRadius:6, padding:'8px 10px', borderLeft:'2px solid rgba(99,102,241,0.3)' }}>{q.explanation}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Active question ──────────────────────────────────────────────────────
  return (
    <div style={OL}>
      {Header}
      <div style={{ height:3, background:'rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${progress}%`, background:'#4f46e5', transition:'width 0.3s ease' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'28px 16px', display:'flex', flexDirection:'column' }}>
        <div style={{ maxWidth:540, width:'100%', margin:'0 auto', flex:1, display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10, color:'#52525b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:20 }}>{index + 1} / {questions.length}</div>
          <div style={{ fontSize:16, fontWeight:500, color:'#f4f4f5', lineHeight:1.6, marginBottom:26 }}>{currentQ?.question}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {['A','B','C','D'].map(letter => {
              if (!currentQ?.choices?.[letter]) return null
              const isCorrect = currentQ.answer === letter
              const isMine    = myAnswer === letter
              let bg = 'rgba(255,255,255,0.04)', border = 'rgba(255,255,255,0.09)', color = '#a1a1aa', keyBg = 'rgba(255,255,255,0.07)'
              if (answered) {
                if (isCorrect)       { bg='rgba(74,222,128,0.1)';   border='rgba(74,222,128,0.4)';   color='#4ade80'; keyBg='rgba(74,222,128,0.18)' }
                else if (isMine)     { bg='rgba(239,68,68,0.1)';    border='rgba(239,68,68,0.4)';    color='#f87171'; keyBg='rgba(239,68,68,0.18)' }
                else                 { color='#3f3f46'; border='rgba(255,255,255,0.04)' }
              } else if (isMine)     { bg='rgba(99,102,241,0.1)';   border='rgba(99,102,241,0.4)';   color='#818cf8'; keyBg='rgba(99,102,241,0.18)' }
              return (
                <button key={letter} onClick={() => pick(letter)} disabled={answered}
                  style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', background:bg, border:`1px solid ${border}`, borderRadius:10, padding:'12px 14px', cursor:answered ? 'default' : 'pointer', transition:'all 0.12s', outline:'none' }}>
                  <div style={{ width:26, height:26, borderRadius:6, background:keyBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color, flexShrink:0 }}>{letter}</div>
                  <span style={{ fontSize:13, color, lineHeight:1.5 }}>{currentQ.choices[letter]}</span>
                  {answered && isCorrect && <svg style={{ marginLeft:'auto', flexShrink:0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {answered && isMine && !isCorrect && <svg style={{ marginLeft:'auto', flexShrink:0 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </button>
              )
            })}
          </div>
          {answered && currentQ?.explanation && (
            <div style={{ fontSize:12, color:'#71717a', lineHeight:1.6, background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'11px 14px', borderLeft:'2px solid rgba(99,102,241,0.35)', marginBottom:20 }}>
              <span style={{ color:'#818cf8', fontWeight:600 }}>Note: </span>{currentQ.explanation}
            </div>
          )}
          <div style={{ marginTop:'auto', display:'flex', justifyContent:'flex-end' }}>
            {answered && (
              <button onClick={next} style={{ background:'#fff', color:'#09090b', border:'none', borderRadius:8, padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}>
                {index === questions.length - 1 ? 'See Results' : 'Next'}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// XP / LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const XP_PER_LEVEL = 100
function computeLevel(xp) { return Math.floor(xp / XP_PER_LEVEL) + 1 }
const XP_ACTIONS = { message: 2, quiz: 20, pdf: 15, emote: 1 }

function useXP(userId) {
  const [xp, setXP] = useState(0)
  const key = `aguila_xp_${userId}`

  useEffect(() => {
    if (!userId) return
    const stored = parseInt(localStorage.getItem(key) || '0', 10)
    setXP(stored)
  }, [userId, key])

  const addXP = useCallback((action) => {
    const gain = XP_ACTIONS[action] || 1
    setXP(prev => {
      const next = prev + gain
      localStorage.setItem(key, String(next))
      return next
    })
  }, [key])

  return { xp, level: computeLevel(xp), addXP }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
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
  const [showPresent, setShowPresent] = useState(false)
  const [quizOverlayId, setQuizOverlayId] = useState(null)

  const scrollViewRef = useRef(null)

  // XP system
  const { xp, level, addXP } = useXP(user?.id)

  // Mic permission — inside component (this was the original crash fix)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    navigator.mediaDevices.getUserMedia({ audio:true, video:false })
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
      const tokenRes = await fetch(`/api/livekit-token?room=${code}&identity=${session.user.id}`, { headers: { Authorization:`Bearer ${session.access_token}` } })
      if (tokenRes.ok) { const { token:lkToken } = await tokenRes.json(); setToken(lkToken) }
      else {
        const body = await tokenRes.json().catch(() => ({}))
        if (body.error?.includes('full')) { setError('This lounge is full (20/20).'); setLoading(false); return }
      }
      setLoading(false)
    }
    init()
  }, [code, router])

  // CRITICAL: destructure broadcastLoungePDF from useLounge
const {
    myPosition, otherUsers, presenceList, chatMessages, sendChat,
    ROOM_WIDTH, ROOM_HEIGHT, AVATAR_SIZE, myMeta, updateIdentity, setMovement,
    globalMusic, setGlobalMusic, isMoving,
    broadcastLoungePDF,
    activeEmotes,       
    sendEmote,
  } = useLounge({ loungeCode: code, user })

  // Camera follow
  useEffect(() => {
    const el = scrollViewRef.current
    if (!el) return
    const tx = myPosition.x + AVATAR_SIZE/2 - el.clientWidth/2
    const ty = myPosition.y + AVATAR_SIZE/2 - el.clientHeight/2
    el.scrollLeft = Math.max(0, tx)
    el.scrollTop  = Math.max(0, ty)
  }, [myPosition, AVATAR_SIZE])

  // Chat open on desktop by default
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
          finalUrl = `https://www.youtube.com/embed/videoseries?list=${new URLSearchParams(urlObj.search).get('list')}&autoplay=1&mute=1&playsinline=1`
        } else {
          const vid = link.includes('youtu.be') ? urlObj.pathname.slice(1) : new URLSearchParams(urlObj.search).get('v')
          if (vid) finalUrl = `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&playsinline=1&rel=0`
        }
      } else if (link.includes('spotify.com')) {
        const path = urlObj.pathname
        finalUrl = path.startsWith('/embed/') ? link : `https://open.spotify.com/embed${path}?utm_source=generator&theme=0`
      }
      if (finalUrl) setGlobalMusic({ url:finalUrl, isPlaying:true, time:0 })
    } catch {}
    setShowMusicInput(false)
    setMusicLink('')
  }

  // Wrapped sendChat that also awards XP
  const handleSendChat = useCallback((text, history) => {
    sendChat(text, history)
    addXP('message')
  }, [sendChat, addXP])

  // Emote handler with XP
  const handleSendEmote = useCallback((emote) => {
    if (sendEmote) sendEmote(emote)
    addXP('emote')
  }, [sendEmote, addXP])

  const [roomOptions] = useState({
    audioCaptureDefaults: { autoGainControl:true, echoCancellation:true, noiseSuppression:true },
    publishDefaults: { red:true, audioBitrate:32000 },
  })

  // ── Loading / Error ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height:'100dvh', background:'#09090b', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#52525b', gap:14 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:22, height:22, border:'2px solid #3f3f46', borderTopColor:'#4f46e5', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <span style={{ fontSize:12, fontWeight:600 }}>Connecting to lounge...</span>
    </div>
  )

  if (error) return (
    <div style={{ height:'100dvh', background:'#09090b', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, color:'#f87171', fontSize:13, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:12, padding:'12px 20px' }}>
        {Ic.alert('w-4 h-4')} {error}
      </div>
      <Link href="/lounge" style={{ color:'#818cf8', fontSize:12, textDecoration:'none' }}>Back to lobby</Link>
    </div>
  )

  // ── Room Canvas ────────────────────────────────────────────────────
  const RoomCanvas = (
    <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>

      {/* D-Pad / Joystick — outside the scroll container so camera-follow
          (el.scrollLeft / el.scrollTop) never moves it off-screen */}
      <div className="dpad-zone">
        <VirtualJoystick setMovement={setMovement} />
      </div>

      {/* Scrollable map — camera tracks player */}
      <div ref={scrollViewRef} className="hide-scroll" style={{ flex:1, position:'relative', overflow:'auto', background:'#000', outline:'none' }}>

        {/* Game world */}
        <div style={{ position:'relative', width:ROOM_WIDTH, height:ROOM_HEIGHT, minWidth:ROOM_WIDTH, minHeight:ROOM_HEIGHT, backgroundImage:`url('/pixel-room.png')`, backgroundSize:'100% 100%', imageRendering:'pixelated', overflow:'visible' }}>
          {Object.entries(otherUsers).map(([uid, data]) => (
            <Avatar key={uid} x={data.x} y={data.y} displayName={data.displayName} avatarColor={data.avatarColor} sprite={data.sprite} size={AVATAR_SIZE} userId={uid} hasVoice={!!token} isIdle={data.isIdle} isMoving={data.isMoving||false} activeEmote={activeEmotes?.[uid] || null} />
          ))}
          <Avatar x={myPosition.x} y={myPosition.y} displayName={myMeta.displayName} avatarColor={myMeta.avatarColor} sprite={myMeta.sprite} isMe size={AVATAR_SIZE} userId={myMeta.userId} hasVoice={!!token} isIdle={myMeta.isIdle} isMoving={isMoving} activeEmote={activeEmotes?.[myMeta.userId] || null} />
        </div>
      </div>

      {/* Chat panel — onBroadcastPDF correctly wired */}
      {chatOpen && (
        <div className="chat-container">
          <ChatPanel
            presenceList={presenceList}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
            myUserId={myMeta.userId}
            myName={myMeta.displayName}
            mySprite={myMeta.sprite}
            onUpdateIdentity={updateIdentity}
            roomCode={code}
            onBroadcastPDF={broadcastLoungePDF}
            onSendEmote={handleSendEmote}
            myXP={xp}
            myLevel={level}
            onOpenQuiz={setQuizOverlayId}
          />
        </div>
      )}

      <MusicWidget globalMusic={globalMusic} setGlobalMusic={setGlobalMusic} />

      {micPermission === 'denied' && (
        <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', zIndex:100, background:'rgba(239,68,68,0.14)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'7px 14px', display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#f87171', backdropFilter:'blur(10px)', whiteSpace:'nowrap' }}>
          {Ic.micOff('w-3.5 h-3.5')} Microphone access denied — enable it in browser settings
        </div>
      )}
    </div>
  )

  // ── Full page ──────────────────────────────────────────────────────
  const pageContent = (
    <div style={{ height:'100dvh', display:'flex', flexDirection:'column', background:'#09090b', overflow:'hidden', color:'#fff', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <style>{ANIM_CSS}</style>

      {/* Fullscreen screen share overlay — covers everything */}
      {showPresent && token && <ScreenShareOverlay onClose={() => setShowPresent(false)} />}

      {/* In-page quiz overlay — mounts over the lounge, lounge stays alive */}
      {quizOverlayId && <InLoungeQuiz quizId={quizOverlayId} onClose={() => setQuizOverlayId(null)} presenceList={presenceList} />}

      {/* Header */}
      <div style={{ height:46, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(9,9,11,0.98)', backdropFilter:'blur(12px)', flexShrink:0, zIndex:100, position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Link href="/lounge" style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#52525b', textDecoration:'none', fontWeight:600, padding:'5px 8px', borderRadius:8, border:'1px solid transparent' }}>
            {Ic.exit('w-3.5 h-3.5')} <span className="hidden sm:inline">Exit</span>
          </Link>
          <div style={{ width:1, height:16, background:'rgba(255,255,255,0.08)' }} />
          <span className="hidden sm:inline" style={{ fontSize:12, fontWeight:600, color:'#e4e4e7', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lounge?.name||'Study Lounge'}</span>
          <button onClick={handleCopyCode} style={{ display:'flex', alignItems:'center', gap:5, background:copied ? 'rgba(74,222,128,0.1)' : 'rgba(79,70,229,0.1)', border:`1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(99,102,241,0.25)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:copied ? '#4ade80' : '#818cf8', fontSize:11, fontWeight:700, fontFamily:'monospace', transition:'all 0.2s' }}>
            {copied ? Ic.check('w-3 h-3') : Ic.copy('w-3 h-3')}
            <span style={{ letterSpacing:'0.08em' }}>{code}</span>
            {copied && <span style={{ fontSize:10 }}>Copied</span>}
          </button>
        </div>

        <div className="hide-scroll" style={{ display:'flex', alignItems:'center', gap:7, overflowX:'auto' }}>
          {token && roomOptions && <StartAudio label="Enable Audio" className="header-start-audio" />}

          <Link href={`/quiz?from=${code}`} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:8, padding:'4px 10px', color:'#fbbf24', fontSize:11, fontWeight:600, whiteSpace:'nowrap', textDecoration:'none' }}>
            {Ic.edit('w-3.5 h-3.5')} <span className="hidden sm:inline">Quiz</span>
          </Link>

          <button onClick={() => setShowPresent(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:showPresent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', border:`1px solid ${showPresent ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:showPresent ? '#818cf8' : '#71717a', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.fullscreen('w-3.5 h-3.5')} <span className="hidden sm:inline">Present</span>
          </button>

          <button onClick={() => setShowMusicInput(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:showMusicInput ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'#a1a1aa', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.music('w-3.5 h-3.5')} <span className="hidden sm:inline">Music</span>
          </button>

          <button onClick={() => setChatOpen(v => !v)} style={{ display:'flex', alignItems:'center', gap:6, background:chatOpen ? 'rgba(79,70,229,0.14)' : 'rgba(255,255,255,0.05)', border:`1px solid ${chatOpen ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius:8, padding:'4px 10px', cursor:'pointer', color:chatOpen ? '#818cf8' : '#71717a', fontSize:11, fontWeight:600, whiteSpace:'nowrap' }}>
            {Ic.chat('w-3.5 h-3.5')} Chat
          </button>
        </div>

        {showMusicInput && (
          <form onSubmit={handleSetMusic} style={{ position:'absolute', top:48, right:12, background:'#18181b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:12, display:'flex', gap:7, zIndex:400, boxShadow:'0 8px 30px rgba(0,0,0,0.7)' }}>
            <input value={musicLink} onChange={e=>setMusicLink(e.target.value)} placeholder="YouTube or Spotify..." autoFocus style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:8, padding:'7px 11px', fontSize:11, outline:'none', width:'200px', maxWidth:'50vw' }} />
            <button type="submit" style={{ background:'#4f46e5', border:'none', borderRadius:8, padding:'7px 14px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>Set</button>
          </form>
        )}
      </div>

      {/* Body */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', position:'relative', overflow:'hidden' }}>
        {RoomCanvas}
        <div style={{ height:48, borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(9,9,11,0.98)', flexShrink:0 }}>
          {token && roomOptions ? (
            <VoiceBar onScreenShare={() => setShowPresent(v => !v)} presenceList={presenceList} />
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
  ) : pageContent
}