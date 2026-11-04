'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'

/**
 * AguiMascot3D - Real-time 3D Procedural Character Animation
 * Inspired by Mascot Engine (mascotengine.com) Rive/3D interactive companion characters.
 * 
 * Features:
 * - Volumetric 3D Philippine Eagle stylized model with custom plumage, crown crest, and beak
 * - Dynamic 3-axis head & eye gaze tracking with organic saccades and cursor parallax
 * - Secondary spring physics on crown crest feathers, tail, and accessory ribbons
 * - Conversational lip sync with organic jaw movement when AI answers
 * - Full locomotion & body kinetics: breathing, weight shifts, hops, and celebratory spins
 * - Interactive 3D drag-to-orbit with spring return to front
 * - 3D equipable accessories: Scholar Glasses, Mortarboard Cap, Lo-Fi Headphones, Crown, Headband
 * - Studio three-point lighting with dynamic contact ground shadow
 * - Graceful fallback to CSS/2D if WebGL is unavailable
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
    lg: 220,
    xl: 260,
  }[size] || 220

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
    bodyLeanX: 0,
    bodyLeanZ: 0,
    // Drag orbit controls
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    orbitRotY: 0,
    orbitRotX: 0,
    // Physics secondary lag
    crestAngle: 0,
    crestVelocity: 0,
    tailAngle: 0,
    tailVelocity: 0,
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
      stateRef.current.hopVy = 0.18
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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 0.2, 5.2)

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
      renderer.toneMappingExposure = 1.15
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)
    } catch (err) {
      console.warn('WebGL init error:', err)
      setWebglSupported(false)
      return
    }

    // ── 3. Studio Character Lighting ───────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.2)
    scene.add(ambientLight)

    // Warm Key Light (top-right forward)
    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.8)
    keyLight.position.set(2.5, 4.0, 3.5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 512
    keyLight.shadow.mapSize.height = 512
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 10
    keyLight.shadow.bias = -0.001
    scene.add(keyLight)

    // Cool Fill Light (bottom-left)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.7)
    fillLight.position.set(-3.0, 0.5, 2.0)
    scene.add(fillLight)

    // Golden Rim Backlight (high-end character rim glow)
    const rimLight = new THREE.DirectionalLight(0xf59e0b, 2.2)
    rimLight.position.set(0, 3.0, -3.5)
    scene.add(rimLight)

    // ── 4. Stylized Materials ──────────────────────────────────────────────
    const matPlumage = new THREE.MeshStandardMaterial({
      color: 0x663311,
      roughness: 0.55,
      metalness: 0.05,
    })
    const matPlumageDark = new THREE.MeshStandardMaterial({
      color: 0x4a2208,
      roughness: 0.6,
      metalness: 0.05,
    })
    const matPlumageLight = new THREE.MeshStandardMaterial({
      color: 0x8a4519,
      roughness: 0.5,
      metalness: 0.05,
    })
    const matChestBib = new THREE.MeshStandardMaterial({
      color: 0xfbf8f1,
      roughness: 0.45,
      metalness: 0.02,
    })
    const matGoldBeak = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.28,
      metalness: 0.12,
    })
    const matBeakInterior = new THREE.MeshStandardMaterial({
      color: 0x3d1703,
      roughness: 0.7,
    })
    const matEyeWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.0,
    })
    const matIris = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.18,
      metalness: 0.1,
    })
    const matPupil = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.1,
      metalness: 0.0,
    })
    const matGlint = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    })
    const matCrestTip = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.4,
    })

    // ── 5. Hierarchical Character Model (Philippine Eagle Agui) ────────────
    const characterRoot = new THREE.Group()
    scene.add(characterRoot)

    // Dynamic ground contact shadow plane
    const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat)
    shadowPlane.rotation.x = -Math.PI / 2
    shadowPlane.position.y = -1.25
    characterRoot.add(shadowPlane)

    // Perch Disc (floating academic perch)
    const perchGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.12, 32)
    const perchMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.35,
      metalness: 0.6,
    })
    const perchMesh = new THREE.Mesh(perchGeo, perchMat)
    perchMesh.position.y = -1.22
    perchMesh.receiveShadow = true
    characterRoot.add(perchMesh)

    // Gold rim on perch
    const ringGeo = new THREE.TorusGeometry(0.87, 0.025, 16, 48)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0xd97706,
      emissiveIntensity: 0.2,
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.rotation.x = Math.PI / 2
    ringMesh.position.y = -1.16
    characterRoot.add(ringMesh)

    // ── Body / Torso Group ──
    const bodyGroup = new THREE.Group()
    bodyGroup.position.y = -0.5
    characterRoot.add(bodyGroup)

    // Rounded Stylized Torso
    const torsoGeo = new THREE.SphereGeometry(0.78, 32, 24)
    torsoGeo.scale(0.95, 1.15, 0.9)
    const torsoMesh = new THREE.Mesh(torsoGeo, matPlumage)
    torsoMesh.castShadow = true
    bodyGroup.add(torsoMesh)

    // Cream Chest Bib (Philippine Eagle signature fluffy breast)
    const bibGeo = new THREE.SphereGeometry(0.65, 24, 20)
    bibGeo.scale(0.85, 1.05, 0.5)
    const bibMesh = new THREE.Mesh(bibGeo, matChestBib)
    bibMesh.position.set(0, -0.05, 0.45)
    bodyGroup.add(bibMesh)

    // ── Wings (Folded, articulate on flaps/celebration) ──
    const leftWingGroup = new THREE.Group()
    leftWingGroup.position.set(-0.75, 0.15, 0)
    bodyGroup.add(leftWingGroup)

    const wingGeo = new THREE.ConeGeometry(0.38, 1.05, 16)
    wingGeo.scale(0.3, 1.0, 0.8)
    wingGeo.rotateZ(Math.PI)
    wingGeo.translate(0, -0.4, 0)

    const leftWingMesh = new THREE.Mesh(wingGeo, matPlumageDark)
    leftWingMesh.castShadow = true
    leftWingGroup.add(leftWingMesh)

    const rightWingGroup = new THREE.Group()
    rightWingGroup.position.set(0.75, 0.15, 0)
    bodyGroup.add(rightWingGroup)

    const rightWingMesh = new THREE.Mesh(wingGeo, matPlumageDark)
    rightWingMesh.castShadow = true
    rightWingGroup.add(rightWingMesh)

    // ── Talons / Feet ──
    const talonGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 12)
    const talonMat = matGoldBeak

    const leftLeg = new THREE.Mesh(talonGeo, talonMat)
    leftLeg.position.set(-0.35, -0.65, 0.15)
    bodyGroup.add(leftLeg)

    const rightLeg = new THREE.Mesh(talonGeo, talonMat)
    rightLeg.position.set(0.35, -0.65, 0.15)
    bodyGroup.add(rightLeg)

    // ── Tail Feathers Group ──
    const tailGroup = new THREE.Group()
    tailGroup.position.set(0, -0.65, -0.6)
    bodyGroup.add(tailGroup)

    const tailGeo = new THREE.BoxGeometry(0.48, 0.08, 0.7)
    tailGeo.translate(0, 0, -0.3)
    const tailMesh = new THREE.Mesh(tailGeo, matPlumageDark)
    tailMesh.rotation.x = -0.3
    tailGroup.add(tailMesh)

    // ── Head Group (Pivot at neck for full 3-axis gaze tracking) ──
    const headGroup = new THREE.Group()
    headGroup.position.set(0, 0.65, 0.08)
    bodyGroup.add(headGroup)

    // Head Skull Mesh (stylized rounded raptor head)
    const headGeo = new THREE.SphereGeometry(0.68, 32, 28)
    headGeo.scale(1.0, 0.98, 1.02)
    const headMesh = new THREE.Mesh(headGeo, matPlumage)
    headMesh.castShadow = true
    headGroup.add(headMesh)

    // ── Philippine Eagle Iconic Feather Crest Plumes (Crown of Feathers) ──
    const crestGroup = new THREE.Group()
    crestGroup.position.set(0, 0.45, -0.2)
    headGroup.add(crestGroup)

    // Radiating fan of 7 stylized feather plumes with secondary spring lag
    const crestPlumes = []
    const plumeAngles = [-0.65, -0.42, -0.2, 0, 0.2, 0.42, 0.65]
    plumeAngles.forEach((angle, idx) => {
      const plumeGeo = new THREE.ConeGeometry(0.14, 0.68 - Math.abs(angle) * 0.22, 8)
      plumeGeo.scale(0.4, 1.0, 0.8)
      plumeGeo.translate(0, 0.3, 0)
      const plumeMesh = new THREE.Mesh(plumeGeo, idx % 2 === 0 ? matPlumageLight : matCrestTip)
      plumeMesh.rotation.z = angle
      plumeMesh.rotation.x = -0.45 - Math.abs(angle) * 0.15
      crestGroup.add(plumeMesh)
      crestPlumes.push(plumeMesh)
    })

    // ── Beak Assembly (Curved Raptor Upper Beak + Articulated Lower Jaw) ──
    const beakGroup = new THREE.Group()
    beakGroup.position.set(0, -0.05, 0.62)
    headGroup.add(beakGroup)

    // Upper Beak (Hooked raptor beak)
    const upperBeakGeo = new THREE.ConeGeometry(0.24, 0.58, 16)
    upperBeakGeo.scale(0.85, 1.0, 0.9)
    upperBeakGeo.rotateX(Math.PI / 2.3)
    upperBeakGeo.translate(0, 0.02, 0.22)
    const upperBeakMesh = new THREE.Mesh(upperBeakGeo, matGoldBeak)
    upperBeakMesh.castShadow = true
    beakGroup.add(upperBeakMesh)

    // Lower Beak / Jaw (Pivot for conversational speech lip-sync!)
    const lowerBeakGroup = new THREE.Group()
    lowerBeakGroup.position.set(0, -0.12, 0.12)
    beakGroup.add(lowerBeakGroup)

    const lowerBeakGeo = new THREE.ConeGeometry(0.18, 0.38, 12)
    lowerBeakGeo.scale(0.75, 1.0, 0.8)
    lowerBeakGeo.rotateX(Math.PI / 2.1)
    lowerBeakGeo.translate(0, -0.02, 0.14)
    const lowerBeakMesh = new THREE.Mesh(lowerBeakGeo, matGoldBeak)
    lowerBeakGroup.add(lowerBeakMesh)

    // Inner mouth cavity (visible when jaw opens)
    const mouthCavityGeo = new THREE.SphereGeometry(0.12, 12, 8)
    mouthCavityGeo.scale(0.8, 0.5, 0.8)
    const mouthCavityMesh = new THREE.Mesh(mouthCavityGeo, matBeakInterior)
    mouthCavityMesh.position.set(0, 0, 0.1)
    lowerBeakGroup.add(mouthCavityMesh)

    // ── 3D Expressive Eyes with Gaze Parallax & Eyelids ──
    const eyeSpacing = 0.35
    const eyeHeight = 0.12
    const eyeDepth = 0.52

    // Helper to create an articulated eye assembly
    const createEyeAssembly = (isRight = false) => {
      const eyeAssembly = new THREE.Group()
      const xPos = isRight ? eyeSpacing : -eyeSpacing
      eyeAssembly.position.set(xPos, eyeHeight, eyeDepth)
      headGroup.add(eyeAssembly)

      // Slight outward turn typical of raptors
      eyeAssembly.rotation.y = isRight ? 0.22 : -0.22

      // Sclera (Eye White Sphere)
      const eyeWhiteGeo = new THREE.SphereGeometry(0.19, 24, 20)
      const eyeWhite = new THREE.Mesh(eyeWhiteGeo, matEyeWhite)
      eyeAssembly.add(eyeWhite)

      // Iris Mesh
      const irisGeo = new THREE.SphereGeometry(0.14, 20, 16)
      const irisMesh = new THREE.Mesh(irisGeo, matIris)
      irisMesh.position.set(0, 0, 0.08)
      eyeAssembly.add(irisMesh)

      // Pupil Mesh
      const pupilGeo = new THREE.SphereGeometry(0.09, 16, 12)
      const pupilMesh = new THREE.Mesh(pupilGeo, matPupil)
      pupilMesh.position.set(0, 0, 0.12)
      eyeAssembly.add(pupilMesh)

      // Specular Glint (Catchlight that gives life!)
      const glintGeo = new THREE.SphereGeometry(0.032, 10, 8)
      const glintMesh = new THREE.Mesh(glintGeo, matGlint)
      glintMesh.position.set(isRight ? 0.04 : -0.04, 0.05, 0.16)
      eyeAssembly.add(glintMesh)

      // Dynamic Eyelid (Rotates down for natural organic blinks)
      const eyelidGeo = new THREE.SphereGeometry(0.205, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const eyelidMesh = new THREE.Mesh(eyelidGeo, matPlumage)
      eyelidMesh.rotation.x = -Math.PI / 2 // Hidden above eye when open
      eyeAssembly.add(eyelidMesh)

      // Brow Ridge (articulated for mood: focus, curious, happy)
      const browGeo = new THREE.BoxGeometry(0.32, 0.08, 0.18)
      const browMesh = new THREE.Mesh(browGeo, matPlumageDark)
      browMesh.position.set(0, 0.19, 0.05)
      browMesh.rotation.z = isRight ? -0.15 : 0.15
      eyeAssembly.add(browMesh)

      return {
        assembly: eyeAssembly,
        iris: irisMesh,
        pupil: pupilMesh,
        glint: glintMesh,
        eyelid: eyelidMesh,
        brow: browMesh,
      }
    }

    const leftEye = createEyeAssembly(false)
    const rightEye = createEyeAssembly(true)

    // ── 6. 3D Equipable Accessories ────────────────────────────────────────
    const accessoriesGroup = new THREE.Group()
    headGroup.add(accessoriesGroup)

    // 1. Scholar Glasses
    const glassesGroup = new THREE.Group()
    glassesGroup.position.set(0, 0.1, 0.65)
    accessoriesGroup.add(glassesGroup)

    const glassFrameMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
    })
    const glassLensMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      transmission: 0.8,
    })

    // Left Rim & Lens
    const rimGeo = new THREE.TorusGeometry(0.18, 0.02, 12, 28)
    const leftRim = new THREE.Mesh(rimGeo, glassFrameMat)
    leftRim.position.set(-0.35, 0, 0)
    glassesGroup.add(leftRim)

    const lensGeo = new THREE.CircleGeometry(0.17, 24)
    const leftLens = new THREE.Mesh(lensGeo, glassLensMat)
    leftLens.position.set(-0.35, 0, 0.01)
    glassesGroup.add(leftLens)

    // Right Rim & Lens
    const rightRim = new THREE.Mesh(rimGeo, glassFrameMat)
    rightRim.position.set(0.35, 0, 0)
    glassesGroup.add(rightRim)

    const rightLens = new THREE.Mesh(lensGeo, glassLensMat)
    rightLens.position.set(0.35, 0, 0.01)
    glassesGroup.add(rightLens)

    // Golden Bridge across beak
    const bridgeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8)
    const bridgeMesh = new THREE.Mesh(bridgeGeo, glassFrameMat)
    bridgeMesh.rotation.z = Math.PI / 2
    bridgeMesh.position.set(0, 0.02, 0.02)
    glassesGroup.add(bridgeMesh)

    // 2. Graduation Cap (Mortarboard + Tassel)
    const capGroup = new THREE.Group()
    capGroup.position.set(0, 0.68, 0.05)
    accessoriesGroup.add(capGroup)

    const capMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
    const mortarboardGeo = new THREE.BoxGeometry(1.2, 0.05, 1.2)
    mortarboardGeo.rotateY(Math.PI / 4)
    const mortarboardMesh = new THREE.Mesh(mortarboardGeo, capMat)
    capGroup.add(mortarboardMesh)

    const skullCapGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.22, 24)
    const skullCapMesh = new THREE.Mesh(skullCapGeo, capMat)
    skullCapMesh.position.y = -0.1
    capGroup.add(skullCapMesh)

    // Gold Tassel Button & String with pendulum physics
    const tasselBtnGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12)
    const tasselBtn = new THREE.Mesh(tasselBtnGeo, matGoldBeak)
    tasselBtn.position.y = 0.035
    capGroup.add(tasselBtn)

    const tasselPivot = new THREE.Group()
    tasselPivot.position.set(0.2, 0.03, 0.2)
    capGroup.add(tasselPivot)

    const tasselStringGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8)
    tasselStringGeo.translate(0, -0.22, 0)
    const tasselString = new THREE.Mesh(tasselStringGeo, matGoldBeak)
    tasselPivot.add(tasselString)

    const tasselEndGeo = new THREE.ConeGeometry(0.06, 0.16, 8)
    tasselEndGeo.translate(0, -0.45, 0)
    const tasselEnd = new THREE.Mesh(tasselEndGeo, matGoldBeak)
    tasselPivot.add(tasselEnd)

    // 3. Lo-Fi Headphones
    const headphonesGroup = new THREE.Group()
    headphonesGroup.position.set(0, 0.35, 0)
    accessoriesGroup.add(headphonesGroup)

    const hpBandGeo = new THREE.TorusGeometry(0.72, 0.04, 12, 32, Math.PI)
    const hpBandMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.7, roughness: 0.3 })
    const hpBand = new THREE.Mesh(hpBandGeo, hpBandMat)
    hpBand.rotation.z = -Math.PI / 2
    headphonesGroup.add(hpBand)

    const earcupMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 })
    const earcupGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 20)
    earcupGeo.rotateZ(Math.PI / 2)

    const leftEarcup = new THREE.Mesh(earcupGeo, earcupMat)
    leftEarcup.position.set(-0.72, 0, 0)
    headphonesGroup.add(leftEarcup)

    const rightEarcup = new THREE.Mesh(earcupGeo, earcupMat)
    rightEarcup.position.set(0.72, 0, 0)
    headphonesGroup.add(rightEarcup)

    // 4. Honor Crown
    const crownGroup = new THREE.Group()
    crownGroup.position.set(0, 0.72, 0.02)
    accessoriesGroup.add(crownGroup)

    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.15,
    })
    const crownBaseGeo = new THREE.CylinderGeometry(0.52, 0.54, 0.14, 24, 1, true)
    const crownBase = new THREE.Mesh(crownBaseGeo, crownMat)
    crownGroup.add(crownBase)

    // Crown Peaks with jewels
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const peakGeo = new THREE.ConeGeometry(0.12, 0.32, 8)
      const peakMesh = new THREE.Mesh(peakGeo, crownMat)
      peakMesh.position.set(Math.cos(angle) * 0.52, 0.22, Math.sin(angle) * 0.52)
      crownGroup.add(peakMesh)

      // Jewel
      const jewelGeo = new THREE.DodecahedronGeometry(0.045)
      const jewelMat = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0x3b82f6,
        roughness: 0.1,
        metalness: 0.3,
        emissive: i % 2 === 0 ? 0xb91c1c : 0x1d4ed8,
        emissiveIntensity: 0.5,
      })
      const jewelMesh = new THREE.Mesh(jewelGeo, jewelMat)
      jewelMesh.position.set(Math.cos(angle) * 0.53, 0.02, Math.sin(angle) * 0.53)
      crownGroup.add(jewelMesh)
    }

    // 5. Martial Arts Headband
    const headbandGroup = new THREE.Group()
    headbandGroup.position.set(0, 0.28, 0.08)
    accessoriesGroup.add(headbandGroup)

    const bandMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 })
    const bandGeo = new THREE.TorusGeometry(0.69, 0.05, 12, 32)
    const bandMesh = new THREE.Mesh(bandGeo, bandMat)
    bandMesh.rotation.x = Math.PI / 2
    headbandGroup.add(bandMesh)

    // Trailing tie ribbons at back
    const ribbonGeo = new THREE.BoxGeometry(0.1, 0.45, 0.02)
    ribbonGeo.translate(0, -0.2, 0)
    const leftRibbon = new THREE.Mesh(ribbonGeo, bandMat)
    leftRibbon.position.set(-0.15, -0.05, -0.7)
    leftRibbon.rotation.x = 0.4
    leftRibbon.rotation.y = -0.2
    headbandGroup.add(leftRibbon)

    const rightRibbon = new THREE.Mesh(ribbonGeo, bandMat)
    rightRibbon.position.set(0.15, -0.05, -0.7)
    rightRibbon.rotation.x = 0.3
    rightRibbon.rotation.y = 0.2
    headbandGroup.add(rightRibbon)

    // Helper to toggle accessory visibility
    const updateAccessoriesVisibility = (acc) => {
      glassesGroup.visible = acc === 'glasses'
      capGroup.visible = acc === 'cap'
      headphonesGroup.visible = acc === 'headphones'
      crownGroup.visible = acc === 'crown'
      headbandGroup.visible = acc === 'headband'
    }
    updateAccessoriesVisibility(accessory)

    // ── 7. Organic Blinking System (Realistic Double Blinks) ────────────────
    let blinkTimer = null
    const triggerBlink = () => {
      stateRef.current.isBlinking = true
      stateRef.current.blinkProgress = 0

      const nextDelay = 2800 + Math.random() * 3400
      blinkTimer = setTimeout(() => {
        triggerBlink()
        // 25% chance of realistic double-blink
        if (Math.random() < 0.25) {
          setTimeout(() => {
            stateRef.current.isBlinking = true
            stateRef.current.blinkProgress = 0
          }, 240)
        }
      }, nextDelay)
    }
    blinkTimer = setTimeout(triggerBlink, 2000)

    // ── 8. Conversational Lip-Sync Engine (Dynamic Mouth Movement) ─────────
    let flapInterval = null
    const syncLipMovement = () => {
      if (stateRef.current.isTyping) {
        stateRef.current.targetMouthOpen = Math.random() > 0.3 ? 0.35 + Math.random() * 0.55 : 0
      } else {
        stateRef.current.targetMouthOpen = 0
      }
    }
    flapInterval = setInterval(syncLipMovement, 90)

    // ── 9. Interactive Mouse / Touch Tracking & Orbit Drag ───────────────────
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

      // Normalized coordinates (-1 to 1)
      const nx = (e.clientX - centerX) / (window.innerWidth / 2)
      const ny = (e.clientY - centerY) / (window.innerHeight / 2)

      state.mouseX = nx
      state.mouseY = ny

      // Head 3D rotation targets
      state.targetRotY = Math.max(-0.65, Math.min(0.65, nx * 0.75))
      state.targetRotX = Math.max(-0.45, Math.min(0.45, -ny * 0.55))

      // Pupil gaze offset
      state.targetPupilX = Math.max(-0.065, Math.min(0.065, nx * 0.07))
      state.targetPupilY = Math.max(-0.045, Math.min(0.045, -ny * 0.05))

      // Input focus override: look down into chat input
      if (state.isInputFocused) {
        state.targetRotX = -0.32
        state.targetPupilY = -0.045
      }

      // Thinking override: tilt up into thought
      if (state.mood === 'thinking' || state.isTyping) {
        state.targetRotX += 0.15
        state.targetRotY += 0.12
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
      // Smoothly return gaze to center
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

    // ── 10. Main Animation & Physics Loop (60-120fps) ────────────────────────
    let animationFrameId
    let clock = new THREE.Clock()

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const delta = Math.min(clock.getDelta(), 0.1)
      const time = clock.getElapsedTime()
      const state = stateRef.current

      // Ensure accessory visibility stays in sync
      updateAccessoriesVisibility(state.accessory)

      // 1. Organic Breathing Kinetics
      const breathSpeed = state.mood === 'timer' ? 1.5 : (state.mood === 'celebrating' ? 4.5 : 2.6)
      const breathWave = Math.sin(time * breathSpeed)
      const breathTorsoScale = 1 + breathWave * 0.028
      torsoMesh.scale.set(0.95 * breathTorsoScale, 1.15 * breathTorsoScale, 0.9 * breathTorsoScale)
      bibMesh.scale.set(0.85 * breathTorsoScale, 1.05 * breathTorsoScale, 0.5 * breathTorsoScale)

      // 2. Hop / Squash & Locomotion Physics
      if (state.hopVy !== 0 || state.hopY > 0) {
        state.hopY += state.hopVy
        state.hopVy -= 0.016 // Gravity

        if (state.hopY <= 0) {
          state.hopY = 0
          state.hopVy = 0
        }
      }

      // Idle subtle perch weight shift (moving around subtly)
      const weightShift = Math.sin(time * 0.8) * 0.04
      const bobY = Math.sin(time * breathSpeed) * 0.035

      characterRoot.position.y = state.hopY + bobY

      // Shadow reacts to elevation and hop
      const shadowScale = Math.max(0.6, 1 - state.hopY * 0.6)
      shadowPlane.scale.set(shadowScale, shadowScale, shadowScale)
      shadowMat.opacity = Math.max(0.18, 0.42 - state.hopY * 0.25)

      // 3. Smooth Gaze Damping (Exponential Lerp)
      state.currentRotY += (state.targetRotY - state.currentRotY) * 0.1
      state.currentRotX += (state.targetRotX - state.currentRotX) * 0.1

      state.currentPupilX += (state.targetPupilX - state.currentPupilX) * 0.15
      state.currentPupilY += (state.targetPupilY - state.currentPupilY) * 0.15

      // Return orbit rotation gently back to front when not dragging
      if (!state.isDragging) {
        state.orbitRotY += (0 - state.orbitRotY) * 0.06
        state.orbitRotX += (0 - state.orbitRotX) * 0.06
      }

      // 4. Celebrating Full Spin / Locomotion
      if (state.mood === 'celebrating') {
        state.spinRotY += delta * 3.5
        // Enthusiastic wing flap
        leftWingGroup.rotation.z = Math.sin(time * 12) * 0.7 - 0.4
        rightWingGroup.rotation.z = -Math.sin(time * 12) * 0.7 + 0.4
        leftWingGroup.rotation.x = Math.cos(time * 12) * 0.3
        rightWingGroup.rotation.x = Math.cos(time * 12) * 0.3
      } else if (state.mood === 'studying') {
        state.spinRotY += (0 - state.spinRotY) * 0.1
        // Wings resting forward in study posture
        leftWingGroup.rotation.z = 0.2
        rightWingGroup.rotation.z = -0.2
        leftWingGroup.rotation.x = 0.35
        rightWingGroup.rotation.x = 0.35
      } else {
        state.spinRotY += (0 - state.spinRotY) * 0.08
        // Gentle resting wing breathing
        leftWingGroup.rotation.z = Math.sin(time * breathSpeed) * 0.04
        rightWingGroup.rotation.z = -Math.sin(time * breathSpeed) * 0.04
        leftWingGroup.rotation.x = 0
        rightWingGroup.rotation.x = 0
      }

      // Apply rotations to character
      characterRoot.rotation.y = state.orbitRotY + state.spinRotY + weightShift
      characterRoot.rotation.x = state.orbitRotX
      characterRoot.rotation.z = -weightShift * 0.4

      // Head Gaze & Nodding
      const conversationalNod = state.isTyping ? Math.sin(time * 9) * 0.04 : 0
      headGroup.rotation.y = state.currentRotY
      headGroup.rotation.x = state.currentRotX + conversationalNod
      headGroup.rotation.z = state.currentRotY * 0.18

      // 5. Secondary Crest & Tail Feather Spring Physics
      const crestTarget = -state.currentRotY * 0.35
      const crestForce = (crestTarget - state.crestAngle) * 35
      state.crestVelocity = (state.crestVelocity + crestForce * delta) * 0.88
      state.crestAngle += state.crestVelocity * delta
      crestGroup.rotation.y = state.crestAngle
      crestGroup.rotation.z = state.crestAngle * 0.25

      const tailTarget = state.currentRotY * 0.2
      const tailForce = (tailTarget - state.tailAngle) * 25
      state.tailVelocity = (state.tailVelocity + tailForce * delta) * 0.85
      state.tailAngle += state.tailVelocity * delta
      tailGroup.rotation.y = state.tailAngle

      // Mortarboard tassel spring
      const tasselForce = (-state.currentRotY * 0.8 - state.tasselAngle) * 30
      state.tasselVelocity = (state.tasselVelocity + tasselForce * delta) * 0.88
      state.tasselAngle += state.tasselVelocity * delta
      tasselPivot.rotation.z = state.tasselAngle

      // 6. Pupil Gaze Displacement
      leftEye.iris.position.x = state.currentPupilX
      leftEye.iris.position.y = state.currentPupilY
      leftEye.pupil.position.x = state.currentPupilX * 1.15
      leftEye.pupil.position.y = state.currentPupilY * 1.15

      rightEye.iris.position.x = state.currentPupilX
      rightEye.iris.position.y = state.currentPupilY
      rightEye.pupil.position.x = state.currentPupilX * 1.15
      rightEye.pupil.position.y = state.currentPupilY * 1.15

      // 7. Dynamic Blinking & Happy Squint
      const isHappy = state.happyTrigger || state.mood === 'celebrating'
      if (isHappy) {
        // Happy arched squint eyes (⌒ ⌒)
        leftEye.eyelid.rotation.x = -0.2
        rightEye.eyelid.rotation.x = -0.2
        leftEye.brow.rotation.z = -0.3
        rightEye.brow.rotation.z = 0.3
      } else if (state.isBlinking) {
        state.blinkProgress += delta * 18
        if (state.blinkProgress >= Math.PI) {
          state.isBlinking = false
          leftEye.eyelid.rotation.x = -Math.PI / 2
          rightEye.eyelid.rotation.x = -Math.PI / 2
        } else {
          // Closed eyelid wave
          const blinkRot = -Math.PI / 2 + Math.sin(state.blinkProgress) * 1.6
          leftEye.eyelid.rotation.x = blinkRot
          rightEye.eyelid.rotation.x = blinkRot
        }
      } else {
        leftEye.eyelid.rotation.x = -Math.PI / 2
        rightEye.eyelid.rotation.x = -Math.PI / 2

        // Mood-driven brows
        if (state.mood === 'studying') {
          // Focused sharp analytical brows
          leftEye.brow.rotation.z = 0.28
          rightEye.brow.rotation.z = -0.28
        } else if (state.mood === 'thinking') {
          // Curious arched brow
          leftEye.brow.rotation.z = -0.1
          rightEye.brow.rotation.z = -0.35
        } else {
          leftEye.brow.rotation.z = 0.15
          rightEye.brow.rotation.z = -0.15
        }
      }

      // 8. Conversational Lip-Sync Movement (Beak Flap)
      state.mouthOpen += (state.targetMouthOpen - state.mouthOpen) * 0.3
      lowerBeakGroup.rotation.x = state.mouthOpen * 0.45

      // Render Scene
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

      // Dispose geometries and materials
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

  // Click / poke handler
  const handleClick = (e) => {
    if (onPoke) {
      onPoke(e)
    }
  }

  // Petting stroke handler
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
    // Graceful fallback to static sprite if WebGL is disabled
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
      {/* Three.js Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-full flex items-center justify-center pointer-events-auto touch-none"
      />
    </div>
  )
}
