'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { askDocument } from '@/app/actions/chat'

const ROOM_WIDTH   = 1200 
const ROOM_HEIGHT  = 680
const AVATAR_SIZE  = 100
const MOVE_SPEED   = 4    
const BROADCAST_HZ = 20   

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#f97316']

function getAvatarColor(userId = '') {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function getDisplayName(email = '') { return email?.split('@')[0].slice(0, 12) || 'Guest' }

export function useLounge({ loungeCode, user }) {
  const channelRef = useRef(null)

  const myPositionRef = useRef({
    x: ROOM_WIDTH  / 2 - AVATAR_SIZE / 2,
    y: ROOM_HEIGHT / 2 - AVATAR_SIZE / 2,
  })
  const keysRef           = useRef({})      
  const animFrameRef      = useRef(null)    
  const broadcastTimerRef = useRef(null)    

  const [myPosition,    setMyPosition]    = useState(myPositionRef.current)
  const [otherUsers,    setOtherUsers]    = useState({})  
  const [presenceList,  setPresenceList]  = useState([])  
  const [chatMessages,  setChatMessages]  = useState([])  
  const [isConnected,   setIsConnected]   = useState(false)
  
  const [localName, setLocalName] = useState(getDisplayName(user?.email)) 
  const [localSprite, setLocalSprite] = useState('/sprites/char1.png') 

  const [isIdle, setIsIdle] = useState(false)
  const idleTimerRef = useRef(null)

  // 🌟 NEW: Synchronized Global Music State
  const [globalMusic, setGlobalMusicState] = useState({ url: '', isPlaying: true, time: 0 })

  const userId       = user?.id
  const avatarColor  = getAvatarColor(userId)

  const wakeUp = useCallback(() => {
    setIsIdle(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 60000)
  }, [])

  useEffect(() => {
    wakeUp()
    return () => clearTimeout(idleTimerRef.current)
  }, [wakeUp])

  const broadcastPosition = useCallback((x, y, currentIdleState) => {
    if (!channelRef.current) return
    if (broadcastTimerRef.current) return 

    channelRef.current.send({
      type:    'broadcast',
      event:   'position',
      payload: { userId, x, y, isIdle: currentIdleState },
    })

    broadcastTimerRef.current = setTimeout(() => {
      broadcastTimerRef.current = null
    }, 1000 / BROADCAST_HZ)
  }, [userId])

  const updateIdentity = async (newName, newSprite) => {
    if (!channelRef.current || !newName.trim()) return
    wakeUp()
    setLocalName(newName)
    setLocalSprite(newSprite)
    await channelRef.current.track({
      userId, displayName: newName, avatarColor, sprite: newSprite, joinedAt: new Date().toISOString(),
    })
  }

  const sendChat = useCallback(async (text) => {
    if (!channelRef.current || !text.trim()) return
    wakeUp() 
    const message = { userId, displayName: localName, avatarColor, sprite: localSprite, text: text.trim().slice(0, 300), ts: Date.now() }
    
    setChatMessages(prev => [...prev.slice(-99), message]) 
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: message })

    if (text.toLowerCase().startsWith('@aguila')) {
      const query = text.substring(7).trim()
      const res = await askDocument(query, null, userId) 
      if (res.success) {
        const aguilaMsg = { userId: 'aguila-bot', displayName: 'Aguila', avatarColor: '#4f46e5', sprite: '/logo.png', text: res.answer, ts: Date.now() }
        setChatMessages(prev => [...prev.slice(-99), aguilaMsg])
        channelRef.current.send({ type: 'broadcast', event: 'chat', payload: aguilaMsg })
      }
    }
  }, [userId, localName, localSprite, avatarColor, wakeUp])

  const setMovement = useCallback((key, isDown) => {
    keysRef.current[key] = isDown
    if (isDown) wakeUp()
  }, [wakeUp])

  // 🌟 NEW: Function to broadcast music changes to the entire room!
  const setGlobalMusic = useCallback((payload) => {
    setGlobalMusicState(prev => ({ ...prev, ...payload })) // Merge new state
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'music', payload })
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      keysRef.current[e.key] = true
      wakeUp() 
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault()
    }
    const handleKeyUp = (e) => { 
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      keysRef.current[e.key] = false 
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup',   handleKeyUp)

    const loop = () => {
      const keys = keysRef.current
      let { x, y } = myPositionRef.current
      let moved = false
      const maxX = ROOM_WIDTH  - AVATAR_SIZE, maxY = ROOM_HEIGHT - AVATAR_SIZE

      if (keys['w'] || keys['W'] || keys['ArrowUp'])    { y = Math.max(0, y - MOVE_SPEED); moved = true }
      if (keys['s'] || keys['S'] || keys['ArrowDown'])  { y = Math.min(maxY, y + MOVE_SPEED); moved = true }
      if (keys['a'] || keys['A'] || keys['ArrowLeft'])  { x = Math.max(0, x - MOVE_SPEED); moved = true }
      if (keys['d'] || keys['D'] || keys['ArrowRight']) { x = Math.min(maxX, x + MOVE_SPEED); moved = true }

      if (moved) { myPositionRef.current = { x, y }; setMyPosition({ x, y }) }
      broadcastPosition(myPositionRef.current.x, myPositionRef.current.y, isIdle)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup',   handleKeyUp)
      cancelAnimationFrame(animFrameRef.current)
      clearTimeout(broadcastTimerRef.current)
    }
  }, [broadcastPosition, wakeUp, isIdle])

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
      setOtherUsers(prev => ({ ...prev, [payload.userId]: { ...(prev[payload.userId] || {}), x: payload.x, y: payload.y, isIdle: payload.isIdle } }))
    })

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload.userId === userId) return 
      setChatMessages(prev => [...prev.slice(-99), payload])
    })

    // 🌟 NEW: Listen for music updates from other users!
    channel.on('broadcast', { event: 'music' }, ({ payload }) => {
    setGlobalMusicState(prev => ({ ...prev, ...payload }))
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
  }, [loungeCode, userId, localName, localSprite, avatarColor])

  return {
    myPosition, otherUsers, presenceList, chatMessages, sendChat, isConnected,
    ROOM_WIDTH, ROOM_HEIGHT, AVATAR_SIZE,
    myMeta: { userId, displayName: localName, avatarColor, sprite: localSprite, isIdle },
    updateIdentity, setMovement,
    globalMusic, setGlobalMusic // 🌟 Exporting the Music Sync tools
  }
}