'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateLoungeQuiz, askAguila, detectQuizCount } from '@/app/actions/loungeQuiz'

const ROOM_WIDTH   = 1200
const ROOM_HEIGHT  = 680
const AVATAR_SIZE  = 100
const MOVE_SPEED   = 4
const BROADCAST_HZ = 20

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#10b981','#3b82f6','#f97316']

function getAvatarColor(uid = '') {
  let h = 0; for (const c of uid) h = uid.charCodeAt(0) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function getDisplayName(email = '') { return email?.split('@')[0].slice(0, 12) || 'Guest' }

export function useLounge({ loungeCode, user }) {
  const channelRef        = useRef(null)
  const myPositionRef     = useRef({ x: ROOM_WIDTH/2 - AVATAR_SIZE/2, y: ROOM_HEIGHT/2 - AVATAR_SIZE/2 })
  const keysRef           = useRef({})
  const animFrameRef      = useRef(null)
  const broadcastTimerRef = useRef(null)
  const movingRef         = useRef(false) // track without re-render on every frame

  const [myPosition,   setMyPosition]   = useState(myPositionRef.current)
  const [otherUsers,   setOtherUsers]   = useState({})
  const [presenceList, setPresenceList] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [isMoving,     setIsMoving]     = useState(false)
  const [localName,    setLocalName]    = useState(getDisplayName(user?.email))
  const [localSprite,  setLocalSprite]  = useState('/sprites/char1.png')
  const [isIdle,       setIsIdle]       = useState(false)
  const idleTimerRef = useRef(null)

  // Document context: set when a PDF is uploaded to the lounge
  const [loungeDocumentId, setLoungeDocumentId] = useState(null)
  const loungeDocRef = useRef(null) // ref so sendChat closure always has latest value

  const [globalMusic, setGlobalMusicState] = useState({ url: '', isPlaying: true, time: 0 })

  const userId      = user?.id
  const avatarColor = getAvatarColor(userId)

  // Expose a setter that also updates the ref
  const setLoungeDocument = useCallback((docId) => {
    setLoungeDocumentId(docId)
    loungeDocRef.current = docId
  }, [])

  const wakeUp = useCallback(() => {
    setIsIdle(false)
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 60000)
  }, [])

  useEffect(() => { wakeUp(); return () => clearTimeout(idleTimerRef.current) }, [wakeUp])

  // ── Broadcast my position ──────────────────────────────────────────
  const broadcastPosition = useCallback((x, y, moving, idleState) => {
    if (!channelRef.current || broadcastTimerRef.current) return
    channelRef.current.send({
      type: 'broadcast', event: 'position',
      payload: { userId, x, y, isIdle: idleState, isMoving: moving },
    })
    broadcastTimerRef.current = setTimeout(() => { broadcastTimerRef.current = null }, 1000 / BROADCAST_HZ)
  }, [userId])

  const updateIdentity = useCallback(async (newName, newSprite) => {
    if (!channelRef.current || !newName.trim()) return
    wakeUp()
    setLocalName(newName)
    setLocalSprite(newSprite)
    await channelRef.current.track({ userId, displayName: newName, avatarColor, sprite: newSprite, joinedAt: new Date().toISOString() })
  }, [channelRef, userId, avatarColor, wakeUp])

  // ── Send chat — handles @aguila mentions and quiz generation ───────
  const sendChat = useCallback(async (text, chatHistorySnapshot = []) => {
    if (!channelRef.current || !text.trim()) return
    wakeUp()

    const userMsg = {
      userId, displayName: localName, avatarColor,
      sprite: localSprite, text: text.trim().slice(0, 500), ts: Date.now(),
    }

    // Only add user messages from actual users (not system calls)
    if (typeof text === 'string') {
      setChatMessages(prev => [...prev.slice(-99), userMsg])
      channelRef.current.send({ type: 'broadcast', event: 'chat', payload: userMsg })
    }

    // ── @aguila handler ───────────────────────────────────────────────
    if (text.toLowerCase().includes('@aguila')) {
      const query = text.replace(/@aguila/gi, '').trim()

      // "Thinking..." acknowledgement
      const thinkMsg = {
        userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5',
        sprite: '/logo.png', text: 'Let me look into that...', ts: Date.now(),
      }
      setChatMessages(prev => [...prev.slice(-99), thinkMsg])
      channelRef.current.send({ type: 'broadcast', event: 'chat', payload: thinkMsg })

      // Ask the AI
      const res = await askAguila({
        question: query,
        documentId: loungeDocRef.current || null,
        userId,
        chatHistory: chatHistorySnapshot,
      })

      if (!res.success) {
        const errMsg = { userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5', sprite: '/logo.png', text: 'Sorry, I ran into an error. Please try again.', ts: Date.now() }
        setChatMessages(prev => [...prev.slice(-98), errMsg])
        channelRef.current.send({ type: 'broadcast', event: 'chat', payload: errMsg })
        return
      }

      const answer = res.answer

      // ── Quiz trigger detected ────────────────────────────────────
      const quizMatch = answer.match(/\[QUIZ_REQUEST:([^\]]+)\]/)
      if (quizMatch) {
        const rawCount = quizMatch[1].trim()
        const count = rawCount === 'auto' ? 'auto' : parseInt(rawCount) || 10

        const genMsg = {
          userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5',
          sprite: '/logo.png',
          text: count === 'auto'
            ? 'Generating a full-coverage quiz from your notes. This may take a moment for large documents...'
            : `Generating a ${count}-question quiz. Hang tight...`,
          ts: Date.now(),
        }
        // Replace the "thinking" message with this
        setChatMessages(prev => [...prev.slice(0, -1), genMsg])
        channelRef.current.send({ type: 'broadcast', event: 'chat', payload: genMsg })

        // Generate quiz
        const quizRes = await generateLoungeQuiz({
          userId,
          documentId: loungeDocRef.current || null,
          requestedCount: count,
          topic: query,
        })

        if (quizRes.success) {
          const doneMsg = {
            userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5',
            sprite: '/logo.png',
            text: `I created a ${quizRes.count}-question quiz for the room! [TAKE_QUIZ:${quizRes.quizId}]`,
            ts: Date.now(),
          }
          setChatMessages(prev => [...prev.slice(-99), doneMsg])
          channelRef.current.send({ type: 'broadcast', event: 'chat', payload: doneMsg })
        } else {
          const failMsg = { userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5', sprite: '/logo.png', text: `Failed to generate quiz: ${quizRes.error}`, ts: Date.now() }
          setChatMessages(prev => [...prev.slice(-99), failMsg])
          channelRef.current.send({ type: 'broadcast', event: 'chat', payload: failMsg })
        }
        return
      }

      // Normal answer
      const aguilaMsg = {
        userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5',
        sprite: '/logo.png', text: answer, ts: Date.now(),
      }
      // Replace the "thinking" message
      setChatMessages(prev => [...prev.slice(0, -1), aguilaMsg])
      channelRef.current.send({ type: 'broadcast', event: 'chat', payload: aguilaMsg })
    }
  }, [userId, localName, localSprite, avatarColor, wakeUp])

  const setMovement = useCallback((key, isDown) => {
    keysRef.current[key] = isDown
    if (isDown) wakeUp()
  }, [wakeUp])

  const setGlobalMusic = useCallback((payload) => {
    setGlobalMusicState(prev => ({ ...prev, ...payload }))
    if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'music', payload })
  }, [])

  // ── Game loop — movement + walking animation ───────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      keysRef.current[e.key] = true
      wakeUp()
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const onKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      keysRef.current[e.key] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const loop = () => {
      const keys = keysRef.current
      let { x, y } = myPositionRef.current
      let moved = false
      const maxX = ROOM_WIDTH - AVATAR_SIZE
      const maxY = ROOM_HEIGHT - AVATAR_SIZE

      if (keys['w'] || keys['W'] || keys['ArrowUp'])    { y = Math.max(0, y - MOVE_SPEED); moved = true }
      if (keys['s'] || keys['S'] || keys['ArrowDown'])  { y = Math.min(maxY, y + MOVE_SPEED); moved = true }
      if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { x = Math.max(0, x - MOVE_SPEED); moved = true }
      if (keys['d'] || keys['D'] || keys['ArrowRight']) { x = Math.min(maxX, x + MOVE_SPEED); moved = true }

      if (moved) {
        myPositionRef.current = { x, y }
        setMyPosition({ x, y })
      }

      // Only update isMoving state when it actually changes — avoids constant re-renders
      if (moved !== movingRef.current) {
        movingRef.current = moved
        setIsMoving(moved)
      }

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

  // ── Supabase Realtime ──────────────────────────────────────────────
  useEffect(() => {
    if (!loungeCode || !userId) return

    const channel = supabase.channel(`lounge:${loungeCode}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: userId } },
    })
    channelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      const list = Object.values(channel.presenceState()).flat()
      setPresenceList(list)
      setOtherUsers(prev => {
        const next = { ...prev }
        list.forEach(u => {
          if (u.userId === userId) return
          next[u.userId] = { ...(next[u.userId] || {}), displayName: u.displayName, avatarColor: u.avatarColor, sprite: u.sprite }
        })
        const activeIds = new Set(list.map(u => u.userId))
        Object.keys(next).forEach(id => { if (!activeIds.has(id)) delete next[id] })
        return next
      })
    })

    channel.on('broadcast', { event: 'position' }, ({ payload }) => {
      if (payload.userId === userId) return
      setOtherUsers(prev => ({
        ...prev,
        [payload.userId]: {
          ...(prev[payload.userId] || {}),
          x: payload.x, y: payload.y,
          isIdle: payload.isIdle,
          isMoving: payload.isMoving || false, // ← receive walking state from others
        },
      }))
    })

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.userId === userId) return
      setChatMessages(prev => [...prev.slice(-99), payload])
    })

    channel.on('broadcast', { event: 'music' }, ({ payload }) => {
      setGlobalMusicState(prev => ({ ...prev, ...payload }))
    })

    // PDF uploaded to lounge — sync document ID to all users
    channel.on('broadcast', { event: 'lounge_pdf' }, ({ payload }) => {
      if (payload.documentId) setLoungeDocument(payload.documentId)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true)
        await channel.track({ userId, displayName: localName, avatarColor, sprite: localSprite, joinedAt: new Date().toISOString() })
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

  // ── Broadcast lounge PDF to room when set ─────────────────────────
  const broadcastLoungePDF = useCallback((documentId) => {
    setLoungeDocument(documentId)
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'lounge_pdf', payload: { documentId } })
    }
  }, [setLoungeDocument])

  return {
    myPosition, otherUsers, presenceList, chatMessages, sendChat,
    isConnected, isMoving,
    ROOM_WIDTH, ROOM_HEIGHT, AVATAR_SIZE,
    myMeta: { userId, displayName: localName, avatarColor, sprite: localSprite, isIdle },
    updateIdentity, setMovement,
    globalMusic, setGlobalMusic,
    loungeDocumentId, broadcastLoungePDF, // expose so page.js can set on PDF upload
  }
}