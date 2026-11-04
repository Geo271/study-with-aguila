'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import {
  playFootstepSound, playInteractSound, playCoffeeBrewSound,
  playPetSound, playSnackSound, playSitSound,
  isLoungeSoundEnabled, toggleLoungeSound
} from './LoungeAudio'

// ─────────────────────────────────────────────────────────────────────────────
// 3D WORLD COORDINATE CONSTANTS
// Room bounds: X [-11, 11], Z [-11, 11]
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_HALF_WIDTH = 10.5
const ROOM_HALF_DEPTH = 10.5
const PLAYER_SPEED = 0.16
const ROT_SPEED = 0.22

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

  // Base warm golden-honey tone
  ctx.fillStyle = '#c59b6d'
  ctx.fillRect(0, 0, 512, 512)

  // Plank rows
  const plankH = 32
  const rows = 512 / plankH
  for (let r = 0; r < rows; r++) {
    const y = r * plankH
    const shade = (Math.sin(r * 2.8) * 0.05)
    ctx.fillStyle = shade >= 0 ? `rgba(255, 255, 255, ${shade})` : `rgba(0, 0, 0, ${-shade})`
    ctx.fillRect(0, y, 512, plankH)

    // Seam line
    ctx.strokeStyle = '#8b5a2b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()

    // Staggered vertical joints
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
  tex.repeat.set(4, 4)
  return tex
}

/** Cute Sunflower Rug Texture */
function createSunflowerRugTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const cx = 128, cy = 128
  // 16 Petals
  ctx.fillStyle = '#facc15'
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16
    const px = cx + Math.cos(angle) * 78
    const py = cy + Math.sin(angle) * 78
    ctx.beginPath()
    ctx.arc(px, py, 34, 0, Math.PI * 2)
    ctx.fill()
  }

  // Inner ring
  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.arc(cx, cy, 70, 0, Math.PI * 2)
  ctx.fill()

  // Center seed disc
  ctx.fillStyle = '#78350f'
  ctx.beginPath()
  ctx.arc(cx, cy, 48, 0, Math.PI * 2)
  ctx.fill()

  // Seed details
  ctx.fillStyle = '#a16207'
  for (let d = 0; d < 45; d++) {
    const rad = Math.random() * 40
    const ang = Math.random() * Math.PI * 2
    ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 3, 3)
  }

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

