'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateLoungeQuiz, askAguila } from '@/app/actions/loungeQuiz'

const ROOM_WIDTH   = 1200
const ROOM_HEIGHT  = 680
const AVATAR_SIZE  = 100
const MOVE_SPEED   = 4
const BROADCAST_HZ = 20
const EMOTE_DURATION = 2000 // ms before emote bubble disappears

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6','#f97316']

function getAvatarColor(uid = '') {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function getDisplayName(email = '') { return email?.split('@')[0].slice(0, 12) || 'Guest' }

export function useLounge({ loungeCode, user }) {
  const channelRef        = useRef(null)
  const myPositionRef     = useRef({ x: ROOM_WIDTH/2 - AVATAR_SIZE/2, y: ROOM_HEIGHT/2 - AVATAR_SIZE/2 })
  const keysRef           = useRef({})
  const animFrameRef      = useRef(null)
  const broadcastTimerRef = useRef(null)
  const movingRef         = useRef(false)

  const [myPosition,   setMyPosition]   = useState(myPositionRef.current)
  const [otherUsers,   setOtherUsers]   = useState({})
  const [presenceList, setPresenceList] = useState([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [isMoving,     setIsMoving]     = useState(false)
  const [isIdle,       setIsIdle]       = useState(false)
  const idleTimerRef = useRef(null)

  // 🌟 FIX 1: Identity Memory (Using SessionStorage so it clears on tab close)
  const [localName, setLocalName] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`lounge_name_${loungeCode}`) || getDisplayName(user?.email)
    }
    return getDisplayName(user?.email)
  })
  
  const [localSprite, setLocalSprite] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`lounge_sprite_${loungeCode}`) || '/sprites/char1.png'
    }
    return '/sprites/char1.png'
  })

  // 🌟 FIX 2: Chat History Memory
  const [chatMessages, setChatMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedChat = sessionStorage.getItem(`lounge_chat_${loungeCode}`)
      if (savedChat) return JSON.parse(savedChat)
    }
    return []
  })

  // 🌟 FIX 3: PDF Document Memory
  const [loungeDocumentId, setLoungeDocumentId] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`lounge_pdf_${loungeCode}`) || null
    }
    return null
  })
  const loungeDocRef = useRef(loungeDocumentId)

  // ── Music ──────────────────────────────────────────────────────────────
  const [globalMusic, setGlobalMusicState] = useState({ url:'', isPlaying:true, time:0 })

  // ── Emotes — maps userId → active emote string ─────────────────────────
  const [activeEmotes, setActiveEmotes] = useState({})

  const userId      = user?.id
  const avatarColor = getAvatarColor(userId)

  // ── Auto-Save Chat History ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && loungeCode) {
      sessionStorage.setItem(`lounge_chat_${loungeCode}`, JSON.stringify(chatMessages))
    }
  }, [chatMessages, loungeCode])

  // ── Setters with ref sync & memory saving ──────────────────────────────
  const setLoungeDocument = useCallback((docId) => {
    setLoungeDocumentId(docId)
    loungeDocRef.current = docId
    if (typeof window !== 'undefined' && docId) {
      sessionStorage.setItem(`lounge_pdf_${loungeCode}`, docId)
    }
  }, [loungeCode])

  const wakeUp = useCallback(() => {
    setIsIdle(false)
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 60000)
  }, [])

  useEffect(() => { wakeUp(); return () => clearTimeout(idleTimerRef.current) }, [wakeUp])

  const broadcastPosition = useCallback((x, y, moving, idleState) => {
    if (!channelRef.current || broadcastTimerRef.current) return
    channelRef.current.send({
      type:'broadcast', event:'position',
      payload:{ userId, x, y, isIdle:idleState, isMoving:moving },
    })
    broadcastTimerRef.current = setTimeout(() => { broadcastTimerRef.current = null }, 1000/BROADCAST_HZ)
  }, [userId])

  const updateIdentity = useCallback(async (newName, newSprite) => {
    if (!channelRef.current || !newName.trim()) return
    wakeUp()
    
    setLocalName(newName)
    setLocalSprite(newSprite)
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`lounge_name_${loungeCode}`, newName)
      sessionStorage.setItem(`lounge_sprite_${loungeCode}`, newSprite)
    }

    await channelRef.current.track({ userId, displayName:newName, avatarColor, sprite:newSprite, joinedAt:new Date().toISOString() })
  }, [channelRef, userId, avatarColor, wakeUp, loungeCode])

  const sendChat = useCallback(async (text, chatHistorySnapshot = []) => {
    if (!channelRef.current || !text.trim()) return
    wakeUp()

    const userMsg = {
      userId, displayName:localName, avatarColor,
      sprite:localSprite, text:text.trim().slice(0, 500), ts:Date.now(),
    }

    setChatMessages(prev => [...prev.slice(-99), userMsg])
    channelRef.current.send({ type:'broadcast', event:'chat', payload:userMsg })

    if (!text.toLowerCase().includes('@aguila')) return

    const query = text.replace(/@aguila/gi, '').trim()

    const thinkMsg = {
      userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5',
      sprite:'/logo.png', text:'Thinking...', ts:Date.now(),
    }
    setChatMessages(prev => [...prev.slice(-99), thinkMsg])
    channelRef.current.send({ type:'broadcast', event:'chat', payload:thinkMsg })

    const res = await askAguila({
      question: query,
      documentId: loungeDocRef.current || null, 
      userId,
      chatHistory: chatHistorySnapshot,
    })

    if (!res.success) {
      const errMsg = { userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5', sprite:'/logo.png', text:'Sorry, I ran into an error. Please try again.', ts:Date.now() }
      setChatMessages(prev => [...prev.slice(0,-1), errMsg])
      channelRef.current.send({ type:'broadcast', event:'chat', payload:errMsg })
      return
    }

    const answer = res.answer

    const quizMatch = answer.match(/\[QUIZ_REQUEST:([^\]]+)\]/)
    if (quizMatch) {
      const rawCount = quizMatch[1].trim()
      const count = rawCount === 'auto' ? 'auto' : parseInt(rawCount) || 10

      const genMsg = {
        userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5', sprite:'/logo.png',
        text: count === 'auto'
          ? 'Generating a full-coverage quiz from your notes. This may take a moment...'
          : `Generating a ${count}-question quiz. Hang tight...`,
        ts:Date.now(),
      }
      setChatMessages(prev => [...prev.slice(0,-1), genMsg])
      channelRef.current.send({ type:'broadcast', event:'chat', payload:genMsg })

      const quizRes = await generateLoungeQuiz({
        userId,
        documentId: loungeDocRef.current || null,
        requestedCount: count,
        topic: query,
      })

      const doneMsg = quizRes.success
        ? { userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5', sprite:'/logo.png', text:`I created a ${quizRes.count}-question quiz for the room! [TAKE_QUIZ:${quizRes.quizId}]`, ts:Date.now() }
        : { userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5', sprite:'/logo.png', text:`Failed to generate quiz: ${quizRes.error}`, ts:Date.now() }
      setChatMessages(prev => [...prev.slice(-99), doneMsg])
      channelRef.current.send({ type:'broadcast', event:'chat', payload:doneMsg })
      return
    }

    const aguilaMsg = { userId:'aguila-bot', displayName:'Aguila', avatarColor:'#4f46e5', sprite:'/logo.png', text:answer, ts:Date.now() }
    setChatMessages(prev => [...prev.slice(0,-1), aguilaMsg])
    channelRef.current.send({ type:'broadcast', event:'chat', payload:aguilaMsg })
  }, [userId, localName, localSprite, avatarColor, wakeUp])

  const setMovement = useCallback((key, isDown) => {
    keysRef.current[key] = isDown
    if (isDown) wakeUp()
  }, [wakeUp])

  const setGlobalMusic = useCallback((payload) => {
    setGlobalMusicState(prev => ({ ...prev, ...payload }))
    if (channelRef.current) channelRef.current.send({ type:'broadcast', event:'music', payload })
  }, [])

  const sendEmote = useCallback((emote) => {
    if (!channelRef.current || !userId) return
    setActiveEmotes(prev => ({ ...prev, [userId]: emote }))
    setTimeout(() => setActiveEmotes(prev => { const n={...prev}; delete n[userId]; return n }), EMOTE_DURATION)
    channelRef.current.send({ type:'broadcast', event:'emote', payload:{ userId, emote } })
  }, [userId])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return
      keysRef.current[e.key] = true
      wakeUp()
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const onKeyUp = (e) => {
      if (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return
      keysRef.current[e.key] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const loop = () => {
      const keys = keysRef.current
      let { x, y } = myPositionRef.current
      let moved = false
      const maxX = ROOM_WIDTH - AVATAR_SIZE, maxY = ROOM_HEIGHT - AVATAR_SIZE

      if (keys['w'] || keys['W'] || keys['ArrowUp'])    { y = Math.max(0, y-MOVE_SPEED); moved = true }
      if (keys['s'] || keys['S'] || keys['ArrowDown'])  { y = Math.min(maxY, y+MOVE_SPEED); moved = true }
      if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { x = Math.max(0, x-MOVE_SPEED); moved = true }
      if (keys['d'] || keys['D'] || keys['ArrowRight']) { x = Math.min(maxX, x+MOVE_SPEED); moved = true }

      if (moved) { myPositionRef.current = { x, y }; setMyPosition({ x, y }) }

      if (moved !== movingRef.current) { movingRef.current = moved; setIsMoving(moved) }

      broadcastPosition(myPositionRef.current.x, myPositionRef.current.y, moved, isIdle)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      cancelAnimationFrame(animFrameRef.current)
      clearTimeout(broadcastTimerRef.current)
    }
  }, [broadcastPosition, wakeUp, isIdle])

  useEffect(() => {
    if (!loungeCode || !userId) return

    const channel = supabase.channel(`lounge:${loungeCode}`, {
      config:{ broadcast:{ self:false, ack:false }, presence:{ key:userId } },
    })
    channelRef.current = channel

    channel.on('presence', { event:'sync' }, () => {
      const list = Object.values(channel.presenceState()).flat()
      setPresenceList(list)
      setOtherUsers(prev => {
        const next = { ...prev }
        list.forEach(u => {
          if (u.userId === userId) return
          next[u.userId] = { ...(next[u.userId]||{}), displayName:u.displayName, avatarColor:u.avatarColor, sprite:u.sprite }
        })
        const activeIds = new Set(list.map(u => u.userId))
        Object.keys(next).forEach(id => { if (!activeIds.has(id)) delete next[id] })
        return next
      })
    })

    channel.on('broadcast', { event:'position' }, ({ payload }) => {
      if (payload.userId === userId) return
      setOtherUsers(prev => ({
        ...prev,
        [payload.userId]: { ...(prev[payload.userId]||{}), x:payload.x, y:payload.y, isIdle:payload.isIdle, isMoving:payload.isMoving||false },
      }))
    })

    channel.on('broadcast', { event:'chat' }, ({ payload }) => {
      if (payload.userId === userId) return
      setChatMessages(prev => [...prev.slice(-99), payload])
    })

    channel.on('broadcast', { event:'music' }, ({ payload }) => {
      setGlobalMusicState(prev => ({ ...prev, ...payload }))
    })

    channel.on('broadcast', { event:'emote' }, ({ payload }) => {
      if (payload.userId === userId) return
      setActiveEmotes(prev => ({ ...prev, [payload.userId]: payload.emote }))
      setTimeout(() => setActiveEmotes(prev => { const n={...prev}; delete n[payload.userId]; return n }), EMOTE_DURATION)
    })

    channel.on('broadcast', { event:'lounge_pdf' }, ({ payload }) => {
      if (payload.documentId) setLoungeDocument(payload.documentId)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        await channel.track({ userId, displayName:localName, avatarColor, sprite:localSprite, joinedAt:new Date().toISOString() })
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false)
    })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
      setIsConnected(false)
    }
  }, [loungeCode, userId, localName, localSprite, avatarColor, setLoungeDocument])

  const broadcastLoungePDF = useCallback((documentId) => {
    setLoungeDocument(documentId)
    if (channelRef.current) {
      channelRef.current.send({ type:'broadcast', event:'lounge_pdf', payload:{ documentId } })
    }
  }, [setLoungeDocument])

  return {
    myPosition, otherUsers, presenceList, chatMessages, sendChat,
    isConnected, isMoving,
    ROOM_WIDTH, ROOM_HEIGHT, AVATAR_SIZE,
    myMeta: { userId, displayName:localName, avatarColor, sprite:localSprite, isIdle },
    updateIdentity, setMovement,
    globalMusic, setGlobalMusic,
    loungeDocumentId, broadcastLoungePDF,
    activeEmotes, sendEmote,
  }
}