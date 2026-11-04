'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * AguiMascot3D - Polished, Cute, and Interactive 3D Mascot Engine Rig
 * Built with Three.js (WebGL 60-120fps)
 * 
 * Features:
 * - Adorable Chibi Philippine Eagle 3D model (rounded head, feathery cheeks, cute blush, sparkling anime/Pixar eyes)
 * - 3-Axis dynamic head & gaze cursor tracking with ocular parallax
 * - Conversational lip-sync: articulated lower beak moves in speech rhythm when AI replies
 * - Secondary spring physics on crest plumage, graduation tassel, and accessories
 * - Organic breathing kinetics, weight shifts, and celebratory victory flaps
 * - Interactive 3D drag-to-orbit with spring return to front
 * - Snugly fitted 3D accessories: Scholar Glasses, Mortarboard Cap, Headphones, Royal Crown, Headband
 * - Studio vinyl-toy lighting (Key, Fill, and glowing Golden Rim light)
 * - Ground contact soft shadow on a carved wood stump perch
 */

export default function AguiMascot3D({
  mood = 'idle',
  accessory = 'none',
  isTyping = false,
  isInputFocused = false,
  interactive = true,
  size = 'lg',
  onPoke = null,
  onPet = null,
  squashTrigger = 0,
  happyTrigger = false,
  className = '',
}) {
  const mountRef = useRef(null)
  const [webglSupported, setWebglSupported] = useState(true)
  const [isInteracting, setIsInteracting] = useState(false)

  // Pixel sizing mapping
  const sizePx = {
    xs: 64,
    sm: 110,
    md: 160,
    lg: 210,
    xl: 250,
  }[size] || 210

  // Animation & control refs
  const stateRef = useRef({
    mood,
    accessory,
    isTyping,
    isInputFocused,
    happyTrigger,
    mouseX: 0,
    mouseY: 0,
    targetRotY: 0,
    targetRotX: 0,
    currentRotY: 0,
    currentRotX: 0,
    targetPupilX: 0,
    targetPupilY: 0,
    currentPupilX: 0,
    currentPupilY: 0,
    isBlinking: false,
    blinkProgress: 0,
    mouthOpen: 0,
    targetMouthOpen: 0,
    hopY: 0,
    hopVy: 0,
    spinRotY: 0,
    // Drag orbit controls
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    orbitRotY: 0,
    orbitRotX: 0,
    // Physics secondary lag
    crestAngle: 0,
    crestVelocity: 0,
    tasselAngle: 0,
    tasselVelocity: 0,
    // Petting tracking
    hoverCount: 0,
    lastHoverTime: 0,
  })

  // Keep stateRef synced with changing props
  useEffect(() => {
    stateRef.current.mood = mood
    stateRef.current.accessory = accessory
    stateRef.current.isTyping = isTyping
    stateRef.current.isInputFocused = isInputFocused
    stateRef.current.happyTrigger = happyTrigger
  }, [mood, accessory, isTyping, isInputFocused, happyTrigger])

  // React to external squash/poke trigger
  useEffect(() => {
    if (squashTrigger > 0) {
      stateRef.current.hopVy = 0.16
    }
  }, [squashTrigger])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // ── 1. WebGL Capability Detection ───────────────────────────────────────
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) {
        setWebglSupported(false)
        return
      }
    } catch (e) {
      setWebglSupported(false)
      return
    }

    // ── 2. Three.js Scene, Camera, & Renderer ──────────────────────────────
    const width = sizePx
    const height = sizePx

    const scene = new THREE.Scene()
    // Portrait lens FOV (35 deg) for zero fish-eye and maximum cuteness
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100)
    camera.position.set(0, 0.1, 4.9)

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)
    } catch (err) {
      console.warn('WebGL init error:', err)
      setWebglSupported(false)
      return
    }

    // ── 3. Warm Studio Character Lighting ──────────────────────────────────
    // Soft warm ambient base
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.4)
    scene.add(ambientLight)

    // Warm Key Light (top-right forward)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.9)
    keyLight.position.set(2.4, 4.0, 3.2)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 512
    keyLight.shadow.mapSize.height = 512
    keyLight.shadow.bias = -0.001
    scene.add(keyLight)

    // Soft sky-blue bounce fill (bottom-left)
    const fillLight = new THREE.DirectionalLight(0xbbe1fa, 0.8)
    fillLight.position.set(-2.8, 0.6, 2.0)
    scene.add(fillLight)

    // Glorious Golden Rim Backlight (high-craft halo on feathers)
    const rimLight = new THREE.DirectionalLight(0xfbbf24, 2.6)
    rimLight.position.set(0, 3.2, -3.2)
    scene.add(rimLight)

    // ── 4. Stylized Cute Materials (Soft-Matte Vinyl Toy / Pixar Aesthetic) ─
    const matPlumage = new THREE.MeshStandardMaterial({
      color: 0x98592c, // Warm tawny chestnut
      roughness: 0.42,
      metalness: 0.04,
    })
    const matPlumageLight = new THREE.MeshStandardMaterial({
      color: 0xb67543, // Warm golden honey
      roughness: 0.45,
      metalness: 0.04,
    })
    const matPlumageDark = new THREE.MeshStandardMaterial({
      color: 0x5a3114, // Dark chocolate mantle
      roughness: 0.48,
      metalness: 0.04,
    })
    const matChestBib = new THREE.MeshStandardMaterial({
      color: 0xfefcf7, // Soft fluffy ivory cream
      roughness: 0.4,
      metalness: 0.02,
    })
    const matGoldBeak = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // Warm golden yellow
      roughness: 0.22,
      metalness: 0.08,
    })
    const matBeakTip = new THREE.MeshStandardMaterial({
      color: 0x475569, // Slate gray hooked tip
      roughness: 0.35,
    })
    const matBeakInterior = new THREE.MeshStandardMaterial({
      color: 0x451a03, // Mouth cavity
      roughness: 0.7,
    })
    const matEyeWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
    })
    const matIris = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Deep amber honey
      emissive: 0x78350f,
      emissiveIntensity: 0.2,
      roughness: 0.12,
    })
    const matPupil = new THREE.MeshStandardMaterial({
      color: 0x090d16, // Obsidian black
      roughness: 0.05,
    })
    const matGlint = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    })
    const matBlush = new THREE.MeshBasicMaterial({
      color: 0xf87171, // Kawaii pink blush
      transparent: true,
      opacity: 0.65,
    })
    const matWoodBark = new THREE.MeshStandardMaterial({
      color: 0x5c381e,
      roughness: 0.7,
    })
    const matWoodTop = new THREE.MeshStandardMaterial({
      color: 0x9a6538,
      roughness: 0.55,
    })

    // ── 5. Hierarchical Character Model (Chibi Philippine Eagle) ───────────
    const characterRoot = new THREE.Group()
    scene.add(characterRoot)

    // Dynamic ground contact shadow plane
    const shadowGeo = new THREE.PlaneGeometry(2.3, 2.3)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0c0c0e,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat)
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.position.y = -1.24
    characterRoot.add(shadowPlane)

    // Perch: Cute Carved Tree Stump with growth rings
    const stumpBaseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.22, 28)
    const stumpBase = new THREE.Mesh(stumpBaseGeo, matWoodBark)
    stumpBase.position.y = -1.2
    stumpBase.receiveShadow = true
    characterRoot.add(stumpBase)

    const stumpTopGeo = new THREE.CylinderGeometry(0.83, 0.83, 0.02, 28)
    const stumpTop = new THREE.Mesh(stumpTopGeo, matWoodTop)
    stumpTop.position.y = -1.085
    stumpTop.receiveShadow = true
    characterRoot.add(stumpTop)

    // Golden bark ring accent
    const stumpRingGeo = new THREE.TorusGeometry(0.84, 0.02, 12, 36)
    const stumpRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.7,
      roughness: 0.3,
    })
    const stumpRing = new THREE.Mesh(stumpRingGeo, stumpRingMat)
    stumpRing.rotation.x = Math.PI / 2
    stumpRing.position.y = -1.09
    characterRoot.add(stumpRing)

    // ── Body / Torso Group (Chubby Cute Proportions) ──
    const bodyGroup = new THREE.Group()
    bodyGroup.position.y = -0.52
    characterRoot.add(bodyGroup)

    // Chubby Rounded Torso
    const torsoGeo = new THREE.SphereGeometry(0.74, 32, 28)
    torsoGeo.scale(0.96, 1.08, 0.9)
    const torsoMesh = new THREE.Mesh(torsoGeo, matPlumage)
    torsoMesh.castShadow = true
    bodyGroup.add(torsoMesh)

    // Fluffy Cream Chest Bib
    const bibGeo = new THREE.SphereGeometry(0.62, 24, 20)
    bibGeo.scale(0.88, 1.0, 0.45)
    const bibMesh = new THREE.Mesh(bibGeo, matChestBib)
    bibMesh.position.set(0, -0.04, 0.46)
    bodyGroup.add(bibMesh)

    // Cute Golden Talons (Perched naturally on the stump)
    const createTalon = (xPos) => {
      const footGroup = new THREE.Group()
      footGroup.position.set(xPos, -0.62, 0.25)
      bodyGroup.add(footGroup)

      const toeGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.26, 10)
      toeGeo.rotateX(Math.PI / 2.2)

      const toe1 = new THREE.Mesh(toeGeo, matGoldBeak)
      toe1.position.set(-0.08, 0, 0)
      toe1.rotation.y = -0.25
      footGroup.add(toe1)

      const toe2 = new THREE.Mesh(toeGeo, matGoldBeak)
      toe2.position.set(0, 0, 0.03)
      footGroup.add(toe2)

      const toe3 = new THREE.Mesh(toeGeo, matGoldBeak)
      toe3.position.set(0.08, 0, 0)
      toe3.rotation.y = 0.25
      footGroup.add(toe3)
    }
    createTalon(-0.28)
    createTalon(0.28)

    // Tail Feathers Group
    const tailGroup = new THREE.Group()
    tailGroup.position.set(0, -0.58, -0.58)
    bodyGroup.add(tailGroup)

    const tailGeo = new THREE.BoxGeometry(0.42, 0.08, 0.62)
    tailGeo.translate(0, 0, -0.26)
    const tailMesh = new THREE.Mesh(tailGeo, matPlumageDark)
    tailMesh.rotation.x = -0.32
    tailGroup.add(tailMesh)

    // ── Articulated Wings (Cute rounded paddles) ──
    const wingGeo = new THREE.ConeGeometry(0.36, 0.95, 18)
    wingGeo.scale(0.32, 1.0, 0.75)
    wingGeo.rotateZ(Math.PI)
    wingGeo.translate(0, -0.36, 0)

    const leftWingGroup = new THREE.Group()
    leftWingGroup.position.set(-0.72, 0.12, 0)
    bodyGroup.add(leftWingGroup)
    const leftWingMesh = new THREE.Mesh(wingGeo, matPlumageDark)
    leftWingMesh.castShadow = true
    leftWingGroup.add(leftWingMesh)

    const rightWingGroup = new THREE.Group()
    rightWingGroup.position.set(0.72, 0.12, 0)
    bodyGroup.add(rightWingGroup)
    const rightWingMesh = new THREE.Mesh(wingGeo, matPlumageDark)
    rightWingMesh.castShadow = true
    rightWingGroup.add(rightWingMesh)

    // Study Mode Accessory: Cute Red Study Book
    const bookGroup = new THREE.Group()
    bookGroup.position.set(0, -0.22, 0.62)
    bookGroup.rotation.x = -0.4
    bodyGroup.add(bookGroup)

    const bookCoverMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
    const bookCoverGeo = new THREE.BoxGeometry(0.65, 0.48, 0.08)
    const bookCover = new THREE.Mesh(bookCoverGeo, bookCoverMat)
    bookGroup.add(bookCover)

    const bookPagesMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    const bookPagesGeo = new THREE.BoxGeometry(0.62, 0.45, 0.06)
    const bookPages = new THREE.Mesh(bookPagesGeo, bookPagesMat)
    bookPages.position.z = 0.015
    bookGroup.add(bookPages)

    // ── Head Group (Large, Rounded, Chibi Cute Head) ──
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.58, 0.06)
    bodyGroup.add(headGroup)

    // Head Skull Mesh (Smooth cute sphere)
    const headGeo = new THREE.SphereGeometry(0.75, 32, 28)
    headGeo.scale(1.05, 0.98, 1.02)
    const headMesh = new THREE.Mesh(headGeo, matPlumage)
    headMesh.castShadow = true
    headGroup.add(headMesh)

    // Cheeks: Soft rounded feather cheeks
    const cheekGeo = new THREE.SphereGeometry(0.35, 18, 14)
    cheekGeo.scale(1.0, 0.8, 0.7)

    const leftCheek = new THREE.Mesh(cheekGeo, matPlumageLight)
    leftCheek.position.set(-0.48, -0.16, 0.32)
    headGroup.add(leftCheek)

    const rightCheek = new THREE.Mesh(cheekGeo, matPlumageLight)
    rightCheek.position.set(0.48, -0.16, 0.32)
    headGroup.add(rightCheek)

    // Kawaii Pink Blush Discs
    const blushGeo = new THREE.CircleGeometry(0.12, 18)
    const leftBlush = new THREE.Mesh(blushGeo, matBlush)
    leftBlush.position.set(-0.46, -0.14, 0.62)
    leftBlush.rotation.y = -0.35
    headGroup.add(leftBlush)

    const rightBlush = new THREE.Mesh(blushGeo, matBlush)
    rightBlush.position.set(0.46, -0.14, 0.62)
    rightBlush.rotation.y = 0.35
    headGroup.add(rightBlush)

    // ── Philippine Eagle Iconic Feather Crest Plumes (Crown of Feathers) ──
    const crestGroup = new THREE.Group()
    crestGroup.position.set(0, 0.54, -0.15)
    headGroup.add(crestGroup)

    // Radiating fan of 5 soft plumes with spring damping
    const plumeAngles = [-0.48, -0.22, 0, 0.22, 0.48]
    plumeAngles.forEach((angle, idx) => {
      const plumeGeo = new THREE.ConeGeometry(0.13, 0.62 - Math.abs(angle) * 0.18, 10)
      plumeGeo.scale(0.35, 1.0, 0.75)
      plumeGeo.translate(0, 0.28, 0)
      const plumeMesh = new THREE.Mesh(plumeGeo, idx % 2 === 0 ? matPlumageLight : matPlumage)
      plumeMesh.rotation.z = angle
      plumeMesh.rotation.x = -0.42 - Math.abs(angle) * 0.12
      crestGroup.add(plumeMesh)
    })

    // ── Cute Beak Assembly with Conversational Speech Lip-Sync ──
    const beakGroup = new THREE.Group()
    beakGroup.position.set(0, -0.08, 0.68)
    headGroup.add(beakGroup)

    // Upper Cute Raptor Beak
    const upperBeakGeo = new THREE.ConeGeometry(0.18, 0.42, 18)
    upperBeakGeo.scale(0.85, 1.0, 0.9)
    upperBeakGeo.rotateX(Math.PI / 2.3)
    upperBeakGeo.translate(0, 0.02, 0.16)
    const upperBeakMesh = new THREE.Mesh(upperBeakGeo, matGoldBeak)
    upperBeakMesh.castShadow = true
    beakGroup.add(upperBeakMesh)

    // Hooked tip
    const tipGeo = new THREE.ConeGeometry(0.09, 0.22, 14)
    tipGeo.rotateX(Math.PI / 2.1)
    tipGeo.translate(0, -0.04, 0.28)
    const tipMesh = new THREE.Mesh(tipGeo, matBeakTip)
    beakGroup.add(tipMesh)

    // Lower Beak / Jaw (Pivot for speech lip-sync!)
    const lowerBeakGroup = new THREE.Group()
    lowerBeakGroup.position.set(0, -0.11, 0.12)
    beakGroup.add(lowerBeakGroup)

    const lowerBeakGeo = new THREE.ConeGeometry(0.13, 0.28, 14)
    lowerBeakGeo.scale(0.75, 1.0, 0.8)
    lowerBeakGeo.rotateX(Math.PI / 2.1)
    lowerBeakGeo.translate(0, -0.02, 0.1)
    const lowerBeakMesh = new THREE.Mesh(lowerBeakGeo, matGoldBeak)
    lowerBeakGroup.add(lowerBeakMesh)

    // Inner mouth cavity
    const mouthCavityGeo = new THREE.SphereGeometry(0.09, 10, 8)
    mouthCavityGeo.scale(0.8, 0.45, 0.8)
    const mouthCavityMesh = new THREE.Mesh(mouthCavityGeo, matBeakInterior)
    mouthCavityMesh.position.set(0, 0, 0.08)
    lowerBeakGroup.add(mouthCavityMesh)

    // ── Big Expressive Anime/Pixar Eyes with Specular Glints ──
    const eyeSpacing = 0.29
    const eyeHeight = 0.08
    const eyeDepth = 0.64

    const createEyeAssembly = (isRight = false) => {
      const eyeAssembly = new THREE.Group()
      const xPos = isRight ? eyeSpacing : -eyeSpacing
      eyeAssembly.position.set(xPos, eyeHeight, eyeDepth)
      headGroup.add(eyeAssembly)

      // Slight forward raptor angle
      eyeAssembly.rotation.y = isRight ? 0.18 : -0.18

      // Sclera (Eye White Sphere)
      const eyeWhiteGeo = new THREE.SphereGeometry(0.175, 24, 20)
      const eyeWhite = new THREE.Mesh(eyeWhiteGeo, matEyeWhite)
      eyeAssembly.add(eyeWhite)

      // Large Amber Iris
      const irisGeo = new THREE.SphereGeometry(0.135, 20, 16)
      const irisMesh = new THREE.Mesh(irisGeo, matIris)
      irisMesh.position.set(0, 0, 0.07)
      eyeAssembly.add(irisMesh)

      // Deep Obsidian Pupil
      const pupilGeo = new THREE.SphereGeometry(0.092, 16, 12)
      const pupilMesh = new THREE.Mesh(pupilGeo, matPupil)
      pupilMesh.position.set(0, 0, 0.11)
      eyeAssembly.add(pupilMesh)

      // Primary Specular Catchlight (Top-Left)
      const glintGeo = new THREE.SphereGeometry(0.038, 10, 8)
      const glintMesh = new THREE.Mesh(glintGeo, matGlint)
      glintMesh.position.set(-0.032, 0.045, 0.155)
      eyeAssembly.add(glintMesh)

      // Secondary Micro Sparkle (Bottom-Right)
      const microGlintGeo = new THREE.SphereGeometry(0.018, 8, 6)
      const microGlint = new THREE.Mesh(microGlintGeo, matGlint)
      microGlint.position.set(0.035, -0.032, 0.155)
      eyeAssembly.add(microGlint)

      // Dynamic Eyelid (Rotates down for natural organic blinks)
      const eyelidGeo = new THREE.SphereGeometry(0.188, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const eyelidMesh = new THREE.Mesh(eyelidGeo, matPlumage)
      eyelidMesh.rotation.x = -Math.PI / 2 // Hidden above eye when open
      eyeAssembly.add(eyelidMesh)

      // Brow Tuft
      const browGeo = new THREE.BoxGeometry(0.24, 0.055, 0.14)
      const browMesh = new THREE.Mesh(browGeo, matPlumageDark)
      browMesh.position.set(0, 0.16, 0.05)
      browMesh.rotation.z = isRight ? -0.12 : 0.12
      eyeAssembly.add(browMesh)

      return {
        assembly: eyeAssembly,
        iris: irisMesh,
        pupil: pupilMesh,
        eyelid: eyelidMesh,
        brow: browMesh,
      }
    }

    const leftEye = createEyeAssembly(false)
    const rightEye = createEyeAssembly(true)

    // ── 6. Snugly Fitted 3D Accessories ────────────────────────────────────
    const accessoriesGroup = new THREE.Group()
    headGroup.add(accessoriesGroup)

    // 1. Scholar Glasses (Snug on beak bridge)
    const glassesGroup = new THREE.Group()
    glassesGroup.position.set(0, 0.08, 0.74)
    accessoriesGroup.add(glassesGroup)

    const glassFrameMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.18,
    })
    const glassLensMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      transmission: 0.85,
    })

    const rimGeo = new THREE.TorusGeometry(0.16, 0.018, 12, 28)
    const leftRim = new THREE.Mesh(rimGeo, glassFrameMat)
    leftRim.position.set(-0.29, 0, 0)
    glassesGroup.add(leftRim)

    const lensGeo = new THREE.CircleGeometry(0.15, 24)
    const leftLens = new THREE.Mesh(lensGeo, glassLensMat)
    leftLens.position.set(-0.29, 0, 0.01)
    glassesGroup.add(leftLens)

    const rightRim = new THREE.Mesh(rimGeo, glassFrameMat)
    rightRim.position.set(0.29, 0, 0)
    glassesGroup.add(rightRim)

    const rightLens = new THREE.Mesh(lensGeo, glassLensMat)
    rightLens.position.set(0.29, 0, 0.01)
    glassesGroup.add(rightLens)

    const bridgeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8)
    const bridgeMesh = new THREE.Mesh(bridgeGeo, glassFrameMat)
    bridgeMesh.rotation.z = Math.PI / 2
    bridgeMesh.position.set(0, 0.02, 0.02)
    glassesGroup.add(bridgeMesh)

    // 2. Graduation Cap (Level & snug on head with swinging tassel)
    const capGroup = new THREE.Group()
    capGroup.position.set(0, 0.74, 0.02)
    accessoriesGroup.add(capGroup)

    const capMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
    const mortarboardGeo = new THREE.BoxGeometry(1.05, 0.045, 1.05)
    mortarboardGeo.rotateY(Math.PI / 4)
    const mortarboardMesh = new THREE.Mesh(mortarboardGeo, capMat)
    capGroup.add(mortarboardMesh)

    const skullCapGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.18, 24)
    const skullCapMesh = new THREE.Mesh(skullCapGeo, capMat)
    skullCapMesh.position.y = -0.09
    capGroup.add(skullCapMesh)

    const tasselBtnGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12)
    const tasselBtn = new THREE.Mesh(tasselBtnGeo, matGoldBeak)
    tasselBtn.position.y = 0.03
    capGroup.add(tasselBtn)

    const tasselPivot = new THREE.Group()
    tasselPivot.position.set(0.18, 0.03, 0.18)
    capGroup.add(tasselPivot)

    const tasselStringGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8)
    tasselStringGeo.translate(0, -0.21, 0)
    const tasselString = new THREE.Mesh(tasselStringGeo, matGoldBeak)
    tasselPivot.add(tasselString)

    const tasselEndGeo = new THREE.ConeGeometry(0.055, 0.14, 8)
    tasselEndGeo.translate(0, -0.42, 0)
    const tasselEnd = new THREE.Mesh(tasselEndGeo, matGoldBeak)
    tasselPivot.add(tasselEnd)

    // 3. Lo-Fi Headphones (Hugging cheeks)
    const headphonesGroup = new THREE.Group()
    headphonesGroup.position.set(0, 0.32, 0)
    accessoriesGroup.add(headphonesGroup)

    const hpBandGeo = new THREE.TorusGeometry(0.74, 0.038, 12, 32, Math.PI)
    const hpBandMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 })
    const hpBand = new THREE.Mesh(hpBandGeo, hpBandMat)
    hpBand.rotation.z = -Math.PI / 2
    headphonesGroup.add(hpBand)

    const earcupMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 })
    const earcupGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 20)
    earcupGeo.rotateZ(Math.PI / 2)

    const leftEarcup = new THREE.Mesh(earcupGeo, earcupMat)
    leftEarcup.position.set(-0.74, 0, 0)
    headphonesGroup.add(leftEarcup)

    const rightEarcup = new THREE.Mesh(earcupGeo, earcupMat)
    rightEarcup.position.set(0.74, 0, 0)
    headphonesGroup.add(rightEarcup)

    // 4. Royal Honor Crown (Snug, level atop head)
    const crownGroup = new THREE.Group()
    crownGroup.position.set(0, 0.74, 0)
    accessoriesGroup.add(crownGroup)

    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.15,
    })
    const crownBaseGeo = new THREE.CylinderGeometry(0.48, 0.50, 0.12, 24, 1, true)
    const crownBase = new THREE.Mesh(crownBaseGeo, crownMat)
    crownGroup.add(crownBase)

    // 5 Crown Peaks with ruby & sapphire jewels
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const peakGeo = new THREE.ConeGeometry(0.1, 0.28, 8)
      const peakMesh = new THREE.Mesh(peakGeo, crownMat)
      peakMesh.position.set(Math.cos(angle) * 0.48, 0.19, Math.sin(angle) * 0.48)
      crownGroup.add(peakMesh)

      const jewelGeo = new THREE.DodecahedronGeometry(0.04)
      const jewelMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0x3b82f6,
        roughness: 0.1,
        metalness: 0.4,
        emissive: i % 2 === 0 ? 0xb91c1c : 0x1d4ed8,
        emissiveIntensity: 0.5,
      })
      const jewelMesh = new THREE.Mesh(jewelGeo, jewelMat)
      jewelMesh.position.set(Math.cos(angle) * 0.49, 0.02, Math.sin(angle) * 0.49)
      crownGroup.add(jewelMesh)
    }

    // 5. Martial Arts Headband
    const headbandGroup = new THREE.Group()
    headbandGroup.position.set(0, 0.24, 0.06)
    accessoriesGroup.add(headbandGroup)

    const bandMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    const bandGeo = new THREE.TorusGeometry(0.72, 0.045, 12, 32)
    const bandMesh = new THREE.Mesh(bandGeo, bandMat)
    bandMesh.rotation.x = Math.PI / 2
    headbandGroup.add(bandMesh)

    const ribbonGeo = new THREE.BoxGeometry(0.08, 0.42, 0.02)
    ribbonGeo.translate(0, -0.19, 0)
    const leftRibbon = new THREE.Mesh(ribbonGeo, bandMat)
    leftRibbon.position.set(-0.14, -0.04, -0.72)
    leftRibbon.rotation.x = 0.38
    leftRibbon.rotation.y = -0.18
    headbandGroup.add(leftRibbon)

    const rightRibbon = new THREE.Mesh(ribbonGeo, bandMat)
    rightRibbon.position.set(0.14, -0.04, -0.72)
    rightRibbon.rotation.x = 0.28
    rightRibbon.rotation.y = 0.18
    headbandGroup.add(rightRibbon)

    const updateAccessoriesVisibility = (acc) => {
      glassesGroup.visible = acc === 'glasses'
      capGroup.visible = acc === 'cap'
      headphonesGroup.visible = acc === 'headphones'
      crownGroup.visible = acc === 'crown'
      headbandGroup.visible = acc === 'headband'
    }
    updateAccessoriesVisibility(accessory)

    // ── 7. Organic Blinking Engine (Natural timing + double blinks) ─────────
    let blinkTimer = null
    const triggerBlink = () => {
      stateRef.current.isBlinking = true
      stateRef.current.blinkProgress = 0

      const nextDelay = 2600 + Math.random() * 3200
      blinkTimer = setTimeout(() => {
        triggerBlink()
        if (Math.random() < 0.25) {
          setTimeout(() => {
            stateRef.current.isBlinking = true
            stateRef.current.blinkProgress = 0
          }, 220)
        }
      }, nextDelay)
    }
    blinkTimer = setTimeout(triggerBlink, 2000)

    // ── 8. Conversational Lip-Sync Movement (Speech Beak Flap) ─────────────
    let flapInterval = null
    const syncLipMovement = () => {
      if (stateRef.current.isTyping) {
        stateRef.current.targetMouthOpen = Math.random() > 0.32 ? 0.35 + Math.random() * 0.55 : 0
      } else {
        stateRef.current.targetMouthOpen = 0
      }
    }
    flapInterval = setInterval(syncLipMovement, 90)

    // ── 9. Interactive Mouse Gaze & Orbit Drag Controls ─────────────────────
    const handlePointerMove = (e) => {
      const state = stateRef.current
      if (state.isDragging) {
        const deltaX = e.clientX - state.dragStartX
        const deltaY = e.clientY - state.dragStartY
        state.orbitRotY += deltaX * 0.008
        state.orbitRotX = Math.max(-0.45, Math.min(0.45, state.orbitRotX + deltaY * 0.006))
        state.dragStartX = e.clientX
        state.dragStartY = e.clientY
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const nx = (e.clientX - centerX) / (window.innerWidth / 2)
      const ny = (e.clientY - centerY) / (window.innerHeight / 2)

      state.mouseX = nx
      state.mouseY = ny

      state.targetRotY = Math.max(-0.55, Math.min(0.55, nx * 0.65))
      state.targetRotX = Math.max(-0.38, Math.min(0.38, -ny * 0.48))

      state.targetPupilX = Math.max(-0.055, Math.min(0.055, nx * 0.06))
      state.targetPupilY = Math.max(-0.04, Math.min(0.04, -ny * 0.045))

      if (state.isInputFocused) {
        state.targetRotX = -0.28
        state.targetPupilY = -0.04
      }

      if (state.mood === 'thinking' || state.isTyping) {
        state.targetRotX += 0.12
        state.targetRotY += 0.1
      }
    }

    const handlePointerDown = (e) => {
      if (!interactive) return
      stateRef.current.isDragging = true
      stateRef.current.dragStartX = e.clientX
      stateRef.current.dragStartY = e.clientY
      setIsInteracting(true)
    }

    const handlePointerUp = () => {
      stateRef.current.isDragging = false
      setIsInteracting(false)
    }

    const handlePointerLeave = () => {
      stateRef.current.isDragging = false
      setIsInteracting(false)
      stateRef.current.targetRotY = 0
      stateRef.current.targetRotX = 0
      stateRef.current.targetPupilX = 0
      stateRef.current.targetPupilY = 0
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerUp)

    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', handlePointerDown)
    domEl.addEventListener('pointerleave', handlePointerLeave)

    // ── 10. Main Animation Loop (60-120fps RAF) ─────────────────────────────
    let animationFrameId
    let clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const delta = Math.min(clock.getDelta(), 0.1)
      const time = clock.getElapsedTime()
      const state = stateRef.current

      updateAccessoriesVisibility(state.accessory)

      // Book visibility in study mood
      bookGroup.visible = state.mood === 'studying'

      // 1. Organic Breathing Kinetics
      const breathSpeed = state.mood === 'timer' ? 1.6 : (state.mood === 'celebrating' ? 4.2 : 2.5)
      const breathWave = Math.sin(time * breathSpeed)
      const breathScale = 1 + breathWave * 0.024
      torsoMesh.scale.set(0.96 * breathScale, 1.08 * breathScale, 0.9 * breathScale)
      bibMesh.scale.set(0.88 * breathScale, 1.0 * breathScale, 0.45 * breathScale)

      // 2. Hop / Squash Physics
      if (state.hopVy !== 0 || state.hopY > 0) {
        state.hopY += state.hopVy
        state.hopVy -= 0.015

        if (state.hopY <= 0) {
          state.hopY = 0
          state.hopVy = 0
        }
      }

      // Idle gentle weight shift
      const weightShift = Math.sin(time * 0.8) * 0.035
      const bobY = Math.sin(time * breathSpeed) * 0.03

      characterRoot.position.y = state.hopY + bobY

      const shadowScale = Math.max(0.65, 1 - state.hopY * 0.5)
      shadowPlane.scale.set(shadowScale, shadowScale, shadowScale)
      shadowMat.opacity = Math.max(0.2, 0.45 - state.hopY * 0.22)

      // 3. Smooth Gaze Damping
      state.currentRotY += (state.targetRotY - state.currentRotY) * 0.11
      state.currentRotX += (state.targetRotX - state.currentRotX) * 0.11

      state.currentPupilX += (state.targetPupilX - state.currentPupilX) * 0.16
      state.currentPupilY += (state.targetPupilY - state.currentPupilY) * 0.16

      // Spring drag back to center
      if (!state.isDragging) {
        state.orbitRotY += (0 - state.orbitRotY) * 0.07
        state.orbitRotX += (0 - state.orbitRotX) * 0.07
      }

      // 4. Wing Motions per Mood
      if (state.mood === 'celebrating') {
        state.spinRotY += delta * 3.2
        leftWingGroup.rotation.z = Math.sin(time * 12) * 0.65 - 0.35
        rightWingGroup.rotation.z = -Math.sin(time * 12) * 0.65 + 0.35
      } else if (state.mood === 'studying') {
        state.spinRotY += (0 - state.spinRotY) * 0.1
        leftWingGroup.rotation.z = 0.22
        rightWingGroup.rotation.z = -0.22
        leftWingGroup.rotation.x = 0.32
        rightWingGroup.rotation.x = 0.32
      } else {
        state.spinRotY += (0 - state.spinRotY) * 0.08
        leftWingGroup.rotation.z = Math.sin(time * breathSpeed) * 0.04
        rightWingGroup.rotation.z = -Math.sin(time * breathSpeed) * 0.04
        leftWingGroup.rotation.x = 0
        rightWingGroup.rotation.x = 0
      }

      characterRoot.rotation.y = state.orbitRotY + state.spinRotY + weightShift
      characterRoot.rotation.x = state.orbitRotX
      characterRoot.rotation.z = -weightShift * 0.35

      // Head Gaze & Conversational Nod
      const conversationalNod = state.isTyping ? Math.sin(time * 9) * 0.035 : 0
      headGroup.rotation.y = state.currentRotY
      headGroup.rotation.x = state.currentRotX + conversationalNod
      headGroup.rotation.z = state.currentRotY * 0.16

      // 5. Secondary Crest & Tassel Physics
      const crestTarget = -state.currentRotY * 0.32
      const crestForce = (crestTarget - state.crestAngle) * 32
      state.crestVelocity = (state.crestVelocity + crestForce * delta) * 0.88
      state.crestAngle += state.crestVelocity * delta
      crestGroup.rotation.y = state.crestAngle
      crestGroup.rotation.z = state.crestAngle * 0.22

      const tasselForce = (-state.currentRotY * 0.7 - state.tasselAngle) * 28
      state.tasselVelocity = (state.tasselVelocity + tasselForce * delta) * 0.88
      state.tasselAngle += state.tasselVelocity * delta
      tasselPivot.rotation.z = state.tasselAngle

      // 6. Pupil Gaze Displacement
      leftEye.iris.position.x = state.currentPupilX
      leftEye.iris.position.y = state.currentPupilY
      leftEye.pupil.position.x = state.currentPupilX * 1.12
      leftEye.pupil.position.y = state.currentPupilY * 1.12

      rightEye.iris.position.x = state.currentPupilX
      rightEye.iris.position.y = state.currentPupilY
      rightEye.pupil.position.x = state.currentPupilX * 1.12
      rightEye.pupil.position.y = state.currentPupilY * 1.12

      // 7. Dynamic Blinking & Happy Squint
      const isHappy = state.happyTrigger || state.mood === 'celebrating'
      if (isHappy) {
        leftEye.eyelid.rotation.x = -0.22
        rightEye.eyelid.rotation.x = -0.22
        leftEye.brow.rotation.z = -0.28
        rightEye.brow.rotation.z = 0.28
      } else if (state.isBlinking) {
        state.blinkProgress += delta * 18
        if (state.blinkProgress >= Math.PI) {
          state.isBlinking = false
          leftEye.eyelid.rotation.x = -Math.PI / 2
          rightEye.eyelid.rotation.x = -Math.PI / 2
        } else {
          const blinkRot = -Math.PI / 2 + Math.sin(state.blinkProgress) * 1.6
          leftEye.eyelid.rotation.x = blinkRot
          rightEye.eyelid.rotation.x = blinkRot
        }
      } else {
        leftEye.eyelid.rotation.x = -Math.PI / 2
        rightEye.eyelid.rotation.x = -Math.PI / 2

        if (state.mood === 'studying') {
          leftEye.brow.rotation.z = 0.26
          rightEye.brow.rotation.z = -0.26
        } else if (state.mood === 'thinking') {
          leftEye.brow.rotation.z = -0.1
          rightEye.brow.rotation.z = -0.32
        } else {
          leftEye.brow.rotation.z = 0.12
          rightEye.brow.rotation.z = -0.12
        }
      }

      // 8. Conversational Lip-Sync Movement (Beak Flap)
      state.mouthOpen += (state.targetMouthOpen - state.mouthOpen) * 0.32
      lowerBeakGroup.rotation.x = state.mouthOpen * 0.42

      renderer.render(scene, camera)
    }

    animate()

    // ── 11. Cleanup on Unmount ──────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId)
      clearTimeout(blinkTimer)
      clearInterval(flapInterval)

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      domEl.removeEventListener('pointerdown', handlePointerDown)
      domEl.removeEventListener('pointerleave', handlePointerLeave)

      if (renderer) {
        renderer.dispose()
        if (domEl && domEl.parentNode) {
          domEl.parentNode.removeChild(domEl)
        }
      }

      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
    }
  }, [sizePx, interactive])

  const handleClick = (e) => {
    if (onPoke) {
      onPoke(e)
    }
  }

  const handlePointerEnter = () => {
    const now = Date.now()
    const state = stateRef.current
    if (now - state.lastHoverTime < 450) {
      state.hoverCount += 1
    } else {
      state.hoverCount = 1
    }
    state.lastHoverTime = now

    if (state.hoverCount >= 3) {
      state.hoverCount = 0
      if (onPet) onPet()
    }
  }

  if (!webglSupported) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot-idle.png"
          alt="Agui Mascot 2D Fallback"
          width={sizePx}
          height={sizePx}
          className="object-contain"
        />
      </div>
    )
  }

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      title="Agui 3D Mascot - drag to rotate in 3D, click to interact, pet to purr"
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        cursor: isInteracting ? 'grabbing' : 'grab',
      }}
    >
      <div
        ref={mountRef}
        className="w-full h-full flex items-center justify-center pointer-events-auto touch-none"
      />
    </div>
  )
}
