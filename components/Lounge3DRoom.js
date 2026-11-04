'use client'

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import * as THREE from 'three'
import {
  playFootstepSound,
  playInteractSound,
  playCoffeeBrewSound,
  playPetSound,
  playSnackSound,
  playSitSound,
  isLoungeSoundEnabled,
  toggleLoungeSound,
} from './LoungeAudio'

// ─────────────────────────────────────────────────────────────────────────────
// 3D WORLD COORDINATE CONSTANTS (Spacious 36 x 28 Room)
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_HALF_WIDTH = 18.0
const ROOM_HALF_DEPTH = 14.0
const PLAYER_SPEED = 0.18
const ROT_SPEED = 0.22

// Teleport destination coordinates (Safe open landing spots in front of furniture)
export const TELEPORT_DESTINATIONS = {
  sofa: { x: -8.0, z: 5.0, name: 'Lounge Sofa', icon: '🛋️' },
  couch: { x: -8.0, z: 5.0, name: 'Lounge Sofa', icon: '🛋️' },
  vault: { x: -9.0, z: -9.0, name: 'Study Vault', icon: '📚' },
  books: { x: -9.0, z: -9.0, name: 'Study Vault', icon: '📚' },
  shelf: { x: -9.0, z: -9.0, name: 'Study Vault', icon: '📚' },
  study: { x: -9.0, z: -9.0, name: 'Study Vault', icon: '📚' },
  bar: { x: 5.0, z: -9.0, name: 'Barista Counter', icon: '☕' },
  coffee: { x: 5.0, z: -9.0, name: 'Barista Counter', icon: '☕' },
  barista: { x: 5.0, z: -9.0, name: 'Barista Counter', icon: '☕' },
  pup: { x: 13.0, z: -9.0, name: 'Cozy Aguila Pup', icon: '🐶' },
  dog: { x: 13.0, z: -9.0, name: 'Cozy Aguila Pup', icon: '🐶' },
  pet: { x: 13.0, z: -9.0, name: 'Cozy Aguila Pup', icon: '🐶' },
  cake: { x: 8.0, z: 3.5, name: 'Strawberry Cake', icon: '🍰' },
  dining: { x: 8.0, z: 3.5, name: 'Strawberry Cake', icon: '🍰' },
  table: { x: 8.0, z: 3.5, name: 'Strawberry Cake', icon: '🍰' },
  fire: { x: -14.0, z: 0.0, name: 'Stone Fireplace', icon: '🔥' },
  fireplace: { x: -14.0, z: 0.0, name: 'Stone Fireplace', icon: '🔥' },
  hearth: { x: -14.0, z: 0.0, name: 'Stone Fireplace', icon: '🔥' },
  jukebox: { x: 14.0, z: 1.5, name: 'Lofi Jukebox', icon: '🎵' },
  music: { x: 14.0, z: 1.5, name: 'Lofi Jukebox', icon: '🎵' },
  hall: { x: 14.0, z: -4.5, name: 'Hall of Fame', icon: '🏆' },
  fame: { x: 14.0, z: -4.5, name: 'Hall of Fame', icon: '🏆' },
  rank: { x: 14.0, z: -4.5, name: 'Hall of Fame', icon: '🏆' },
  center: { x: 0.0, z: 0.0, name: 'Center Plaza', icon: '✨' },
  spawn: { x: 0.0, z: 0.0, name: 'Center Plaza', icon: '✨' },
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL CANVAS TEXTURES
// ─────────────────────────────────────────────────────────────────────────────

/** Polished warm oak hardwood floor planks */
function createWoodFloorTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#c59b6d'
  ctx.fillRect(0, 0, 512, 512)

  const plankH = 32
  const rows = 512 / plankH
  for (let r = 0; r < rows; r++) {
    const y = r * plankH
    const shade = (Math.sin(r * 2.8) * 0.05)
    ctx.fillStyle = shade >= 0 ? `rgba(255, 255, 255, ${shade})` : `rgba(0, 0, 0, ${-shade})`
    ctx.fillRect(0, y, 512, plankH)

    ctx.strokeStyle = '#8b5a2b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()

    const offset = (r % 3) * 85
    for (let c = 0; c < 5; c++) {
      const x = ((c * 128 + offset) % 512)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + plankH)
      ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Sunflower Rug Canvas Texture */
function createSunflowerRugTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const cx = 128, cy = 128
  ctx.fillStyle = '#facc15'
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16
    const px = cx + Math.cos(angle) * 78
    const py = cy + Math.sin(angle) * 78
    ctx.beginPath()
    ctx.arc(px, py, 34, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.arc(cx, cy, 70, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#78350f'
  ctx.beginPath()
  ctx.arc(cx, cy, 48, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#a16207'
  for (let d = 0; d < 45; d++) {
    const rad = Math.random() * 40
    const ang = Math.random() * Math.PI * 2
    ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 3, 3)
  }

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

/** Cute Chibi Eye Texture with dual glints */
function createChibiEyeTexture(color = '#6366f1') {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(64, 64, 46, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#1e1b4b'
  ctx.beginPath()
  ctx.arc(64, 64, 28, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(52, 50, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(76, 74, 7, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

/** Doggo glossy eye texture */
function createDogEyeTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, 128, 128)

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(48, 44, 22, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(84, 80, 10, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D INTERACTIVE STATIONS DATA (Configured for 36x28 room)
// ─────────────────────────────────────────────────────────────────────────────
const STATIONS_3D = [
  {
    id: 'vault',
    name: 'Study Vault',
    desc: 'Grand Archive & Flashcards',
    icon: '📚',
    x: -9.0,
    z: -11.0,
    radius: 3.8,
    prompt: '[E] Open Flashcards',
    category: 'study',
  },
  {
    id: 'coffeebar',
    name: 'Barista Counter',
    desc: 'Brew Matcha / Espresso',
    icon: '☕',
    x: 5.0,
    z: -11.0,
    radius: 3.8,
    prompt: '[E] Brew Fresh Coffee',
    category: 'boost',
  },
  {
    id: 'petdoggo',
    name: 'Cozy Aguila Pup',
    desc: 'Adorable & Wiggling',
    icon: '🐶',
    x: 14.5,
    z: -10.5,
    radius: 3.8,
    prompt: '[E] Pet Aguila Doggo',
    category: 'pet',
  },
  {
    id: 'sofa_lounge',
    name: 'Lounge Sofa',
    desc: 'Sit & Focus',
    icon: '🛋️',
    x: -8.0,
    z: 7.5,
    radius: 3.8,
    prompt: '[E] Sit on Sofa',
    category: 'seat',
    seatX: -8.0,
    seatZ: 8.5,
    seatRot: 0,
  },
  {
    id: 'dining_cake',
    name: 'Strawberry Cake',
    desc: 'Sweet study fuel',
    icon: '🍰',
    x: 8.0,
    z: 6.0,
    radius: 3.8,
    prompt: '[E] Eat Cake Slice',
    category: 'snack',
  },
  {
    id: 'fireplace',
    name: 'Stone Hearth',
    desc: 'Warm crackling fireplace',
    icon: '🔥',
    x: -16.0,
    z: 0.0,
    radius: 3.8,
    prompt: '[E] Warm by Fireplace',
    category: 'fire',
  },
  {
    id: 'jukebox',
    name: 'Lofi Jukebox',
    desc: 'Study soundtrack',
    icon: '🎵',
    x: 16.0,
    z: 1.5,
    radius: 3.2,
    prompt: '[E] Change Music',
    category: 'music',
  },
  {
    id: 'leaderboard',
    name: 'Hall of Fame',
    desc: 'Room records',
    icon: '🏆',
    x: 16.0,
    z: -4.5,
    radius: 3.2,
    prompt: '[E] View Room Rank',
    category: 'rank',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 3D COLLISION AABB OBSTACLES (Generous clearances, no sofa trapping)
// ─────────────────────────────────────────────────────────────────────────────
const OBSTACLES_3D = [
  // Outer walls
  { minX: -19.5, maxX: 19.5, minZ: -16.0, maxZ: -13.5 }, // Back wall
  { minX: -19.5, maxX: 19.5, minZ: 13.5, maxZ: 16.0 },   // Front boundary
  { minX: -20.0, maxX: -17.5, minZ: -16.0, maxZ: 16.0 }, // Left wall
  { minX: 17.5, maxX: 20.0, minZ: -16.0, maxZ: 16.0 },   // Right wall

  // Study vault bookcases & study table
  { minX: -15.5, maxX: -3.0, minZ: -14.0, maxZ: -10.5 },

  // Barista counter
  { minX: 1.0, maxX: 9.0, minZ: -14.0, maxZ: -10.8 },

  // Fireplace & chimney
  { minX: -18.5, maxX: -15.0, minZ: -2.8, maxZ: 2.8 },

  // Velvet sofa: backrest & arms ONLY (cushion front is completely open)
  { minX: -11.5, maxX: -4.5, minZ: 9.3, maxZ: 10.4 }, // Backrest
  { minX: -11.5, maxX: -10.4, minZ: 7.2, maxZ: 9.3 }, // Left arm
  { minX: -5.6, maxX: -4.5, minZ: 7.2, maxZ: 9.3 },   // Right arm
  { minX: -9.8, maxX: -6.2, minZ: 5.6, maxZ: 6.8 },   // Coffee table

  // Dining table & chairs
  { minX: 5.6, maxX: 10.4, minZ: 4.2, maxZ: 8.2 },

  // Doghouse / Pet corner
  { minX: 14.0, maxX: 17.5, minZ: -14.0, maxZ: -11.8 },
]

function checkCollision3D(x, z, radius = 0.45) {
  for (const obs of OBSTACLES_3D) {
    if (
      x + radius > obs.minX &&
      x - radius < obs.maxX &&
      z + radius > obs.minZ &&
      z - radius < obs.maxZ
    ) {
      return true
    }
  }
  return false
}

/** If player ever finds themselves intersecting an obstacle, safely pop them to open floor */
function unstuckPlayer(pState) {
  for (let r = 0.15; r <= 1.2; r += 0.25) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const tx = pState.x + Math.cos(a) * r
      const tz = pState.z + Math.sin(a) * r
      if (!checkCollision3D(tx, tz, 0.4)) {
        pState.x = tx
        pState.z = tz
        pState.isMoving = true
        return
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Lounge3DRoom = forwardRef(function Lounge3DRoom(
  {
    myPosition,
    setMyPosition,
    otherUsers = {},
    myMeta = {},
    isMoving = false,
    setMovement,
    activeEmotes = {},
    chatMessages = [],
    onOpenFlashcards,
    onOpenQuiz,
    onOpenMusic,
    onOpenPomodoro,
    onOpenLeaderboard,
    onBroadcastBuff,
    token,
  },
  ref
) {
  const mountRef = useRef(null)
  const [activeStation, setActiveStation] = useState(null)
  const [isSitting, setIsSitting] = useState(false)
  const [dogHappy, setDogHappy] = useState(false)
  const [coffeeBuff, setCoffeeBuff] = useState(false)
  const [snackToast, setSnackToast] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 })

  // 3D Player State Ref
  const player3DRef = useRef({
    x: 0,
    z: 2.5,
    rotation: 0,
    targetX: null,
    targetZ: null,
    isMoving: false,
    hopPhase: 0,
    sitState: false,
  })

  // Keyboard continuous state ref
  const keysDownRef = useRef({})

  // Orbit camera drag state
  const orbitRef = useRef({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    azimuth: 0,
    distance: 28,
  })

  const dogMeshRef = useRef(null)
  const steamParticlesRef = useRef([])
  const targetRingMeshRef = useRef(null)
  const fireLightRef = useRef(null)
  const cameraRef = useRef(null)
  const posSyncTimerRef = useRef(0)

  // Stand up helper: cleanly exits seat and pops onto open floor in front of sofa
  const standUp = useCallback(() => {
    setIsSitting(false)
    if (player3DRef.current) {
      player3DRef.current.sitState = false
      player3DRef.current.x = -8.0
      player3DRef.current.z = 4.8
      player3DRef.current.targetX = null
      player3DRef.current.targetZ = null
    }
  }, [])

  // Expose imperative handle for chat /tp commands
  useImperativeHandle(ref, () => ({
    teleport: (destKey) => {
      const dest = TELEPORT_DESTINATIONS[destKey?.toLowerCase()]
      if (!dest) return false
      standUp()
      if (player3DRef.current) {
        player3DRef.current.x = dest.x
        player3DRef.current.z = dest.z
        player3DRef.current.targetX = null
        player3DRef.current.targetZ = null
      }
      playInteractSound()
      setSnackToast(`⚡ Teleported to ${dest.name}!`)
      setTimeout(() => setSnackToast(null), 3000)
      return true
    },
    standUp,
  }), [standUp])

  // Speech bubble tracker
  const speechBubbles = useMemo(() => {
    const bubbles = {}
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i]
      if (msg?.userId && !bubbles[msg.userId] && msg.text && !msg.text.startsWith('[')) {
        bubbles[msg.userId] = { text: msg.text, ts: msg.ts || i }
      }
    }
    return bubbles
  }, [chatMessages])

  // Station trigger execution
  const executeStation = useCallback((station) => {
    if (!station) return
    playInteractSound()

    switch (station.category) {
      case 'study':
        if (onOpenFlashcards) onOpenFlashcards()
        break
      case 'boost':
        playCoffeeBrewSound()
        setCoffeeBuff(true)
        if (onBroadcastBuff) onBroadcastBuff('☕ Fresh 3D Espresso brewed (+10 Focus)!')
        setTimeout(() => setCoffeeBuff(false), 7000)
        break
      case 'pet':
        playPetSound()
        setDogHappy(true)
        if (onBroadcastBuff) onBroadcastBuff('🐶 Aguila pup is joyfully barking & wagging!')
        setTimeout(() => setDogHappy(false), 4500)
        break
      case 'seat':
        playSitSound()
        setIsSitting(true)
        player3DRef.current.sitState = true
        player3DRef.current.x = station.seatX
        player3DRef.current.z = station.seatZ
        player3DRef.current.rotation = station.seatRot || 0
        player3DRef.current.targetX = null
        player3DRef.current.targetZ = null
        if (onOpenPomodoro) onOpenPomodoro()
        break
      case 'snack':
        playSnackSound()
        setSnackToast('🍰 *crunch munch* Strawberry Shortcake! +5 Study Energy')
        setTimeout(() => setSnackToast(null), 3500)
        break
      case 'fire':
        playInteractSound()
        setSnackToast('🔥 Warm crackling fireplace cozy focus!')
        setTimeout(() => setSnackToast(null), 3000)
        break
      case 'music':
        if (onOpenMusic) onOpenMusic()
        break
      case 'rank':
        if (onOpenLeaderboard) onOpenLeaderboard()
        break
      default:
        break
    }
  }, [onOpenFlashcards, onOpenPomodoro, onOpenMusic, onOpenLeaderboard, onBroadcastBuff])

  // Keyboard WASD & Arrow Key Movement Handler (Clean Input Protection)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        keysDownRef.current = {}
        return
      }
      const k = e.key.toLowerCase()
      keysDownRef.current[k] = true

      if (k === 'e' || e.key === ' ') {
        if (isSitting) {
          standUp()
          e.preventDefault()
          return
        }
        if (activeStation) {
          e.preventDefault()
          executeStation(activeStation)
        }
      }

      if (e.key === 'Escape' && isSitting) {
        standUp()
      }

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
        if (isSitting) {
          standUp()
        }
        player3DRef.current.targetX = null
        player3DRef.current.targetZ = null
      }
    }

    const onKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        keysDownRef.current = {}
        return
      }
      const k = e.key.toLowerCase()
      keysDownRef.current[k] = false
    }

    const onBlur = () => {
      keysDownRef.current = {}
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [activeStation, isSitting, executeStation, standUp])

  // Footstep audio loop while walking
  useEffect(() => {
    if (!isMoving) return
    const interval = setInterval(() => {
      playFootstepSound()
    }, 280)
    return () => clearInterval(interval)
  }, [isMoving])

  // ─────────────────────────────────────────────────────────────────────────
  // THREE.JS SCENE CREATION & RENDER LOOP
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#121217')
    scene.fog = new THREE.FogExp2('#121217', 0.014)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
    camera.position.set(0, 22, 28)
    camera.lookAt(0, 1.2, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    container.appendChild(renderer.domElement)

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight('#fff3e0', 0.65)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight('#fffbeb', 1.35)
    sunLight.position.set(16, 26, 14)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 80
    sunLight.shadow.camera.left = -22
    sunLight.shadow.camera.right = 22
    sunLight.shadow.camera.top = 22
    sunLight.shadow.camera.bottom = -22
    sunLight.shadow.bias = -0.0004
    scene.add(sunLight)

    const blueFill = new THREE.DirectionalLight('#93c5fd', 0.35)
    blueFill.position.set(-18, 14, -18)
    scene.add(blueFill)

    // Fireplace point light (animated flickering)
    const fireLight = new THREE.PointLight('#f97316', 2.0, 14, 1.8)
    fireLight.position.set(-15.5, 2.2, 0)
    scene.add(fireLight)
    fireLightRef.current = fireLight

    // 3. Procedural Oak Hardwood Floor (36 x 28)
    const woodTex = createWoodFloorTexture()
    if (woodTex) {
      woodTex.repeat.set(9, 7)
    }
    const floorGeo = new THREE.PlaneGeometry(ROOM_HALF_WIDTH * 2, ROOM_HALF_DEPTH * 2)
    const floorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.38,
      metalness: 0.08,
    })
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.y = 0
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // Center Plaza Medallion Inlay
    const medallionGeo = new THREE.RingGeometry(0.1, 4.2, 32)
    const medallionMat = new THREE.MeshStandardMaterial({
      color: '#b48554',
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
    })
    const medallionMesh = new THREE.Mesh(medallionGeo, medallionMat)
    medallionMesh.rotation.x = -Math.PI / 2
    medallionMesh.position.set(0, 0.005, 0)
    medallionMesh.receiveShadow = true
    scene.add(medallionMesh)

    // 4. Architectural Walls (Back, Left, Right)
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#f4ede4',
      roughness: 0.88,
      metalness: 0.02,
    })
    const baseboardMat = new THREE.MeshStandardMaterial({
      color: '#451a03',
      roughness: 0.5,
    })

    // Back Wall
    const backWallGeo = new THREE.BoxGeometry(ROOM_HALF_WIDTH * 2 + 1, 10, 0.6)
    const backWall = new THREE.Mesh(backWallGeo, wallMat)
    backWall.position.set(0, 5, -ROOM_HALF_DEPTH - 0.3)
    backWall.receiveShadow = true
    scene.add(backWall)

    const baseboardBack = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_HALF_WIDTH * 2 + 1, 0.45, 0.7),
      baseboardMat
    )
    baseboardBack.position.set(0, 0.225, -ROOM_HALF_DEPTH - 0.25)
    scene.add(baseboardBack)

    // Left Wall
    const leftWallGeo = new THREE.BoxGeometry(0.6, 10, ROOM_HALF_DEPTH * 2 + 1)
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat)
    leftWall.position.set(-ROOM_HALF_WIDTH - 0.3, 5, 0)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    const baseboardLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.45, ROOM_HALF_DEPTH * 2 + 1),
      baseboardMat
    )
    baseboardLeft.position.set(-ROOM_HALF_WIDTH - 0.25, 0.225, 0)
    scene.add(baseboardLeft)

    // Right Wall
    const rightWallGeo = new THREE.BoxGeometry(0.6, 10, ROOM_HALF_DEPTH * 2 + 1)
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat)
    rightWall.position.set(ROOM_HALF_WIDTH + 0.3, 5, 0)
    rightWall.receiveShadow = true
    scene.add(rightWall)

    const baseboardRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.45, ROOM_HALF_DEPTH * 2 + 1),
      baseboardMat
    )
    baseboardRight.position.set(ROOM_HALF_WIDTH + 0.25, 0.225, 0)
    scene.add(baseboardRight)

    // 5. Large Architectural Skylight / Window on Back Wall
    const winFrameGeo = new THREE.BoxGeometry(7.0, 4.4, 0.2)
    const winFrameMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })
    const winFrame = new THREE.Mesh(winFrameGeo, winFrameMat)
    winFrame.position.set(0, 6.2, -ROOM_HALF_DEPTH + 0.05)
    scene.add(winFrame)

    const winGlassGeo = new THREE.PlaneGeometry(6.4, 3.8)
    const winGlassMat = new THREE.MeshBasicMaterial({ color: '#bfdbfe' })
    const winGlass = new THREE.Mesh(winGlassGeo, winGlassMat)
    winGlass.position.set(0, 6.2, -ROOM_HALF_DEPTH + 0.16)
    scene.add(winGlass)

    // 6. Grand Study Vault (3 Connected Bookcase Sections + Study Table)
    const shelfWoodMat = new THREE.MeshStandardMaterial({ color: '#5c3a21', roughness: 0.6 })
    const bookColors = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0284c7', '#ea580c', '#e11d48']

    // 3 Bookcases along back wall
    const shelfXPositions = [-12.5, -9.0, -5.5]
    shelfXPositions.forEach((sx) => {
      const bcGroup = new THREE.Group()
      bcGroup.position.set(sx, 0, -ROOM_HALF_DEPTH + 0.9)

      // Back panel
      const bp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.8, 0.12), shelfWoodMat)
      bp.position.set(0, 2.9, -0.45)
      bp.castShadow = true
      bp.receiveShadow = true
      bcGroup.add(bp)

      // Side planks
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.8, 1.0), shelfWoodMat)
      sideL.position.set(-1.55, 2.9, 0)
      sideL.castShadow = true
      bcGroup.add(sideL)

      const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.8, 1.0), shelfWoodMat)
      sideR.position.set(1.55, 2.9, 0)
      sideR.castShadow = true
      bcGroup.add(sideR)

      // Top & Base
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.18, 1.05), shelfWoodMat)
      top.position.set(0, 5.8, 0)
      top.castShadow = true
      bcGroup.add(top)

      const bot = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.25, 1.05), shelfWoodMat)
      bot.position.set(0, 0.125, 0)
      bot.castShadow = true
      bcGroup.add(bot)

      // 4 Shelves with 3D Books
      const shelfYLevels = [1.35, 2.7, 4.05, 5.3]
      shelfYLevels.forEach((sy, tierIdx) => {
        const shelfPlank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.95), shelfWoodMat)
        shelfPlank.position.set(0, sy, 0)
        shelfPlank.receiveShadow = true
        bcGroup.add(shelfPlank)

        // 8 to 10 books per shelf
        const numBooks = 8
        for (let b = 0; b < numBooks; b++) {
          const bW = 0.18 + (b % 3) * 0.05
          const bH = 0.85 + ((b + tierIdx) % 4) * 0.08
          const bD = 0.65
          const bMat = new THREE.MeshStandardMaterial({
            color: bookColors[(b * 3 + tierIdx) % bookColors.length],
            roughness: 0.45,
          })
          const book = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), bMat)
          const bX = -1.2 + b * 0.32
          book.position.set(bX, sy + bH / 2 + 0.05, -0.05)
          if (b % 4 === 1) book.rotation.z = 0.12
          book.castShadow = true
          bcGroup.add(book)
        }
      })
      scene.add(bcGroup)
    })

    // Study Desk in front of bookcases
    const studyDeskMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.5 })
    const studyDesk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.12, 1.6), studyDeskMat)
    studyDesk.position.set(-9.0, 1.3, -11.5)
    studyDesk.castShadow = true
    studyDesk.receiveShadow = true
    scene.add(studyDesk)

    // Desk legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.3, 8)
    const legMat = new THREE.MeshStandardMaterial({ color: '#27272a', metalness: 0.8, roughness: 0.2 })
    ;[
      [-12.0, -12.1], [-12.0, -10.9],
      [-6.0, -12.1], [-6.0, -10.9]
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(lx, 0.65, lz)
      leg.castShadow = true
      scene.add(leg)
    })

    // Laptops & Desk Lamp on study table
    const laptopMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.7, roughness: 0.3 })
    const laptop1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), laptopMat)
    laptop1.position.set(-10.2, 1.38, -11.5)
    scene.add(laptop1)

    const laptop2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), laptopMat)
    laptop2.position.set(-7.8, 1.38, -11.5)
    scene.add(laptop2)

    // Brass Study Lamp
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.85, roughness: 0.25 })
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 8), brassMat)
    lampStem.position.set(-9.0, 1.65, -11.7)
    scene.add(lampStem)
    const lampHood = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.2, 12, 1, true), brassMat)
    lampHood.position.set(-9.0, 2.0, -11.7)
    scene.add(lampHood)

    // 7. Stone Fireplace & Reading Nook (Left Wall)
    const fireplaceGroup = new THREE.Group()
    fireplaceGroup.position.set(-ROOM_HALF_WIDTH + 1.2, 0, 0)

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.9 })
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 3.4), stoneMat)
    chimney.position.set(0, 5, 0)
    chimney.castShadow = true
    fireplaceGroup.add(chimney)

    const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 3.8), shelfWoodMat)
    mantel.position.set(0.1, 3.5, 0)
    mantel.castShadow = true
    fireplaceGroup.add(mantel)

    const fireboxMat = new THREE.MeshBasicMaterial({ color: '#09090b' })
    const firebox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 2.2), fireboxMat)
    firebox.position.set(0.55, 1.0, 0)
    fireplaceGroup.add(firebox)

    const logMat = new THREE.MeshStandardMaterial({ color: '#713f12', roughness: 0.8 })
    const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 8), logMat)
    log1.rotation.x = Math.PI / 2
    log1.position.set(0.5, 0.2, 0)
    fireplaceGroup.add(log1)

    const coalMat = new THREE.MeshBasicMaterial({ color: '#ea580c' })
    for (let c = 0; c < 8; c++) {
      const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + (c % 3) * 0.04), coalMat)
      coal.position.set(0.5 + (Math.random() - 0.5) * 0.4, 0.15, (Math.random() - 0.5) * 1.0)
      fireplaceGroup.add(coal)
    }
    scene.add(fireplaceGroup)

    // Fireplace Plush Armchair
    const chairGroup = new THREE.Group()
    chairGroup.position.set(-14.5, 0, 2.2)
    chairGroup.rotation.y = -Math.PI / 3

    const chairFabricMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.7 })
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.6), chairFabricMat)
    chairSeat.position.set(0, 0.5, 0)
    chairSeat.castShadow = true
    chairGroup.add(chairSeat)

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 0.35), chairFabricMat)
    chairBack.position.set(0, 1.25, 0.7)
    chairBack.castShadow = true
    chairGroup.add(chairBack)
    scene.add(chairGroup)

    // 8. Barista Coffee & Boba Bar (Right-Back)
    const baristaGroup = new THREE.Group()
    baristaGroup.position.set(5.0, 0, -12.5)

    const counterBaseMat = new THREE.MeshStandardMaterial({ color: '#271b12', roughness: 0.6 })
    const counterTopMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25, metalness: 0.15 })

    const cBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.8, 1.8), counterBaseMat)
    cBase.position.set(0, 0.9, 0)
    cBase.castShadow = true
    cBase.receiveShadow = true
    baristaGroup.add(cBase)

    const cTop = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.15, 2.2), counterTopMat)
    cTop.position.set(0, 1.85, 0)
    cTop.castShadow = true
    cTop.receiveShadow = true
    baristaGroup.add(cTop)

    // 4 Turquoise Bar Stools in front of counter
    const stoolClothMat = new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.5 })
    ;[-2.4, -0.8, 0.8, 2.4].forEach((sx) => {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16), stoolClothMat)
      seat.position.set(sx, 1.25, 1.6)
      seat.castShadow = true
      baristaGroup.add(seat)

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), legMat)
      leg.position.set(sx, 0.6, 1.6)
      leg.castShadow = true
      baristaGroup.add(leg)
    })

    // Chrome Espresso Machine with dials & portafilters
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.92, roughness: 0.15 })
    const espBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.0), chromeMat)
    espBody.position.set(0, 2.5, -0.2)
    espBody.castShadow = true
    baristaGroup.add(espBody)

    const espCup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 12), new THREE.MeshStandardMaterial({ color: '#ffffff' }))
    espCup1.position.set(-0.35, 1.95, 0.4)
    baristaGroup.add(espCup1)
    const espCup2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 12), new THREE.MeshStandardMaterial({ color: '#ffffff' }))
    espCup2.position.set(0.35, 1.95, 0.4)
    baristaGroup.add(espCup2)

    // Pastry Display Glass Dome
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transmission: 0.9,
      opacity: 1,
      transparent: true,
      roughness: 0.05,
      ior: 1.5,
    })
    const cloche = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat)
    cloche.position.set(2.4, 1.95, 0.1)
    baristaGroup.add(cloche)
    scene.add(baristaGroup)

    // 3D Steam Particles rising from espresso machine
    const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })
    const steamParts = []
    for (let s = 0; s < 12; s++) {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 8, 8), steamMat.clone())
      sm.position.set(5.0 + (Math.random() - 0.5) * 0.4, 2.8 + Math.random() * 1.5, -12.5 + (Math.random() - 0.5) * 0.3)
      scene.add(sm)
      steamParts.push({
        mesh: sm,
        speed: 0.012 + Math.random() * 0.01,
        drift: (Math.random() - 0.5) * 0.003,
        initialY: 2.8,
      })
    }
    steamParticlesRef.current = steamParts

    // 9. Velvet Sofa Lounge (Front-Left Zone: X: -8.0, Z: 8.5)
    const sofaGroup = new THREE.Group()
    sofaGroup.position.set(-8.0, 0, 8.5)

    const velvetMat = new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.55 })
    const velvetDarkMat = new THREE.MeshStandardMaterial({ color: '#db2777', roughness: 0.6 })

    // Sofa Backrest
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.4, 0.7), velvetDarkMat)
    sofaBack.position.set(0, 1.1, 1.1)
    sofaBack.castShadow = true
    sofaGroup.add(sofaBack)

    // Sofa Seat Base
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 2.0), velvetMat)
    sofaBase.position.set(0, 0.35, 0)
    sofaBase.castShadow = true
    sofaBase.receiveShadow = true
    sofaGroup.add(sofaBase)

    // Left Armrest
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 2.2), velvetDarkMat)
    armL.position.set(-2.8, 0.65, 0.1)
    armL.castShadow = true
    sofaGroup.add(armL)

    // Right Armrest
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 2.2), velvetDarkMat)
    armR.position.set(2.8, 0.65, 0.1)
    armR.castShadow = true
    sofaGroup.add(armR)

    // Soft Pillows
    const pillowMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.7 })
    const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.25), pillowMat)
    pillow1.position.set(-2.2, 0.75, 0.7)
    pillow1.rotation.y = 0.25
    sofaGroup.add(pillow1)

    const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.25), pillowMat)
    pillow2.position.set(2.2, 0.75, 0.7)
    pillow2.rotation.y = -0.25
    sofaGroup.add(pillow2)

    // Low Wooden Coffee Table in front of sofa
    const coffeeTableMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.45 })
    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 1.3), coffeeTableMat)
    coffeeTable.position.set(0, 0.25, -2.2)
    coffeeTable.castShadow = true
    coffeeTable.receiveShadow = true
    sofaGroup.add(coffeeTable)

    // Sunflower Rug under sofa corner
    const rugTex = createSunflowerRugTexture()
    const sunflowerRug = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 32),
      new THREE.MeshStandardMaterial({
        map: rugTex,
        roughness: 0.85,
        transparent: true,
      })
    )
    sunflowerRug.rotation.x = -Math.PI / 2
    sunflowerRug.position.set(0, 0.008, -1.0)
    sunflowerRug.receiveShadow = true
    sofaGroup.add(sunflowerRug)
    scene.add(sofaGroup)

    // 10. Banquet & Celebration Dining Table with Strawberry Cake (Front-Right Zone)
    const diningGroup = new THREE.Group()
    diningGroup.position.set(8.0, 0, 6.0)

    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.15, 32),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25 })
    )
    tableTop.position.set(0, 1.5, 0)
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    diningGroup.add(tableTop)

    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 1.5, 16), legMat)
    tableBase.position.set(0, 0.75, 0)
    tableBase.castShadow = true
    diningGroup.add(tableBase)

    // 4 Dining Chairs around table
    const chairWoodMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.6 })
    const chairAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
    chairAngles.forEach((ang) => {
      const cg = new THREE.Group()
      cg.position.set(Math.cos(ang) * 3.0, 0, Math.sin(ang) * 3.0)
      cg.rotation.y = -ang + Math.PI

      const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), stoolClothMat)
      cSeat.position.set(0, 0.9, 0)
      cSeat.castShadow = true
      cg.add(cSeat)

      const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.1), chairWoodMat)
      cBack.position.set(0, 1.4, 0.4)
      cBack.castShadow = true
      cg.add(cBack)

      const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), legMat)
      cLeg.position.set(0, 0.45, 0)
      cg.add(cLeg)

      diningGroup.add(cg)
    })

    // Double-Decker 3D Strawberry Shortcake
    const cakeTier1 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: '#fff1f2', roughness: 0.4 })
    )
    cakeTier1.position.set(0, 1.82, 0)
    cakeTier1.castShadow = true
    diningGroup.add(cakeTier1)

    const cakeTier2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.42, 24),
      new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.4 })
    )
    cakeTier2.position.set(0, 2.28, 0)
    cakeTier2.castShadow = true
    diningGroup.add(cakeTier2)

    // Strawberry garnishes
    const strawbMat = new THREE.MeshStandardMaterial({ color: '#e11d48', roughness: 0.3 })
    for (let st = 0; st < 6; st++) {
      const sAng = (st * Math.PI * 2) / 6
      const sMesh = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), strawbMat)
      sMesh.position.set(Math.cos(sAng) * 0.42, 2.55, Math.sin(sAng) * 0.42)
      diningGroup.add(sMesh)
    }
    const centerStrawb = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), strawbMat)
    centerStrawb.position.set(0, 2.58, 0)
    diningGroup.add(centerStrawb)
    scene.add(diningGroup)

    // 11. Living 3D Aguila Pup & Play Zone (Far-Right Back: X: 14.5, Z: -10.5)
    const petZoneGroup = new THREE.Group()
    petZoneGroup.position.set(14.5, 0, -10.5)

    // Mint Pup Rug
    const dogRug = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 32),
      new THREE.MeshStandardMaterial({ color: '#a7f3d0', roughness: 0.85 })
    )
    dogRug.rotation.x = -Math.PI / 2
    dogRug.position.set(0, 0.008, 0)
    dogRug.receiveShadow = true
    petZoneGroup.add(dogRug)

    // Little wooden doghouse behind pup
    const houseGroup = new THREE.Group()
    houseGroup.position.set(1.0, 0, -2.0)
    const houseBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 2.0), shelfWoodMat)
    houseBase.position.set(0, 0.9, 0)
    houseBase.castShadow = true
    houseGroup.add(houseBase)

    const roofMat = new THREE.MeshStandardMaterial({ color: '#991b1b', roughness: 0.5 })
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.0, 4), roofMat)
    roof.position.set(0, 2.3, 0)
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    houseGroup.add(roof)
    petZoneGroup.add(houseGroup)

    // Water bowl and chew bone
    const bowlMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', metalness: 0.4, roughness: 0.3 })
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.16, 16), bowlMat)
    bowl.position.set(-1.2, 0.08, 0.8)
    petZoneGroup.add(bowl)

    // 3D Doggo Rig
    const dogGroup = new THREE.Group()
    dogGroup.position.set(0, 0, 0)

    const dogCoatMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.65 })
    const dogSnoutMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5 })
    const dogEarMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.6 })
    const eyeTex = createDogEyeTexture()
    const dogEyeMat = new THREE.MeshBasicMaterial({ map: eyeTex })

    // Dog Body
    const dogBody = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 16), dogCoatMat)
    dogBody.position.set(0, 0.65, 0)
    dogBody.scale.set(1, 0.85, 1.25)
    dogBody.castShadow = true
    dogGroup.add(dogBody)

    // Dog Head
    const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), dogCoatMat)
    dogHead.position.set(0, 1.25, 0.55)
    dogHead.castShadow = true

    // Snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), dogSnoutMat)
    snout.position.set(0, -0.1, 0.4)
    snout.scale.set(1, 0.75, 1.2)
    dogHead.add(snout)

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: '#18181b' }))
    nose.position.set(0, 0.02, 0.72)
    dogHead.add(nose)

    // Tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.2), new THREE.MeshBasicMaterial({ color: '#fb7185' }))
    tongue.position.set(0, -0.18, 0.62)
    tongue.rotation.x = 0.25
    dogHead.add(tongue)

    // 2 Distinct Shiny Eyes with Glints
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), dogEyeMat)
    eyeL.position.set(-0.25, 0.12, 0.44)
    dogHead.add(eyeL)

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), dogEyeMat)
    eyeR.position.set(0.25, 0.12, 0.44)
    dogHead.add(eyeR)

    // Floppy Ears
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), dogEarMat)
    earL.scale.set(0.55, 1.25, 0.7)
    earL.rotation.z = -0.35
    earL.position.set(-0.52, 0.1, 0)
    dogHead.add(earL)

    const earR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), dogEarMat)
    earR.scale.set(0.55, 1.25, 0.7)
    earR.rotation.z = 0.35
    earR.position.set(0.52, 0.1, 0)
    dogHead.add(earR)

    // Red Collar with Golden Bell
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.08, 8, 20), new THREE.MeshStandardMaterial({ color: '#ef4444' }))
    collar.position.set(0, -0.32, 0.1)
    collar.rotation.x = Math.PI / 2
    dogHead.add(collar)

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), brassMat)
    bell.position.set(0, -0.42, 0.45)
    dogHead.add(bell)
    dogGroup.add(dogHead)

    // Wagging Tail
    const dogTail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.65, 8), dogCoatMat)
    dogTail.position.set(0, 0.85, -0.7)
    dogTail.rotation.x = -Math.PI / 3.5
    dogGroup.add(dogTail)

    // Paws
    ;[
      [-0.35, -0.4], [0.35, -0.4],
      [-0.4, 0.35], [0.4, 0.35]
    ].forEach(([px, pz]) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), dogSnoutMat)
      paw.position.set(px, 0.15, pz)
      paw.scale.set(1, 0.6, 1.2)
      dogGroup.add(paw)
    })

    petZoneGroup.add(dogGroup)
    scene.add(petZoneGroup)

    dogMeshRef.current = {
      group: dogGroup,
      head: dogHead,
      tail: dogTail,
    }

    // 12. Retro Illuminated Neon Jukebox (Right Wall: X: 16.5, Z: 1.5)
    const jukeboxGroup = new THREE.Group()
    jukeboxGroup.position.set(16.5, 0, 1.5)
    jukeboxGroup.rotation.y = -Math.PI / 2

    const jukeBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 1.0), new THREE.MeshStandardMaterial({ color: '#312e81', roughness: 0.35 }))
    jukeBody.position.set(0, 1.4, 0)
    jukeBody.castShadow = true
    jukeboxGroup.add(jukeBody)

    const neonArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.08, 8, 16, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#a855f7' })
    )
    neonArch.position.set(0, 2.4, 0.52)
    neonArch.rotation.z = Math.PI
    jukeboxGroup.add(neonArch)

    const jukeLight = new THREE.PointLight('#a855f7', 1.4, 6)
    jukeLight.position.set(0, 2.0, 0.6)
    jukeboxGroup.add(jukeLight)
    scene.add(jukeboxGroup)

    // 13. Hall of Fame Trophy Showcase (Right Wall: X: 16.5, Z: -4.5)
    const trophyGroup = new THREE.Group()
    trophyGroup.position.set(16.5, 0, -4.5)
    trophyGroup.rotation.y = -Math.PI / 2

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.8), shelfWoodMat)
    cabinet.position.set(0, 1.6, 0)
    cabinet.castShadow = true
    trophyGroup.add(cabinet)

    // Golden Cup on shelf
    const trophyCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.45, 12), brassMat)
    trophyCup.position.set(0, 1.8, 0.1)
    trophyGroup.add(trophyCup)
    scene.add(trophyGroup)

    // 14. Click-to-Move Target Ring
    const targetRingGeo = new THREE.RingGeometry(0.35, 0.5, 32)
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: '#6366f1',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    })
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat)
    targetRing.rotation.x = -Math.PI / 2
    targetRing.position.y = 0.02
    scene.add(targetRing)
    targetRingMeshRef.current = targetRing

    // 15. Local Player 3D Character Rig
    const playerGroup = new THREE.Group()
    playerGroup.position.set(player3DRef.current.x, 0, player3DRef.current.z)

    const chibiSkinMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.5 })
    const chibiClothMat = new THREE.MeshStandardMaterial({ color: '#4f46e5', roughness: 0.6 })
    const chibiHairMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.75 })

    // Head
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), chibiSkinMat)
    headMesh.position.y = 1.35
    headMesh.castShadow = true
    playerGroup.add(headMesh)

    // Hair
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), chibiHairMat)
    hairMesh.position.y = 1.42
    hairMesh.castShadow = true
    playerGroup.add(hairMesh)

    // Dual Eyes
    const pEyeTex = createChibiEyeTexture(myMeta.avatarColor || '#6366f1')
    if (pEyeTex) {
      const pEyeMat = new THREE.MeshBasicMaterial({ map: pEyeTex, transparent: true })
      const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), pEyeMat)
      eyeL.position.set(-0.18, 1.34, 0.52)
      const eyeR = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), pEyeMat)
      eyeR.position.set(0.18, 1.34, 0.52)
      playerGroup.add(eyeL)
      playerGroup.add(eyeR)
    }

    // Body
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 12), chibiClothMat)
    bodyMesh.position.y = 0.75
    bodyMesh.castShadow = true
    playerGroup.add(bodyMesh)

    // Feet
    const footMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.4 })
    const footL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), footMat)
    footL.position.set(-0.2, 0.14, 0.05)
    footL.scale.set(1, 0.6, 1.4)
    playerGroup.add(footL)

    const footR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), footMat)
    footR.position.set(0.2, 0.14, 0.05)
    footR.scale.set(1, 0.6, 1.4)
    playerGroup.add(footR)
    scene.add(playerGroup)

    // ─────────────────────────────────────────────────────────────────────────
    // MOUSE & RAYCASTING INTERACTION
    // ─────────────────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

    const onPointerDown = (e) => {
      // Right-click drag starts camera orbit
      if (e.button === 2) {
        orbitRef.current.isDragging = true
        orbitRef.current.prevX = e.clientX
        orbitRef.current.prevY = e.clientY
        e.preventDefault()
        return
      }

      // Left-click moves avatar
      if (e.button === 0) {
        if (isSitting) {
          standUp()
        }

        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersectionPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(floorPlane, intersectionPoint)) {
          const targetX = Math.max(-ROOM_HALF_WIDTH + 1, Math.min(ROOM_HALF_WIDTH - 1, intersectionPoint.x))
          const targetZ = Math.max(-ROOM_HALF_DEPTH + 1, Math.min(ROOM_HALF_DEPTH - 1, intersectionPoint.z))

          player3DRef.current.targetX = targetX
          player3DRef.current.targetZ = targetZ

          targetRing.position.set(targetX, 0.02, targetZ)
          targetRing.scale.set(1, 1, 1)
          targetRing.material.opacity = 0.85
        }
      }
    }

    const onPointerMove = (e) => {
      if (!orbitRef.current.isDragging) return
      const dx = e.clientX - orbitRef.current.prevX
      orbitRef.current.azimuth -= dx * 0.005
      orbitRef.current.prevX = e.clientX
      orbitRef.current.prevY = e.clientY
    }

    const onPointerUp = (e) => {
      if (e.button === 2) {
        orbitRef.current.isDragging = false
      }
    }

    const onWheel = (e) => {
      orbitRef.current.distance = Math.max(16, Math.min(42, orbitRef.current.distance + e.deltaY * 0.02))
    }

    const onContextMenu = (e) => e.preventDefault()

    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('wheel', onWheel, { passive: true })
    domEl.addEventListener('contextmenu', onContextMenu)

    // ─────────────────────────────────────────────────────────────────────────
    // ANIMATION LOOP (60 FPS)
    // ─────────────────────────────────────────────────────────────────────────
    let animId = null
    let clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      const pState = player3DRef.current
      const keys = keysDownRef.current

      // Target Ring Fadeout
      if (targetRing.material.opacity > 0.01) {
        targetRing.scale.addScalar(0.035)
        targetRing.material.opacity -= 0.03
      }

      // Clear keys if user focused an input
      if (
        typeof document !== 'undefined' &&
        (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')
      ) {
        keysDownRef.current = {}
      }

      // Continuous Keyboard Movement (Camera-Relative WASD & Arrow Keys)
      let moveX = 0
      let moveZ = 0

      if (keys['w'] || keys['arrowup']) moveZ -= 1
      if (keys['s'] || keys['arrowdown']) moveZ += 1
      if (keys['a'] || keys['arrowleft']) moveX -= 1
      if (keys['d'] || keys['arrowright']) moveX += 1

      if (moveX !== 0 || moveZ !== 0) {
        if (pState.sitState) {
          standUp()
        }
        pState.targetX = null
        pState.targetZ = null

        // Camera-relative vector
        const camAzimuth = orbitRef.current.azimuth
        const fwdX = -Math.sin(camAzimuth)
        const fwdZ = -Math.cos(camAzimuth)
        const rightX = -fwdZ
        const rightZ = fwdX

        const dirX = fwdX * (-moveZ) + rightX * moveX
        const dirZ = fwdZ * (-moveZ) + rightZ * moveX
        const len = Math.hypot(dirX, dirZ)

        const vx = (dirX / len) * PLAYER_SPEED
        const vz = (dirZ / len) * PLAYER_SPEED

        // Rotate smoothly towards movement direction
        const targetRot = Math.atan2(vx, vz)
        pState.rotation = THREE.MathUtils.lerp(pState.rotation, targetRot, ROT_SPEED)

        const nextX = pState.x + vx
        const nextZ = pState.z + vz

        if (!checkCollision3D(nextX, nextZ)) {
          pState.x = nextX
          pState.z = nextZ
          pState.isMoving = true
        } else if (!checkCollision3D(nextX, pState.z)) {
          pState.x = nextX
          pState.isMoving = true
        } else if (!checkCollision3D(pState.x, nextZ)) {
          pState.z = nextZ
          pState.isMoving = true
        } else {
          // If stuck inside an obstacle, find unstuck vector
          unstuckPlayer(pState)
        }
      } else if (pState.targetX !== null && pState.targetZ !== null && !pState.sitState) {
        // Click-to-Move Pathing
        const dx = pState.targetX - pState.x
        const dz = pState.targetZ - pState.z
        const dist = Math.hypot(dx, dz)

        if (dist < PLAYER_SPEED) {
          pState.x = pState.targetX
          pState.z = pState.targetZ
          pState.targetX = null
          pState.targetZ = null
          pState.isMoving = false
        } else {
          pState.isMoving = true
          const vx = (dx / dist) * PLAYER_SPEED
          const vz = (dz / dist) * PLAYER_SPEED

          const targetRot = Math.atan2(vx, vz)
          pState.rotation = THREE.MathUtils.lerp(pState.rotation, targetRot, ROT_SPEED)

          const nextX = pState.x + vx
          const nextZ = pState.z + vz

          if (!checkCollision3D(nextX, nextZ)) {
            pState.x = nextX
            pState.z = nextZ
          } else if (!checkCollision3D(nextX, pState.z)) {
            pState.x = nextX
          } else if (!checkCollision3D(pState.x, nextZ)) {
            pState.z = nextZ
          } else {
            pState.targetX = null
            pState.targetZ = null
            pState.isMoving = false
          }
        }
      } else {
        pState.isMoving = false
      }

      // Waddle & Hop Animation
      if (pState.isMoving && !pState.sitState) {
        pState.hopPhase += delta * 15
        playerGroup.position.y = Math.abs(Math.sin(pState.hopPhase)) * 0.16
        footL.position.z = Math.sin(pState.hopPhase) * 0.18
        footR.position.z = -Math.sin(pState.hopPhase) * 0.18
      } else {
        pState.hopPhase = 0
        playerGroup.position.y = pState.sitState ? -0.22 : 0
        footL.position.z = 0.05
        footR.position.z = 0.05
      }

      playerGroup.position.x = pState.x
      playerGroup.position.z = pState.z
      playerGroup.rotation.y = pState.rotation

      // Sync position to other players
      if (setMyPosition && (pState.isMoving || pState.sitState)) {
        posSyncTimerRef.current = (posSyncTimerRef.current || 0) + 1
        if (posSyncTimerRef.current % 4 === 0) {
          setMyPosition({ x: pState.x, z: pState.z })
        }
      }

      // Smooth Camera Tracking (Azimuth + Distance)
      const orbit = orbitRef.current
      const camTargetX = pState.x + Math.sin(orbit.azimuth) * orbit.distance * 0.72
      const camTargetY = 22
      const camTargetZ = pState.z + Math.cos(orbit.azimuth) * orbit.distance * 0.72

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.06)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.06)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, camTargetZ, 0.06)
      camera.lookAt(pState.x * 0.7, 1.2, pState.z * 0.7)

      // Project 3D Screen Coordinates for Floating HUD Name Tag
      const projVector = new THREE.Vector3(pState.x, 2.5, pState.z)
      projVector.project(camera)
      const screenX = ((projVector.x + 1) / 2) * width
      const screenY = ((-projVector.y + 1) / 2) * height
      setScreenPos({ x: screenX, y: screenY })

      // Animate Doggo (Breathing, Tail Wagging, Happy Bouncing)
      if (dogMeshRef.current) {
        const { tail, head, group } = dogMeshRef.current
        const wagSpeed = dogHappy ? 20 : 6
        const wagAngle = dogHappy ? 0.75 : 0.35
        tail.rotation.y = Math.sin(time * wagSpeed) * wagAngle
        head.rotation.y = Math.sin(time * 2.2) * 0.12
        group.scale.y = dogHappy ? 1 + Math.abs(Math.sin(time * 12)) * 0.22 : 1 + Math.sin(time * 2.6) * 0.035
      }

      // Flickering Fireplace Light
      if (fireLightRef.current) {
        fireLightRef.current.intensity = 1.8 + Math.sin(time * 16) * 0.35 + Math.cos(time * 24) * 0.2
      }

      // Animate 3D Steam Particles
      steamParticlesRef.current.forEach((sp) => {
        sp.mesh.position.y += sp.speed
        sp.mesh.position.x += sp.drift
        sp.mesh.scale.addScalar(0.007)
        sp.mesh.material.opacity -= 0.009
        if (sp.mesh.position.y > 4.4 || sp.mesh.material.opacity <= 0.02) {
          sp.mesh.position.y = sp.initialY
          sp.mesh.position.x = 5.0 + (Math.random() - 0.5) * 0.4
          sp.mesh.scale.set(1, 1, 1)
          sp.mesh.material.opacity = 0.6
        }
      })

      // Proximity Detection to nearest 3D Station
      let nearest = null
      let minDist = Infinity
      for (const st of STATIONS_3D) {
        const d = Math.hypot(pState.x - st.x, pState.z - st.z)
        if (d < st.radius && d < minDist) {
          minDist = d
          nearest = st
        }
      }
      setActiveStation(nearest)

      renderer.render(scene, camera)
    }

    animate()

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      domEl.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('wheel', onWheel)
      domEl.removeEventListener('contextmenu', onContextMenu)
      if (domEl && container.contains(domEl)) {
        container.removeChild(domEl)
      }
      renderer.dispose()
    }
  }, [myMeta.avatarColor, isSitting, standUp, setMyPosition, dogHappy])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes toastPop {
          0% { opacity: 0; transform: translate(-50%, -10px) scale(0.92); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>

      {/* Floating Active Station Interaction Prompt */}
      {activeStation && !isSitting && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(9, 9, 11, 0.94)',
            border: '1px solid rgba(99, 102, 241, 0.45)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(99, 102, 241, 0.25)',
            borderRadius: 14,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 80,
            backdropFilter: 'blur(12px)',
            animation: 'toastPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span style={{ fontSize: 24 }}>{activeStation.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {activeStation.name}
            </div>
            <div style={{ fontSize: 10, color: '#a1a1aa' }}>
              {activeStation.desc}
            </div>
          </div>
          <button
            onClick={() => executeStation(activeStation)}
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeStation.prompt}
          </button>
        </div>
      )}

      {/* Sitting State HUD Prompt */}
      {isSitting && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(9, 9, 11, 0.95)',
            border: '1px solid rgba(244, 114, 182, 0.4)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
            borderRadius: 14,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 80,
            backdropFilter: 'blur(12px)',
            animation: 'toastPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span style={{ fontSize: 20 }}>🛋️</span>
          <span style={{ fontSize: 12, color: '#fbcfe8', fontWeight: 600 }}>
            Relaxing comfortably in 3D
          </span>
          <button
            onClick={() => {
              if (onOpenPomodoro) onOpenPomodoro()
            }}
            style={{
              background: '#4f46e5',
              border: 'none',
              borderRadius: 8,
              padding: '5px 12px',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Start 25m Pomodoro
          </button>
          <button
            onClick={standUp}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: 8,
              padding: '5px 12px',
              color: '#a1a1aa',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Stand Up [E]
          </button>
        </div>
      )}

      {/* 3D Billboard Name Tag & Speech Bubble above Player Avatar */}
      <div
        style={{
          position: 'absolute',
          left: screenPos.x,
          top: screenPos.y,
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          zIndex: 40,
        }}
      >
        {/* Active Speech Bubble */}
        {speechBubbles[myMeta.userId] && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 10,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              maxWidth: 180,
              textAlign: 'center',
              wordBreak: 'break-word',
              marginBottom: 4,
            }}
          >
            {speechBubbles[myMeta.userId].text}
          </div>
        )}

        {/* Name Tag Pill */}
        <div
          style={{
            background: 'rgba(9, 9, 11, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            color: '#e4e4e7',
            whiteSpace: 'nowrap',
          }}
        >
          {myMeta.displayName || 'You'} (you)
        </div>
      </div>

      {/* Toast Notification (Snack / Teleport / Coffee) */}
      {snackToast && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(9, 9, 11, 0.95)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#fbbf24',
            boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
            zIndex: 90,
            animation: 'toastPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {snackToast}
        </div>
      )}

      {/* Coffee Buff Banner */}
      {coffeeBuff && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(9, 9, 11, 0.95)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#4ade80',
            boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
            zIndex: 90,
            animation: 'toastPop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          ☕ Coffee Speed & Focus Buff Active (+10 Focus)!
        </div>
      )}

      {/* Sound Toggle Button (Bottom-Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          zIndex: 80,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          onClick={() => setSoundOn(toggleLoungeSound())}
          style={{
            background: soundOn ? 'rgba(74, 222, 128, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${soundOn ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 8,
            padding: '5px 10px',
            color: soundOn ? '#4ade80' : '#f87171',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          {soundOn ? '🔊 3D Audio' : '🔇 Muted'}
        </button>
      </div>

      {/* Top Controls Guide Hint */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(9, 9, 11, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: '4px 16px',
          fontSize: 10,
          color: '#a1a1aa',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          zIndex: 80,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        🕹️ Walk: <span style={{ color: '#fff' }}>[W, A, S, D]</span> or click floor • Right-click drag to orbit • Chat: <span style={{ color: '#818cf8' }}>/tp &lt;location&gt;</span>
      </div>
    </div>
  )
})

export default Lounge3DRoom