/** Chibi Cute Eye Texture with dual glints */
function createChibiEyeTexture(color = '#6366f1') {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)

  // Iris
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(64, 64, 46, 0, Math.PI * 2)
  ctx.fill()

  // Pupil
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(64, 64, 28, 0, Math.PI * 2)
  ctx.fill()

  // Catchlights
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(50, 48, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(78, 76, 7, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D INTERACTIVE STATIONS REGISTRY
// ─────────────────────────────────────────────────────────────────────────────
const STATIONS_3D = [
  {
    id: 'bookshelf',
    name: 'Study Vault',
    desc: 'Flashcards & Quizzes',
    icon: '📚',
    x: -7.5,
    z: -8.0,
    radius: 3.2,
    prompt: '[E] Open Study Vault',
    category: 'study',
  },
  {
    id: 'coffeebar',
    name: 'Barista Counter',
    desc: 'Brew Matcha / Coffee',
    icon: '☕',
    x: 1.5,
    z: -6.0,
    radius: 3.0,
    prompt: '[E] Brew Fresh Coffee',
    category: 'boost',
  },
  {
    id: 'petdoggo',
    name: 'Cozy Aguila Pup',
    desc: 'Adorable & Wiggling',
    icon: '🐶',
    x: 7.6,
    z: -6.5,
    radius: 3.0,
    prompt: '[E] Pet Aguila Doggo',
    category: 'pet',
  },
  {
    id: 'sofa_lounge',
    name: 'Lounge Sofa',
    desc: 'Sit & Focus',
    icon: '🛋️',
    x: -6.0,
    z: 4.5,
    radius: 3.2,
    prompt: '[E] Sit on Sofa',
    category: 'seat',
    seatX: -6.0,
    seatZ: 4.2,
    seatRot: Math.PI / 4,
  },
  {
    id: 'dining_cake',
    name: 'Strawberry Cake',
    desc: 'Sweet study fuel',
    icon: '🍰',
    x: 5.0,
    z: 3.5,
    radius: 3.0,
    prompt: '[E] Eat Cake Slice',
    category: 'snack',
  },
  {
    id: 'fireplace',
    name: 'Stone Hearth',
    desc: 'Warm fire glow',
    icon: '🔥',
    x: -10.0,
    z: -1.0,
    radius: 3.0,
    prompt: '[E] Warm by Fireplace',
    category: 'fire',
  },
  {
    id: 'jukebox',
    name: 'Lofi Jukebox',
    desc: 'Study soundtrack',
    icon: '🎵',
    x: 9.0,
    z: 1.5,
    radius: 2.8,
    prompt: '[E] Change Music',
    category: 'music',
  },
  {
    id: 'leaderboard',
    name: 'Hall of Fame',
    desc: 'Room records',
    icon: '🏆',
    x: 9.0,
    z: -2.5,
    radius: 2.8,
    prompt: '[E] View Room Rank',
    category: 'rank',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 3D COLLISION AABB OBSTACLES
// ─────────────────────────────────────────────────────────────────────────────
const OBSTACLES_3D = [
  // Outer walls
  { minX: -11.5, maxX: 11.5, minZ: -11.5, maxZ: -10.0 }, // Back wall
  { minX: -11.5, maxX: 11.5, minZ: 10.2, maxZ: 12.0 },   // Front boundary
  { minX: -12.0, maxX: -10.2, minZ: -11.5, maxZ: 11.5 }, // Left wall
  { minX: 10.2, maxX: 12.0, minZ: -11.5, maxZ: 11.5 },   // Right wall

  // Bookshelf units
  { minX: -9.8, maxX: -5.2, minZ: -10.2, maxZ: -7.8 },

  // Barista counter
  { minX: -2.0, maxX: 5.0, minZ: -7.2, maxZ: -5.0 },

  // Velvet sofa cluster
  { minX: -8.5, maxX: -3.5, minZ: 2.8, maxZ: 6.2 },

  // Dining table cluster
  { minX: 3.2, maxX: 6.8, minZ: 1.8, maxZ: 5.2 },

  // Fireplace hearth
  { minX: -11.2, maxX: -8.8, minZ: -2.5, maxZ: 0.5 },

  // Pet corner
  { minX: 6.5, maxX: 8.8, minZ: -7.6, maxZ: -5.4 },
]

function checkCollision3D(x, z, radius = 0.5) {
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

export default function Lounge3DRoom({
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
}) {
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
    azimuth: 0, // Angle around player
    distance: 22,
  })

  const dogMeshRef = useRef(null)
  const steamParticlesRef = useRef([])
  const targetRingMeshRef = useRef(null)
  const fireLightRef = useRef(null)
  const cameraRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)

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

  // Continuous Keyboard WASD & Arrow Key Movement Handler
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      keysDownRef.current[k] = true

      if (k === 'e' || e.key === ' ') {
        if (isSitting) {
          setIsSitting(false)
          player3DRef.current.sitState = false
          e.preventDefault()
          return
        }
        if (activeStation) {
          e.preventDefault()
          executeStation(activeStation)
        }
      }

      if (e.key === 'Escape' && isSitting) {
        setIsSitting(false)
        player3DRef.current.sitState = false
      }

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(k)) {
        if (isSitting) {
          setIsSitting(false)
          player3DRef.current.sitState = false
        }
        // Cancel click-to-move destination when user presses keys
        player3DRef.current.targetX = null
        player3DRef.current.targetZ = null
      }
    }

    const onKeyUp = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const k = e.key.toLowerCase()
      keysDownRef.current[k] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [activeStation, isSitting, executeStation])

  // Footstep audio loop while walking
  useEffect(() => {
    if (!isMoving) return
    const interval = setInterval(() => {
      playFootstepSound()
    }, 280)
    return () => clearInterval(interval)
  }, [isMoving])

  // Quick-Nav teleport
  const handleQuickNav = (station) => {
    if (isSitting) {
      setIsSitting(false)
      player3DRef.current.sitState = false
    }
    player3DRef.current.targetX = station.x
    player3DRef.current.targetZ = station.z
    playInteractSound()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THREE.JS INITIALIZATION & EXPANDED 3D SCENE RIG
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // 1. Scene & Isometric Perspective Camera
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0x0e1117)
    scene.fog = new THREE.FogExp2(0x0e1117, 0.015)

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 140)
    camera.position.set(0, 17, 22)
    camera.lookAt(0, 0.5, 0)
    cameraRef.current = camera

    // 2. WebGL Renderer with Soft PCF Shadows
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 3. Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.45)
    scene.add(ambientLight)

    // Warm Sunbeam Key Light
    const sunLight = new THREE.DirectionalLight(0xfef08a, 2.0)
    sunLight.position.set(14, 20, 10)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 1024
    sunLight.shadow.mapSize.height = 1024
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 50
    sunLight.shadow.camera.left = -18
    sunLight.shadow.camera.right = 18
    sunLight.shadow.camera.top = 18
    sunLight.shadow.camera.bottom = -18
    sunLight.shadow.bias = -0.0004
    scene.add(sunLight)

    // Sky-blue bounce fill
    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.65)
    fillLight.position.set(-14, 10, -10)
    scene.add(fillLight)

    // Barista Cafe Amber Point Light
    const cafeLight = new THREE.PointLight(0xf59e0b, 1.8, 14, 1.4)
    cafeLight.position.set(1.5, 4.8, -6.0)
    scene.add(cafeLight)

    // Fireplace Flickering Point Light
    const fireLight = new THREE.PointLight(0xf97316, 2.0, 12, 1.5)
    fireLight.position.set(-9.5, 2.0, -1.0)
    scene.add(fireLight)
    fireLightRef.current = fireLight

    // 4. Procedural Textures & Materials
    const floorTexture = createWoodFloorTexture()
    const sunflowerTexture = createSunflowerRugTexture()

    const matWoodFloor = new THREE.MeshStandardMaterial({
      map: floorTexture || undefined,
      color: 0xdeb887,
      roughness: 0.35,
      metalness: 0.05,
    })

    const matWall = new THREE.MeshStandardMaterial({
      color: 0xfaf4ec,
      roughness: 0.75,
      metalness: 0.02,
    })

    const matOak = new THREE.MeshStandardMaterial({
      color: 0x8a5229,
      roughness: 0.42,
    })

    const matBaseboard = new THREE.MeshStandardMaterial({
      color: 0x6d3816,
      roughness: 0.4,
    })

    const matVelvetPink = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.65,
    })

    const matCounterMarble = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.1,
    })

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.12,
    })

    const matMint = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      roughness: 0.5,
    })

    const matLeaf = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.35,
    })

    // 5. Floor & 3 Enclosing Walls (Back, Left, Right)
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(23, 0.4, 23), matWoodFloor)
    floorMesh.position.y = -0.2
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // Back Wall (Z: -11.2)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(23, 8.5, 0.5), matWall)
    backWall.position.set(0, 4.25, -11.2)
    backWall.receiveShadow = true
    scene.add(backWall)

    // Left Wall (X: -11.2)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 23), matWall)
    leftWall.position.set(-11.2, 4.25, 0)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    // Right Wall (X: 11.2)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 23), matWall)
    rightWall.position.set(11.2, 4.25, 0)
    rightWall.receiveShadow = true
    scene.add(rightWall)

    // Baseboards along all 3 walls
    const baseBack = new THREE.Mesh(new THREE.BoxGeometry(23, 0.6, 0.15), matBaseboard)
    baseBack.position.set(0, 0.3, -10.9)
    scene.add(baseBack)

    const baseLeft = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 23), matBaseboard)
    baseLeft.position.set(-10.9, 0.3, 0)
    scene.add(baseLeft)

    const baseRight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 23), matBaseboard)
    baseRight.position.set(10.9, 0.3, 0)
    scene.add(baseRight)

    // Large Study Window with Curtains
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.25), matBaseboard)
    windowFrame.position.set(1.5, 4.8, -11.0)
    scene.add(windowFrame)

    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 4.5),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        roughness: 0.1,
        metalness: 0.8,
        emissive: 0x93c5fd,
        emissiveIntensity: 0.5,
      })
    )
    glassPane.position.set(1.5, 4.8, -10.85)
    scene.add(glassPane)

    // White Linen Curtains on sides
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0xfdf4ff, roughness: 0.8 })
    const curtainL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.2, 0.4), curtainMat)
    curtainL.position.set(-2.5, 4.8, -10.7)
    scene.add(curtainL)

    const curtainR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.2, 0.4), curtainMat)
    curtainR.position.set(5.5, 4.8, -10.7)
    scene.add(curtainR)

    // 6. Rugs on Floor
    if (sunflowerTexture) {
      const sunRug = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 32),
        new THREE.MeshStandardMaterial({ map: sunflowerTexture, roughness: 0.85 })
      )
      sunRug.rotation.x = -Math.PI / 2
      sunRug.position.set(1.5, 0.02, -3.2)
      sunRug.receiveShadow = true
      scene.add(sunRug)
    }

    const sageRug = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 0.03, 32),
      new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.85 })
    )
    sageRug.position.set(-6.0, 0.015, 4.5)
    sageRug.scale.set(1, 1, 0.78)
    sageRug.receiveShadow = true
    scene.add(sageRug)

    // 7. OPEN BOOKCASE UNIT (Real Shelves & Visible 3D Colorful Books)
    const bookcase = new THREE.Group()
    bookcase.position.set(-7.5, 0, -8.8)

    // Thin back panel
    const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(4.4, 7.2, 0.15), matOak)
    shelfBack.position.set(0, 3.6, -0.6)
    bookcase.add(shelfBack)

    // Left and right uprights
    const uprightL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.2, 1.2), matOak)
    uprightL.position.set(-2.1, 3.6, 0)
    uprightL.castShadow = true
    bookcase.add(uprightL)

    const uprightR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 7.2, 1.2), matOak)
    uprightR.position.set(2.1, 3.6, 0)
    uprightR.castShadow = true
    bookcase.add(uprightR)

    // 4 Horizontal Shelves
    for (let s = 0; s < 5; s++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.2), matOak)
      plank.position.set(0, s * 1.6 + 0.2, 0)
      plank.castShadow = true
      bookcase.add(plank)
    }

    // Colorful 3D Books standing on shelves
    const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4]
    for (let shelf = 0; shelf < 4; shelf++) {
      const shelfY = shelf * 1.6 + 0.3
      for (let b = 0; b < 13; b++) {
        const bookW = 0.12 + (b % 3) * 0.04
        const bookH = 0.85 + (b % 4) * 0.18
        const bookMat = new THREE.MeshStandardMaterial({
          color: bookColors[(shelf * 3 + b) % bookColors.length],
          roughness: 0.35,
        })
        const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(bookW, bookH, 0.75), bookMat)
        bookMesh.position.set(-1.7 + b * 0.27, shelfY + bookH / 2, 0.05)
        bookMesh.castShadow = true
        bookcase.add(bookMesh)
      }
    }

    // Glowing candle lantern on shelf
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.8 })
    )
    lantern.position.set(1.4, 5.3, 0.2)
    bookcase.add(lantern)

    scene.add(bookcase)

    // 8. Barista Counter & Pastry Display
    const counterGroup = new THREE.Group()
    counterGroup.position.set(1.5, 0, -6.0)

    const barBase = new THREE.Mesh(new THREE.BoxGeometry(6.6, 2.0, 1.8), matOak)
    barBase.position.y = 1.0
    barBase.castShadow = true
    barBase.receiveShadow = true
    counterGroup.add(barBase)

    const barTop = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.25, 2.2), matCounterMarble)
    barTop.position.y = 2.12
    barTop.castShadow = true
    barTop.receiveShadow = true
    counterGroup.add(barTop)

    // Chrome Espresso Machine with Dials & Portafilters
    const espressoMachine = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.1), matChrome)
    espressoMachine.position.set(-1.6, 2.9, 0)
    espressoMachine.castShadow = true
    counterGroup.add(espressoMachine)

    // Pastry Display Glass Dome
    const glassDome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.7, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.1 })
    )
    glassDome.position.set(1.6, 2.6, 0)
    counterGroup.add(glassDome)

    // 3 Stools
    for (let s = -1; s <= 1; s++) {
      const stool = new THREE.Group()
      stool.position.set(s * 1.9, 0, 1.7)

      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 16), matMint)
      seat.position.y = 1.3
      seat.castShadow = true
      stool.add(seat)

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), matBaseboard)
      leg.position.y = 0.6
      leg.castShadow = true
      stool.add(leg)

      counterGroup.add(stool)
    }
    scene.add(counterGroup)

    // 9. Velvet Lounge Sofas & Armchairs
    const sofaGroup = new THREE.Group()
    sofaGroup.position.set(-6.0, 0, 4.5)

    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 1.8), matVelvetPink)
    sofaBase.position.set(0, 0.55, 0)
    sofaBase.castShadow = true
    sofaGroup.add(sofaBase)

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 0.55), matVelvetPink)
    sofaBack.position.set(0, 1.6, -0.65)
    sofaBack.castShadow = true
    sofaGroup.add(sofaBack)

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 1.8), matVelvetPink)
    armL.position.set(-2.1, 1.05, 0)
    armL.castShadow = true
    sofaGroup.add(armL)

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 1.8), matVelvetPink)
    armR.position.set(2.1, 1.05, 0)
    armR.castShadow = true
    sofaGroup.add(armR)

    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.3), matOak)
    coffeeTable.position.set(0, 0.45, 1.9)
    coffeeTable.castShadow = true
    sofaGroup.add(coffeeTable)

    scene.add(sofaGroup)

    // 10. Study Dining Table with Double-Decker Strawberry Cake
    const tableGroup = new THREE.Group()
    tableGroup.position.set(5.0, 0, 3.5)

    const diningTableTop = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.16, 32), matCounterMarble)
    diningTableTop.position.y = 1.65
    diningTableTop.castShadow = true
    diningTableTop.receiveShadow = true
    tableGroup.add(diningTableTop)

    const diningLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.55, 16), matOak)
    diningLeg.position.y = 0.8
    diningLeg.castShadow = true
    tableGroup.add(diningLeg)

    // Double-Decker Cake
    const cakeGroup = new THREE.Group()
    cakeGroup.position.set(0, 1.73, 0)

    const cakeBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.3 })
    )
    cakeBottom.position.y = 0.22
    cakeBottom.castShadow = true
    cakeGroup.add(cakeBottom)

    const cakeTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    )
    cakeTop.position.y = 0.62
    cakeTop.castShadow = true
    cakeGroup.add(cakeTop)

    // Strawberries
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.2 })
    for (let sb = 0; sb < 5; sb++) {
      const ang = (sb * Math.PI * 2) / 5
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), berryMat)
      berry.position.set(Math.cos(ang) * 0.36, 0.85, Math.sin(ang) * 0.36)
      cakeGroup.add(berry)
    }
    tableGroup.add(cakeGroup)

    // 4 Wooden Chairs with backs
    for (let c = 0; c < 4; c++) {
      const ang = (c * Math.PI * 2) / 4
      const chairGroup = new THREE.Group()
      chairGroup.position.set(Math.cos(ang) * 2.8, 0, Math.sin(ang) * 2.8)
      chairGroup.lookAt(tableGroup.position.x, 0, tableGroup.position.z)

      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.85), matMint)
      chairSeat.position.y = 1.0
      chairSeat.castShadow = true
      chairGroup.add(chairSeat)

      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.1), matOak)
      chairBack.position.set(0, 1.5, -0.38)
      chairBack.castShadow = true
      chairGroup.add(chairBack)

      for (let l = 0; l < 4; l++) {
        const lx = (l % 2 === 0 ? 0.35 : -0.35)
        const lz = (l < 2 ? 0.35 : -0.35)
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), matOak)
        leg.position.set(lx, 0.5, lz)
        leg.castShadow = true
        chairGroup.add(leg)
      }
      tableGroup.add(chairGroup)
    }
    scene.add(tableGroup)

    // 11. Stone Fireplace Hearth on Left Wall
    const fireplace = new THREE.Group()
    fireplace.position.set(-10.2, 0, -1.0)

    const hearthMantel = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 3.4, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 })
    )
    hearthMantel.position.y = 1.7
    hearthMantel.castShadow = true
    fireplace.add(hearthMantel)

    // Inner Fire Cave
    const fireCave = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.8, 2.0),
      new THREE.MeshBasicMaterial({ color: 0x1c1917 })
    )
    fireCave.position.set(0.25, 1.0, 0)
    fireplace.add(fireCave)

    // Glowing Fire Embers
    const fireMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.45),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    )
    fireMesh.position.set(0.25, 0.6, 0)
    fireplace.add(fireMesh)
    scene.add(fireplace)

    // 12. ADORABLE 3D AGUILA PUPPY (TWO SPARKLING EYES, NO CYCLOPS!)
    const dogGroup = new THREE.Group()
    dogGroup.position.set(7.6, 0, -6.5)

    // Cozy Quilted Pet Bed
    const bedBorder = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 })
    )
    bedBorder.position.y = 0.14
    bedBorder.receiveShadow = true
    dogGroup.add(bedBorder)

    const bedCushion = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.26, 24),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 })
    )
    bedCushion.position.y = 0.22
    dogGroup.add(bedCushion)

    const matGoldenFur = new THREE.MeshStandardMaterial({ color: 0xe69138, roughness: 0.42 })
    const matSnoutCream = new THREE.MeshStandardMaterial({ color: 0xfffaea, roughness: 0.35 })
    const matDarkNose = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.15 })

    // Dog Torso
    const dogBody = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), matGoldenFur)
    dogBody.scale.set(1.1, 0.85, 1.35)
    dogBody.position.set(0, 0.7, 0)
    dogBody.castShadow = true
    dogGroup.add(dogBody)

    // Head
    const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18), matGoldenFur)
    dogHead.position.set(0, 1.25, 0.55)
    dogHead.castShadow = true
    dogGroup.add(dogHead)

    // Cute White Snout
    const dogSnout = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.42), matSnoutCream)
    dogSnout.position.set(0, 1.12, 0.95)
    dogGroup.add(dogSnout)

    // Black Button Nose
    const dogNose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), matDarkNose)
    dogNose.position.set(0, 1.24, 1.18)
    dogGroup.add(dogNose)

    // Happy Pink Tongue
    const dogTongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
    )
    dogTongue.position.set(0, 0.98, 1.08)
    dogGroup.add(dogTongue)

    // ✨ TWO SYMMETRICAL SPARKLING EYES (FIXED CYCLOPS BUG!)
    const matPupil = new THREE.MeshBasicMaterial({ color: 0x0f172a })
    const matGlint = new THREE.MeshBasicMaterial({ color: 0xffffff })

    const eyeLGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), matPupil)
    eyeLGlobe.position.set(-0.25, 1.35, 0.95)
    dogGroup.add(eyeLGlobe)

    const eyeRGlobe = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), matPupil)
    eyeRGlobe.position.set(0.25, 1.35, 0.95)
    dogGroup.add(eyeRGlobe)

    // White Glints in both eyes
    const glintL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), matGlint)
    glintL.position.set(-0.22, 1.39, 1.04)
    dogGroup.add(glintL)

    const glintR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), matGlint)
    glintR.position.set(0.28, 1.39, 1.04)
    dogGroup.add(glintR)

    // Floppy Cute Ears
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), matGoldenFur)
    earL.rotation.z = 0.55
    earL.position.set(-0.48, 1.55, 0.45)
    dogGroup.add(earL)

    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), matGoldenFur)
    earR.rotation.z = -0.55
    earR.position.set(0.48, 1.55, 0.45)
    dogGroup.add(earR)

    // Red Collar with Golden Bell
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.08, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    )
    collar.rotation.x = Math.PI / 2
    collar.position.set(0, 0.98, 0.45)
    dogGroup.add(collar)

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), matOak)
    bell.position.set(0, 0.88, 0.92)
    dogGroup.add(bell)

    // Front Paws
    const pawL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.35), matSnoutCream)
    pawL.position.set(-0.35, 0.35, 0.85)
    dogGroup.add(pawL)

    const pawR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.35), matSnoutCream)
    pawR.position.set(0.35, 0.35, 0.85)
    dogGroup.add(pawR)

    // Wiggling Fluffy Tail
    const dogTail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.65, 8), matGoldenFur)
    dogTail.rotation.x = -Math.PI / 3.5
    dogTail.position.set(0, 0.85, -0.95)
    dogGroup.add(dogTail)

    dogMeshRef.current = { group: dogGroup, tail: dogTail, head: dogHead }
    scene.add(dogGroup)

    // 13. 3D Steam Particles (from Espresso Machine)
    const steamGroup = new THREE.Group()
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    const steamGeo = new THREE.SphereGeometry(0.14, 8, 8)
    const steamParticles = []
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(steamGeo, steamMat.clone())
      p.position.set(-0.1 + Math.random() * 0.2, 3.0 + i * 0.25, -6.0)
      steamGroup.add(p)
      steamParticles.push({
        mesh: p,
        initialY: 3.0,
        speed: 0.016 + Math.random() * 0.015,
        drift: (Math.random() - 0.5) * 0.01,
      })
    }
    steamParticlesRef.current = steamParticles
    scene.add(steamGroup)

    // 14. Animated Click Target Ring
    const targetRingGeo = new THREE.RingGeometry(0.42, 0.6, 32)
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    })
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat)
    targetRing.rotation.x = -Math.PI / 2
    targetRing.position.y = 0.03
    targetRingMeshRef.current = targetRing
    scene.add(targetRing)

    // 15. Local Player 3D Character Rig
    const playerGroup = new THREE.Group()
    playerGroup.position.set(player3DRef.current.x, 0, player3DRef.current.z)

    const eyeTex = createChibiEyeTexture(myMeta.avatarColor || '#6366f1')

    // Head
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.38 })
    )
    headMesh.position.y = 1.55
    headMesh.castShadow = true
    playerGroup.add(headMesh)

    // Cap / Beanie
    const hairMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.7),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
    )
    hairMesh.position.y = 1.62
    playerGroup.add(hairMesh)

    if (eyeTex) {
      const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTex })
      const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), eyeMat)
      eyeL.position.set(-0.2, 1.55, 0.52)
      playerGroup.add(eyeL)

      const eyeR = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), eyeMat)
      eyeR.position.set(0.2, 1.55, 0.52)
      playerGroup.add(eyeR)
    }

    // Body
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.5 })
    )
    bodyMesh.position.y = 0.85
    bodyMesh.castShadow = true
    playerGroup.add(bodyMesh)

    // Left & Right Feet
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.38), matBaseboard)
    footL.position.set(-0.22, 0.12, 0)
    footL.castShadow = true
    playerGroup.add(footL)

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.38), matBaseboard)
    footR.position.set(0.22, 0.12, 0)
    footR.castShadow = true
    playerGroup.add(footR)

    scene.add(playerGroup)

    // 16. Raycaster & Orbit Drag Controls
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerDown = (e) => {
      // Right Click or Alt-Click -> Orbit Camera Drag
      if (e.button === 2 || e.altKey) {
        orbitRef.current.isDragging = true
        orbitRef.current.prevX = e.clientX
        orbitRef.current.prevY = e.clientY
        e.preventDefault()
        return
      }

      // Left Click -> 3D Raycasted Click-to-Move
      if (e.button === 0) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const hits = raycaster.intersectObject(floorMesh)

        if (hits.length > 0) {
          const point = hits[0].point
          const targetX = Math.max(-ROOM_HALF_WIDTH + 1.2, Math.min(ROOM_HALF_WIDTH - 1.2, point.x))
          const targetZ = Math.max(-ROOM_HALF_DEPTH + 1.2, Math.min(ROOM_HALF_DEPTH - 1.2, point.z))

          player3DRef.current.targetX = targetX
          player3DRef.current.targetZ = targetZ
          player3DRef.current.sitState = false
          setIsSitting(false)

          targetRing.position.set(targetX, 0.03, targetZ)
          targetRing.scale.set(0.4, 0.4, 0.4)
          targetRing.material.opacity = 0.95
        }
      }
    }

    const onPointerMove = (e) => {
      if (orbitRef.current.isDragging) {
        const dx = e.clientX - orbitRef.current.prevX
        orbitRef.current.azimuth += dx * 0.006
        orbitRef.current.prevX = e.clientX
        orbitRef.current.prevY = e.clientY
      }
    }

    const onPointerUp = () => {
      orbitRef.current.isDragging = false
    }

    const onWheel = (e) => {
      e.preventDefault()
      orbitRef.current.distance = Math.max(12, Math.min(32, orbitRef.current.distance + e.deltaY * 0.02))
    }

    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('wheel', onWheel, { passive: false })
    domEl.addEventListener('contextmenu', (e) => e.preventDefault())

    // 17. 60-120fps Realtime Render & Physics Loop
    let animId
    const clock = new THREE.Clock()

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

      // Continuous Keyboard Movement (WASD & Arrow Keys)
      let moveX = 0
      let moveZ = 0

      if (keys['w'] || keys['arrowup']) moveZ -= 1
      if (keys['s'] || keys['arrowdown']) moveZ += 1
      if (keys['a'] || keys['arrowleft']) moveX -= 1
      if (keys['d'] || keys['arrowright']) moveX += 1

      if (moveX !== 0 || moveZ !== 0) {
        pState.targetX = null
        pState.targetZ = null
        pState.sitState = false
        setIsSitting(false)

        const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
        const vx = (moveX / len) * PLAYER_SPEED
        const vz = (moveZ / len) * PLAYER_SPEED

        // Rotate smoothly towards movement vector
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
        }
      } else if (pState.targetX !== null && pState.targetZ !== null && !pState.sitState) {
        // Click-to-Move Pathing
        const dx = pState.targetX - pState.x
        const dz = pState.targetZ - pState.z
        const dist = Math.sqrt(dx * dx + dz * dz)

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

      // Walking Leg & Arm Hop Animation
      if (pState.isMoving && !pState.sitState) {
        pState.hopPhase += delta * 12
        playerGroup.position.y = Math.abs(Math.sin(pState.hopPhase)) * 0.16
        footL.position.z = Math.sin(pState.hopPhase) * 0.18
        footR.position.z = -Math.sin(pState.hopPhase) * 0.18
      } else {
        playerGroup.position.y = pState.sitState ? -0.22 : 0
        footL.position.z = 0
        footR.position.z = 0
      }

      playerGroup.position.x = pState.x
      playerGroup.position.z = pState.z
      playerGroup.rotation.y = pState.rotation

      // Camera Orbit & Tracking Lerp
      const orbit = orbitRef.current
      const camDist = orbit.distance
      const camAngle = orbit.azimuth
      const camTargetX = pState.x + Math.sin(camAngle) * (camDist * 0.7)
      const camTargetZ = pState.z + Math.cos(camAngle) * (camDist * 0.7)
      const camTargetY = 14 + (camDist - 18) * 0.4

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, camTargetX, 0.06)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, camTargetY, 0.06)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, camTargetZ, 0.06)
      camera.lookAt(pState.x * 0.7, 1.2, pState.z * 0.7)

      // Project 3D Screen Coordinates for Floating HUD Labels
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
          sp.mesh.position.x = -0.1 + Math.random() * 0.2
          sp.mesh.scale.set(1, 1, 1)
          sp.mesh.material.opacity = 0.6
        }
      })

      // Proximity Detection to nearest 3D Station
      let nearest = null
      let minDist = Infinity
      for (const st of STATIONS_3D) {
        const dx = pState.x - st.x
        const dz = pState.z - st.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist <= st.radius && dist < minDist) {
          minDist = dist
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
      if (domEl && container.contains(domEl)) {
        container.removeChild(domEl)
      }
      renderer.dispose()
    }
  }, [myMeta.avatarColor, dogHappy])

  return (
    <div
      ref={mountRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
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

      {/* Floating 3D Interaction Prompt Beacon */}
      {activeStation && !isSitting && (
        <div
          onClick={() => executeStation(activeStation)}
          style={{
            position: 'absolute',
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '2px solid #818cf8',
            borderRadius: 14,
            padding: '10px 22px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 100,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.4)',
            animation: 'toastPop 0.2s ease',
          }}
        >
          <span style={{ fontSize: 20 }}>{activeStation.icon}</span>
          <span style={{ background: '#4f46e5', padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>E</span>
          <span>{activeStation.prompt.replace('[E] ', '')}</span>
        </div>
      )}

      {/* Sitting State Dock */}
      {isSitting && (
        <div
          style={{
            position: 'absolute',
            bottom: 68,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(17, 17, 19, 0.96)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: 14,
            padding: '8px 20px',
            fontSize: 12,
            color: '#c7d2fe',
            fontWeight: 700,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
          }}
        >
          <span>🛋️ Relaxing comfortably in 3D</span>
          <button
            onClick={() => onOpenPomodoro && onOpenPomodoro()}
            style={{
              background: '#4f46e5',
              border: 'none',
              borderRadius: 8,
              padding: '5px 14px',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Start 25m Pomodoro
          </button>
          <button
            onClick={() => {
              setIsSitting(false)
              player3DRef.current.sitState = false
            }}
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

      {/* Toast Buff Alerts */}
      {snackToast && (
        <div
          style={{
            position: 'absolute',
            top: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 27, 0.95)',
            border: '1px solid rgba(244, 114, 182, 0.4)',
            color: '#f472b6',
            borderRadius: 12,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 100,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            animation: 'toastPop 0.2s ease',
          }}
        >
          {snackToast}
        </div>
      )}

      {coffeeBuff && (
        <div
          style={{
            position: 'absolute',
            top: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24, 24, 27, 0.95)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: '#4ade80',
            borderRadius: 12,
            padding: '8px 18px',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 100,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
            animation: 'toastPop 0.2s ease',
          }}
        >
          ☕ 3D Espresso Focus Active (+10 Brainpower)!
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
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Speech Bubble */}
        {speechBubbles[myMeta.userId] && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(99, 102, 241, 0.6)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              color: '#e0e7ff',
              whiteSpace: 'nowrap',
              maxWidth: 200,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
              animation: 'toastPop 0.2s ease',
            }}
          >
            {speechBubbles[myMeta.userId].text}
          </div>
        )}

        {/* 3D Name Tag */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 800,
            color: '#a5b4fc',
            whiteSpace: 'nowrap',
          }}
        >
          {myMeta.displayName || 'You'} (you)
        </div>
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
          padding: '3px 14px',
          fontSize: 10,
          color: '#a1a1aa',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          zIndex: 80,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        🕹️ Walk: <span style={{ color: '#fff' }}>[W, A, S, D]</span> or click floor • Right-click drag to orbit • Scroll to zoom
      </div>

      {/* Floating Bottom Quick-Nav Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(17, 17, 19, 0.92)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: '6px 12px',
          backdropFilter: 'blur(10px)',
          zIndex: 80,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          maxWidth: '92vw',
          overflowX: 'auto',
        }}
      >
        <span style={{ fontSize: 9, color: '#71717a', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', paddingRight: 4 }}>
          3D Jump:
        </span>
        {STATIONS_3D.map((st) => (
          <button
            key={st.id}
            onClick={() => handleQuickNav(st)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#d4d4d8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{st.icon}</span>
            <span>{st.name}</span>
          </button>
        ))}
      </div>

      {/* SFX Mute Button (Bottom Left) */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 80 }}>
        <button
          onClick={() => setSoundOn(toggleLoungeSound())}
          style={{
            background: soundOn ? 'rgba(74, 222, 128, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${soundOn ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 10,
            padding: '6px 10px',
            color: soundOn ? '#4ade80' : '#f87171',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            backdropFilter: 'blur(10px)',
          }}
        >
          {soundOn ? '🔊 3D Audio' : '🔇 Muted'}
        </button>
      </div>
    </div>
  )
}
