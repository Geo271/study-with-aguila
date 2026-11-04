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
// Room bounds: X [-10.5, 10.5], Z [-10.5, 10.5]
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_HALF_WIDTH = 10.5
const ROOM_HALF_DEPTH = 10.5
const PLAYER_SPEED = 0.14
const ROT_SPEED = 0.18

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL TEXTURE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/** Polished warm oak hardwood floor planks */
function createWoodFloorTexture() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Base warm honey-oak tone
  ctx.fillStyle = '#c89666'
  ctx.fillRect(0, 0, 512, 512)

  // Planks
  const plankH = 32
  const rows = 512 / plankH
  for (let r = 0; r < rows; r++) {
    const y = r * plankH
    // Slight color variation per plank row
    const shade = (Math.sin(r * 3.7) * 8).toFixed(0)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + Math.abs(shade) / 100})`
    ctx.fillRect(0, y, 512, plankH)

    // Plank seam line
    ctx.strokeStyle = '#8a5a36'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()

    // Staggered vertical joints
    const cols = 4
    const offset = (r % 2) * 64
    for (let c = 0; c < cols; c++) {
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
  // Outer petals
  ctx.fillStyle = '#facc15'
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16
    const px = cx + Math.cos(angle) * 75
    const py = cy + Math.sin(angle) * 75
    ctx.beginPath()
    ctx.arc(px, py, 34, 0, Math.PI * 2)
    ctx.fill()
  }

  // Inner ring
  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.arc(cx, cy, 68, 0, Math.PI * 2)
  ctx.fill()

  // Center seed disc
  ctx.fillStyle = '#78350f'
  ctx.beginPath()
  ctx.arc(cx, cy, 48, 0, Math.PI * 2)
  ctx.fill()

  // Seed texture dots
  ctx.fillStyle = '#92400e'
  for (let d = 0; d < 40; d++) {
    const rad = Math.random() * 38
    const ang = Math.random() * Math.PI * 2
    ctx.fillRect(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 3, 3)
  }

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

/** Chibi Cute Eye Texture */
function createChibiEyeTexture(color = '#6366f1') {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Sclera white
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)

  // Large anime pupil
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(64, 64, 44, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(64, 64, 26, 0, Math.PI * 2)
  ctx.fill()

  // Specular gleam
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(50, 48, 12, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(76, 76, 6, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D INTERACTIVE STATIONS
// ─────────────────────────────────────────────────────────────────────────────
const STATIONS_3D = [
  {
    id: 'bookshelf',
    name: 'Study Vault',
    desc: 'Flashcards & Quizzes',
    icon: '📚',
    x: -7.5,
    z: -7.5,
    radius: 2.8,
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
    radius: 2.6,
    prompt: '[E] Brew Fresh Coffee',
    category: 'boost',
  },
  {
    id: 'petdoggo',
    name: 'Cozy Aguila Pup',
    desc: 'Alive & Wiggling',
    icon: '🐶',
    x: 7.2,
    z: -6.5,
    radius: 2.6,
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
    radius: 2.8,
    prompt: '[E] Sit on Sofa',
    category: 'seat',
    seatX: -6.0,
    seatZ: 4.2,
    seatRot: Math.PI / 4,
  },
  {
    id: 'dining_cake',
    name: 'Strawberry Cake',
    desc: 'Delicious study fuel',
    icon: '🍰',
    x: 4.5,
    z: 3.5,
    radius: 2.6,
    prompt: '[E] Eat Cake Slice',
    category: 'snack',
  },
  {
    id: 'jukebox',
    name: 'Lofi Jukebox',
    desc: 'Study soundtrack',
    icon: '🎵',
    x: 8.5,
    z: 1.5,
    radius: 2.4,
    prompt: '[E] Change Music',
    category: 'music',
  },
  {
    id: 'leaderboard',
    name: 'Hall of Fame',
    desc: 'Room records',
    icon: '🏆',
    x: 8.5,
    z: -2.5,
    radius: 2.4,
    prompt: '[E] View Room Rank',
    category: 'rank',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 3D COLLISION AABB OBSTACLES
// ─────────────────────────────────────────────────────────────────────────────
const OBSTACLES_3D = [
  // Outer walls
  { minX: -11.5, maxX: 11.5, minZ: -11.5, maxZ: -9.8 }, // Back wall
  { minX: -11.5, maxX: 11.5, minZ: 9.8, maxZ: 11.5 },   // Front wall
  { minX: -11.5, maxX: -9.8, minZ: -11.5, maxZ: 11.5 }, // Left wall
  { minX: 9.8, maxX: 11.5, minZ: -11.5, maxZ: 11.5 },   // Right wall

  // Bookshelf units
  { minX: -9.5, maxX: -5.5, minZ: -9.8, maxZ: -7.0 },

  // Barista counter
  { minX: -2.5, maxX: 4.5, minZ: -7.5, maxZ: -5.0 },

  // Sofa lounge cluster
  { minX: -8.5, maxX: -3.5, minZ: 2.5, maxZ: 6.5 },

  // Dining table cluster
  { minX: 2.5, maxX: 6.5, minZ: 1.5, maxZ: 5.5 },

  // Pet corner obstacle
  { minX: 6.0, maxX: 8.5, minZ: -7.8, maxZ: -5.5 },
]

function checkCollision3D(x, z, radius = 0.55) {
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
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 })

  // References for live 3D state
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

  const remoteMeshesRef = useRef(new Map())
  const dogMeshRef = useRef(null)
  const steamParticlesRef = useRef([])
  const targetRingMeshRef = useRef(null)
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
        if (onBroadcastBuff) onBroadcastBuff('🐶 Aguila doggo is joyfully wiggling & barking!')
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
        setSnackToast('🍰 *crunch munch* Double-Layer Strawberry Cake! +5 Study Energy')
        setTimeout(() => setSnackToast(null), 3500)
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

  // Keyboard navigation & interaction
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key.toLowerCase() === 'e' || e.key === ' ') {
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

      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) {
        if (isSitting) {
          setIsSitting(false)
          player3DRef.current.sitState = false
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
  // THREE.JS INITIALIZATION & SCENE RIGGING
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight

    // 1. Scene & Camera (Isometric 2.5D Angle)
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color(0x0f1117)
    scene.fog = new THREE.FogExp2(0x0f1117, 0.018)

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 120)
    camera.position.set(0, 16, 20)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // 2. WebGL Renderer with Shadows & Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 3. Cozy Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.4)
    scene.add(ambientLight)

    // Warm Sunbeam Directional Key Light
    const sunLight = new THREE.DirectionalLight(0xfef08a, 1.9)
    sunLight.position.set(12, 18, 8)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 1024
    sunLight.shadow.mapSize.height = 1024
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 45
    sunLight.shadow.camera.left = -16
    sunLight.shadow.camera.right = 16
    sunLight.shadow.camera.top = 16
    sunLight.shadow.camera.bottom = -16
    sunLight.shadow.bias = -0.0005
    scene.add(sunLight)

    // Soft sky-blue bounce fill
    const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.6)
    fillLight.position.set(-14, 8, -10)
    scene.add(fillLight)

    // Warm Golden Pendant Point Lights
    const cafeLight = new THREE.PointLight(0xf59e0b, 1.5, 12, 1.5)
    cafeLight.position.set(1.5, 4.5, -6.0)
    scene.add(cafeLight)

    const tableLight = new THREE.PointLight(0xfde047, 1.3, 10, 1.5)
    tableLight.position.set(4.5, 4.2, 3.5)
    scene.add(tableLight)

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
      color: 0xfef9f3,
      roughness: 0.7,
      metalness: 0.02,
    })

    const matBaseboard = new THREE.MeshStandardMaterial({
      color: 0x8a5a36,
      roughness: 0.4,
    })

    const matVelvetSofa = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.6,
      metalness: 0.05,
    })

    const matOak = new THREE.MeshStandardMaterial({
      color: 0x9a6538,
      roughness: 0.45,
    })

    const matCounterTop = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1,
    })

    const matChrome = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.1,
    })

    const matGold = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.75,
      roughness: 0.25,
    })

    const matLeaf = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.4,
    })

    const matMint = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      roughness: 0.5,
    })

    // 5. Floor & Architectural Walls
    const floorGeo = new THREE.BoxGeometry(22, 0.4, 22)
    const floorMesh = new THREE.Mesh(floorGeo, matWoodFloor)
    floorMesh.position.y = -0.2
    floorMesh.receiveShadow = true
    scene.add(floorMesh)

    // Back Wall
    const backWallGeo = new THREE.BoxGeometry(22, 8, 0.5)
    const backWall = new THREE.Mesh(backWallGeo, matWall)
    backWall.position.set(0, 4, -11)
    backWall.receiveShadow = true
    scene.add(backWall)

    // Left Wall
    const leftWallGeo = new THREE.BoxGeometry(0.5, 8, 22)
    const leftWall = new THREE.Mesh(leftWallGeo, matWall)
    leftWall.position.set(-11, 4, 0)
    leftWall.receiveShadow = true
    scene.add(leftWall)

    // Baseboards
    const baseboardBack = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 0.1), matBaseboard)
    baseboardBack.position.set(0, 0.3, -10.7)
    scene.add(baseboardBack)

    const baseboardLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 22), matBaseboard)
    baseboardLeft.position.set(-10.7, 0.3, 0)
    scene.add(baseboardLeft)

    // Large Study Window on Back Wall
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(7, 4.5, 0.2), matBaseboard)
    windowFrame.position.set(1.5, 4.5, -10.85)
    scene.add(windowFrame)

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0x93c5fd,
      emissiveIntensity: 0.45,
    })
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 4.1), glassMat)
    glassPane.position.set(1.5, 4.5, -10.74)
    scene.add(glassPane)

    // 6. Rugs
    // Sunflower Rug
    if (sunflowerTexture) {
      const sunRugGeo = new THREE.CircleGeometry(2.4, 32)
      const sunRugMat = new THREE.MeshStandardMaterial({
        map: sunflowerTexture,
        roughness: 0.8,
      })
      const sunRug = new THREE.Mesh(sunRugGeo, sunRugMat)
      sunRug.rotation.x = -Math.PI / 2
      sunRug.position.set(1.5, 0.02, -3.5)
      sunRug.receiveShadow = true
      scene.add(sunRug)
    }

    // Cozy Sage Lounge Rug
    const sageRug = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.6, 0.03, 32),
      new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.85 })
    )
    sageRug.position.set(-6.0, 0.015, 4.5)
    sageRug.scale.set(1, 1, 0.75)
    sageRug.receiveShadow = true
    scene.add(sageRug)

    // Mint Pet Mat
    const petMat = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.02, 32),
      matMint
    )
    petMat.position.set(7.2, 0.015, -6.5)
    petMat.receiveShadow = true
    scene.add(petMat)

    // 7. Bookshelf Unit (Study Vault)
    const bookcase = new THREE.Group()
    bookcase.position.set(-7.5, 0, -9.0)

    const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 7.0, 1.2), matOak)
    shelfFrame.position.y = 3.5
    shelfFrame.castShadow = true
    shelfFrame.receiveShadow = true
    bookcase.add(shelfFrame)

    // Shelves with 3D colorful books
    const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899]
    for (let shelf = 0; shelf < 4; shelf++) {
      const shelfY = 1.0 + shelf * 1.5
      for (let b = 0; b < 12; b++) {
        const bookW = 0.12 + (b % 3) * 0.04
        const bookH = 0.85 + (b % 4) * 0.15
        const bookMat = new THREE.MeshStandardMaterial({
          color: bookColors[(shelf * 3 + b) % bookColors.length],
          roughness: 0.4,
        })
        const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(bookW, bookH, 0.75), bookMat)
        bookMesh.position.set(-1.6 + b * 0.28, shelfY + bookH / 2, 0.1)
        bookMesh.castShadow = true
        bookcase.add(bookMesh)
      }
    }
    scene.add(bookcase)

    // 8. Barista Counter & Espresso Machine
    const counterGroup = new THREE.Group()
    counterGroup.position.set(1.5, 0, -6.2)

    // Wooden bar base
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.0, 1.6), matOak)
    barBase.position.y = 1.0
    barBase.castShadow = true
    barBase.receiveShadow = true
    counterGroup.add(barBase)

    // White marble countertop
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.25, 2.0), matCounterTop)
    barTop.position.y = 2.12
    barTop.castShadow = true
    barTop.receiveShadow = true
    counterGroup.add(barTop)

    // Chrome Espresso Machine
    const espressoMachine = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.0), matChrome)
    espressoMachine.position.set(-1.4, 2.85, 0)
    espressoMachine.castShadow = true
    counterGroup.add(espressoMachine)

    // Teapot & mugs
    const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 16), matChrome)
    kettle.position.set(1.2, 2.5, 0)
    kettle.castShadow = true
    counterGroup.add(kettle)

    // 3 Stools
    for (let s = -1; s <= 1; s++) {
      const stoolGroup = new THREE.Group()
      stoolGroup.position.set(s * 1.8, 0, 1.6)

      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 16), matMint)
      seat.position.y = 1.3
      seat.castShadow = true
      stoolGroup.add(seat)

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), matBaseboard)
      leg.position.y = 0.6
      leg.castShadow = true
      stoolGroup.add(leg)

      counterGroup.add(stoolGroup)
    }
    scene.add(counterGroup)

    // 9. Velvet Lounge Sofas
    const sofaGroup = new THREE.Group()
    sofaGroup.position.set(-6.0, 0, 4.5)

    // 3-seat Sofa
    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.8), matVelvetSofa)
    sofaBase.position.set(0, 0.5, 0)
    sofaBase.castShadow = true
    sofaGroup.add(sofaBase)

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.5), matVelvetSofa)
    sofaBack.position.set(0, 1.5, -0.65)
    sofaBack.castShadow = true
    sofaGroup.add(sofaBack)

    // Armrests
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 1.8), matVelvetSofa)
    armL.position.set(-2.0, 1.0, 0)
    armL.castShadow = true
    sofaGroup.add(armL)

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 1.8), matVelvetSofa)
    armR.position.set(2.0, 1.0, 0)
    armR.castShadow = true
    sofaGroup.add(armR)

    // Low wooden coffee table
    const tableMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), matOak)
    tableMesh.position.set(0, 0.4, 1.8)
    tableMesh.castShadow = true
    sofaGroup.add(tableMesh)

    scene.add(sofaGroup)

    // 10. Study Dining Table with Double-Decker Strawberry Cake
    const tableGroup = new THREE.Group()
    tableGroup.position.set(4.5, 0, 3.5)

    const diningTableTop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.15, 32), matCounterTop)
    diningTableTop.position.y = 1.6
    diningTableTop.castShadow = true
    diningTableTop.receiveShadow = true
    tableGroup.add(diningTableTop)

    const diningLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.5, 16), matOak)
    diningLeg.position.y = 0.8
    diningLeg.castShadow = true
    tableGroup.add(diningLeg)

    // Detailed 3D Strawberry Cake
    const cakeGroup = new THREE.Group()
    cakeGroup.position.set(0, 1.68, 0)

    // Bottom tier (vanilla sponge + pink frosting)
    const cakeBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.3 })
    )
    cakeBottom.position.y = 0.22
    cakeBottom.castShadow = true
    cakeGroup.add(cakeBottom)

    // Top tier
    const cakeTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    )
    cakeTop.position.y = 0.62
    cakeTop.castShadow = true
    cakeGroup.add(cakeTop)

    // Strawberries on top
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.2 })
    for (let sb = 0; sb < 5; sb++) {
      const ang = (sb * Math.PI * 2) / 5
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), berryMat)
      berry.position.set(Math.cos(ang) * 0.35, 0.84, Math.sin(ang) * 0.35)
      cakeGroup.add(berry)
    }
    tableGroup.add(cakeGroup)

    // 4 Dining Chairs
    for (let c = 0; c < 4; c++) {
      const ang = (c * Math.PI * 2) / 4
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), matOak)
      chair.position.set(Math.cos(ang) * 2.8, 0.5, Math.sin(ang) * 2.8)
      chair.castShadow = true
      tableGroup.add(chair)
    }
    scene.add(tableGroup)

    // 11. Living 3D Animated Aguila Doggo
    const dogGroup = new THREE.Group()
    dogGroup.position.set(7.2, 0, -6.5)

    const matDogFur = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 })
    const matDogWhite = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 })
    const matNose = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.2 })

    // Torso
    const dogBody = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), matDogFur)
    dogBody.scale.set(1.1, 0.85, 1.4)
    dogBody.position.y = 0.6
    dogBody.castShadow = true
    dogGroup.add(dogBody)

    // Head
    const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), matDogFur)
    dogHead.position.set(0, 1.1, 0.6)
    dogHead.castShadow = true
    dogGroup.add(dogHead)

    // Snout
    const dogSnout = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.35, 12), matDogWhite)
    dogSnout.rotation.x = Math.PI / 2
    dogSnout.position.set(0, 1.05, 0.95)
    dogGroup.add(dogSnout)

    const dogNose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), matNose)
    dogNose.position.set(0, 1.15, 1.12)
    dogGroup.add(dogNose)

    // Floppy Ears
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 8), matDogFur)
    earL.rotation.z = 0.5
    earL.position.set(-0.42, 1.35, 0.55)
    dogGroup.add(earL)

    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 8), matDogFur)
    earR.rotation.z = -0.5
    earR.position.set(0.42, 1.35, 0.55)
    dogGroup.add(earR)

    // Wiggling Tail
    const dogTail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), matDogFur)
    dogTail.rotation.x = -Math.PI / 4
    dogTail.position.set(0, 0.8, -0.9)
    dogGroup.add(dogTail)

    dogMeshRef.current = { group: dogGroup, tail: dogTail, head: dogHead }
    scene.add(dogGroup)

    // 12. 3D Steam Particles (from Espresso Machine)
    const steamGroup = new THREE.Group()
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    })
    const steamGeo = new THREE.SphereGeometry(0.14, 8, 8)
    const steamParticles = []
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(steamGeo, steamMat.clone())
      p.position.set(0.1 + Math.random() * 0.2, 3.0 + i * 0.25, -6.2)
      steamGroup.add(p)
      steamParticles.push({
        mesh: p,
        initialY: 3.0,
        speed: 0.015 + Math.random() * 0.015,
        drift: (Math.random() - 0.5) * 0.01,
      })
    }
    steamParticlesRef.current = steamParticles
    scene.add(steamGroup)

    // 13. Animated Destination Target Ring
    const targetRingGeo = new THREE.RingGeometry(0.4, 0.55, 32)
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    })
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat)
    targetRing.rotation.x = -Math.PI / 2
    targetRing.position.y = 0.03
    targetRingMeshRef.current = targetRing
    scene.add(targetRing)

    // 14. Local Player 3D Character Avatar Rig
    const playerGroup = new THREE.Group()
    playerGroup.position.set(player3DRef.current.x, 0, player3DRef.current.z)

    const eyeTex = createChibiEyeTexture(myMeta.avatarColor || '#6366f1')

    // Chibi Head
    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.4 })
    )
    headMesh.position.y = 1.55
    headMesh.castShadow = true
    playerGroup.add(headMesh)

    // Cap / Hair
    const hairMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })
    )
    hairMesh.position.y = 1.62
    playerGroup.add(hairMesh)

    // Chibi Eyes
    if (eyeTex) {
      const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTex })
      const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), eyeMat)
      eyeL.position.set(-0.2, 1.55, 0.52)
      playerGroup.add(eyeL)

      const eyeR = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), eyeMat)
      eyeR.position.set(0.2, 1.55, 0.52)
      playerGroup.add(eyeR)
    }

    // Body / Overalls
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.5 })
    )
    bodyMesh.position.y = 0.85
    bodyMesh.castShadow = true
    playerGroup.add(bodyMesh)

    // Feet / Shoes
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.35), matBaseboard)
    footL.position.set(-0.22, 0.12, 0)
    footL.castShadow = true
    playerGroup.add(footL)

    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.35), matBaseboard)
    footR.position.set(0.22, 0.12, 0)
    footR.castShadow = true
    playerGroup.add(footR)

    scene.add(playerGroup)

    // 15. Raycaster for 3D Click-to-Move
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerDown = (e) => {
      // Only handle primary click
      if (e.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObject(floorMesh)

      if (hits.length > 0) {
        const point = hits[0].point
        // Clamp destination to room interior
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

    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    // 16. Animation Loop (60-120fps)
    let animId
    let clock = new THREE.Clock()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      const pState = player3DRef.current

      // Target ring animation
      if (targetRing.material.opacity > 0.01) {
        targetRing.scale.addScalar(0.04)
        targetRing.material.opacity -= 0.03
      }

      // Smooth Click-to-Move Step
      if (pState.targetX !== null && pState.targetZ !== null && !pState.sitState) {
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

          // Target rotation towards motion
          const targetRot = Math.atan2(vx, vz)
          pState.rotation = THREE.MathUtils.lerp(pState.rotation, targetRot, ROT_SPEED)

          // 3D Obstacle collision check with sliding
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
      }

      // Avatar Walk Animation (Hop & Leg Swing)
      if (pState.isMoving && !pState.sitState) {
        pState.hopPhase += delta * 12
        playerGroup.position.y = Math.abs(Math.sin(pState.hopPhase)) * 0.16
        footL.position.z = Math.sin(pState.hopPhase) * 0.18
        footR.position.z = -Math.sin(pState.hopPhase) * 0.18
      } else {
        playerGroup.position.y = pState.sitState ? -0.2 : 0
        footL.position.z = 0
        footR.position.z = 0
      }

      playerGroup.position.x = pState.x
      playerGroup.position.z = pState.z
      playerGroup.rotation.y = pState.rotation

      // Smooth Camera Follow
      const targetCamX = pState.x * 0.6
      const targetCamZ = pState.z * 0.6 + 18
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.05)
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.05)
      camera.lookAt(pState.x * 0.5, 1.2, pState.z * 0.5)

      // Screen projection coordinates for 3D HUD billboard
      const projVector = new THREE.Vector3(pState.x, 2.4, pState.z)
      projVector.project(camera)
      const screenX = ((projVector.x + 1) / 2) * width
      const screenY = ((-projVector.y + 1) / 2) * height
      setScreenPos({ x: screenX, y: screenY })

      // Animate Doggo (Breathing & Tail Wagging)
      if (dogMeshRef.current) {
        const { tail, head, group } = dogMeshRef.current
        const wagSpeed = dogHappy ? 18 : 6
        const wagAngle = dogHappy ? 0.7 : 0.35
        tail.rotation.y = Math.sin(time * wagSpeed) * wagAngle
        head.rotation.y = Math.sin(time * 2) * 0.1
        group.scale.y = dogHappy ? 1 + Math.abs(Math.sin(time * 12)) * 0.2 : 1 + Math.sin(time * 2.5) * 0.03
      }

      // Animate 3D Steam Particles
      steamParticlesRef.current.forEach((sp) => {
        sp.mesh.position.y += sp.speed
        sp.mesh.position.x += sp.drift
        sp.mesh.scale.addScalar(0.006)
        sp.mesh.material.opacity -= 0.009
        if (sp.mesh.position.y > 4.4 || sp.mesh.material.opacity <= 0.02) {
          sp.mesh.position.y = sp.initialY
          sp.mesh.position.x = 0.1 + Math.random() * 0.2
          sp.mesh.scale.set(1, 1, 1)
          sp.mesh.material.opacity = 0.6
        }
      })

      // Proximity detection to nearest 3D station
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

    // Handle Resize
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
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
        @keyframes float3DHUD {
          0%, 100% { transform: translate(-50%, -100%) translateY(0); }
          50% { transform: translate(-50%, -100%) translateY(-6px); }
        }
        @keyframes toastPop {
          0% { opacity: 0; transform: translate(-50%, -10px) scale(0.9); }
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

      {/* Floating Bottom Navigation Bar */}
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
