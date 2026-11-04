'use client'

import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// PRESET AVATARS
// ─────────────────────────────────────────────────────────────────────────────
export const AVATAR_PRESETS = [
  {
    id: 'scholar',
    name: 'Cozy Scholar',
    icon: '🎓',
    desc: 'Navy knit hoodie, dark espresso hair, and round wire glasses.',
    clothColor: '#312e81',
    hairColor: '#271b12',
    skinColor: '#fed7aa',
    accessory: 'glasses',
  },
  {
    id: 'dreamer',
    name: 'Pastel Dreamer',
    icon: '🌸',
    desc: 'Sakura pink sweater, strawberry hair, and cute cat ears.',
    clothColor: '#f472b6',
    hairColor: '#fb7185',
    skinColor: '#fef08a',
    accessory: 'cat_ears',
  },
  {
    id: 'lofi',
    name: 'Lofi Producer',
    icon: '🎧',
    desc: 'Emerald green hoodie, purple hair, and studio headphones.',
    clothColor: '#059669',
    hairColor: '#a855f7',
    skinColor: '#fed7aa',
    accessory: 'headphones',
  },
  {
    id: 'wizard',
    name: 'Study Wizard',
    icon: '🧙',
    desc: 'Royal violet robe, silver hair, and magical pointy wizard hat.',
    clothColor: '#7c3aed',
    hairColor: '#e2e8f0',
    skinColor: '#ffedd5',
    accessory: 'wizard_hat',
  },
  {
    id: 'champion',
    name: 'Aguila Champion',
    icon: '👑',
    desc: 'Crimson velvet jacket, golden blonde hair, and royal golden crown.',
    clothColor: '#dc2626',
    hairColor: '#eab308',
    skinColor: '#fed7aa',
    accessory: 'crown',
  },
  {
    id: 'barista',
    name: 'Cafe Barista',
    icon: '☕',
    desc: 'Warm mocha apron, dark curls, and gold study glasses.',
    clothColor: '#78350f',
    hairColor: '#1c1917',
    skinColor: '#fde68a',
    accessory: 'glasses',
  },
  {
    id: 'cyber',
    name: 'Cyber Hacker',
    icon: '🕶️',
    desc: 'Neon cyan tech jacket, electric cyan hair, and studio headphones.',
    clothColor: '#0891b2',
    hairColor: '#06b6d4',
    skinColor: '#fed7aa',
    accessory: 'headphones',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// COLOR PALETTES
// ─────────────────────────────────────────────────────────────────────────────
export const CLOTH_PALETTES = [
  { name: 'Indigo', color: '#4f46e5' },
  { name: 'Sakura Pink', color: '#f472b6' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Amber Gold', color: '#d97706' },
  { name: 'Crimson', color: '#dc2626' },
  { name: 'Royal Violet', color: '#7c3aed' },
  { name: 'Cyan Neon', color: '#0891b2' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Slate Dark', color: '#334155' },
  { name: 'Rose Red', color: '#e11d48' },
]

export const HAIR_PALETTES = [
  { name: 'Jet Black', color: '#18181b' },
  { name: 'Espresso Brown', color: '#451a03' },
  { name: 'Golden Blonde', color: '#eab308' },
  { name: 'Sakura Pink', color: '#fb7185' },
  { name: 'Lavender Purple', color: '#a855f7' },
  { name: 'Electric Cyan', color: '#06b6d4' },
  { name: 'Fiery Coral', color: '#ea580c' },
  { name: 'Platinum Silver', color: '#e2e8f0' },
]

export const SKIN_PALETTES = [
  { name: 'Porcelain Fair', color: '#ffedd5' },
  { name: 'Warm Peach', color: '#fed7aa' },
  { name: 'Golden Honey', color: '#fde68a' },
  { name: 'Warm Olive', color: '#e2b382' },
  { name: 'Deep Bronze', color: '#9a6b46' },
]

export const ACCESSORIES = [
  { id: 'none', name: 'None', icon: '🚫' },
  { id: 'headphones', name: 'Headphones', icon: '🎧' },
  { id: 'cat_ears', name: 'Cat Ears', icon: '🐱' },
  { id: 'wizard_hat', name: 'Wizard Hat', icon: '🧙' },
  { id: 'crown', name: 'Golden Crown', icon: '👑' },
  { id: 'glasses', name: 'Wire Glasses', icon: '👓' },
]

export const DEFAULT_AVATAR_CONFIG = {
  clothColor: '#4f46e5',
  hairColor: '#18181b',
  skinColor: '#fed7aa',
  accessory: 'none',
  presetId: null,
}

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR CUSTOMIZER MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AvatarCustomizerModal({
  isOpen,
  onClose,
  currentConfig = DEFAULT_AVATAR_CONFIG,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState('presets') // 'presets' | 'customize'
  const [config, setConfig] = useState(() => ({ ...DEFAULT_AVATAR_CONFIG, ...currentConfig }))
  const [prevConfig, setPrevConfig] = useState(currentConfig)
  const previewMountRef = useRef(null)

  if (currentConfig !== prevConfig) {
    setPrevConfig(currentConfig)
    setConfig({ ...DEFAULT_AVATAR_CONFIG, ...currentConfig })
  }

  // Mini 3D Preview inside modal
  useEffect(() => {
    if (!isOpen) return
    const container = previewMountRef.current
    if (!container) return

    const width = container.clientWidth || 240
    const height = container.clientHeight || 280

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#18181b')

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
    camera.position.set(0, 1.3, 4.4)
    camera.lookAt(0, 1.0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(renderer.domElement)

    // Lighting
    const amb = new THREE.AmbientLight('#ffffff', 0.9)
    scene.add(amb)
    const key = new THREE.DirectionalLight('#fffbeb', 1.5)
    key.position.set(3, 5, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight('#818cf8', 0.8)
    rim.position.set(-3, 3, -2)
    scene.add(rim)

    // Character Group
    const charGroup = new THREE.Group()

    // Skin & Clothes & Hair Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: config.skinColor, roughness: 0.5 })
    const clothMat = new THREE.MeshStandardMaterial({ color: config.clothColor, roughness: 0.6 })
    const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.7 })

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 20), skinMat)
    head.position.y = 1.35
    charGroup.add(head)

    // Hair
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2), hairMat)
    hair.position.y = 1.42
    charGroup.add(hair)

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#1e1b4b' })
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    ;[-0.18, 0.18].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), eyeMat)
      e.position.set(x, 1.34, 0.48)
      charGroup.add(e)
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeWhiteMat)
      g.position.set(x + 0.03, 1.37, 0.56)
      charGroup.add(g)
    })

    // Body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 16), clothMat)
    body.position.y = 0.75
    charGroup.add(body)

    // Feet
    const footMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.5 })
    ;[-0.2, 0.2].forEach(x => {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), footMat)
      foot.position.set(x, 0.14, 0.05)
      foot.scale.set(1, 0.6, 1.4)
      charGroup.add(foot)
    })

    // Accessories
    const accGroup = new THREE.Group()
    if (config.accessory === 'headphones') {
      const hpMat = new THREE.MeshStandardMaterial({ color: '#09090b', metalness: 0.8, roughness: 0.2 })
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 24, Math.PI), hpMat)
      band.position.set(0, 1.48, 0)
      band.rotation.z = Math.PI
      accGroup.add(band)
      ;[-0.56, 0.56].forEach(x => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 16), hpMat)
        cup.rotation.z = Math.PI / 2
        cup.position.set(x, 1.35, 0)
        accGroup.add(cup)
      })
    } else if (config.accessory === 'cat_ears') {
      const earMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.6 })
      const earInnerMat = new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.4 })
      ;[-0.32, 0.32].forEach((x, idx) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), earMat)
        ear.position.set(x, 1.95, 0.1)
        ear.rotation.z = idx === 0 ? 0.3 : -0.3
        ear.rotation.y = Math.PI / 4
        accGroup.add(ear)
      })
    } else if (config.accessory === 'wizard_hat') {
      const wizMat = new THREE.MeshStandardMaterial({ color: '#581c87', roughness: 0.5 })
      const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.8 })
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 24), wizMat)
      brim.position.set(0, 1.82, 0.05)
      brim.rotation.x = -0.1
      accGroup.add(brim)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 16), wizMat)
      cone.position.set(0, 2.38, -0.05)
      cone.rotation.x = -0.2
      accGroup.add(cone)
    } else if (config.accessory === 'crown') {
      const crownMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.9, roughness: 0.2 })
      const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16, 1, true), crownMat)
      crownBand.position.set(0, 1.96, 0)
      accGroup.add(crownBand)
      for (let p = 0; p < 5; p++) {
        const ang = (p * Math.PI * 2) / 5
        const pt = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), crownMat)
        pt.position.set(Math.cos(ang) * 0.42, 2.15, Math.sin(ang) * 0.42)
        accGroup.add(pt)
      }
    } else if (config.accessory === 'glasses') {
      const wireMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.9, roughness: 0.2 })
      ;[-0.18, 0.18].forEach(x => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 16), wireMat)
        rim.position.set(x, 1.34, 0.56)
        accGroup.add(rim)
      })
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), wireMat)
      bridge.position.set(0, 1.35, 0.56)
      accGroup.add(bridge)
    }
    charGroup.add(accGroup)

    scene.add(charGroup)

    let animId
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop)
      charGroup.rotation.y += 0.012
      renderer.render(scene, camera)
    }
    renderLoop()

    return () => {
      cancelAnimationFrame(animId)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [isOpen, config])

  if (!isOpen) return null

  const applyPreset = (preset) => {
    setConfig({
      clothColor: preset.clothColor,
      hairColor: preset.hairColor,
      skinColor: preset.skinColor,
      accessory: preset.accessory,
      presetId: preset.id,
    })
  }

  const handleSave = () => {
    if (onSave) {
      onSave(config)
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('aguila_avatar_custom', JSON.stringify(config))
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(99, 102, 241, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(24, 24, 27, 0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎭</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                Avatar Customizer
              </div>
              <div style={{ fontSize: 11, color: '#a1a1aa' }}>
                Personalize your 3D chibi avatar or select a signature preset
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              fontSize: 18,
              padding: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body: Left 3D Preview, Right Options */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: 3D Live Interactive Preview */}
          <div
            style={{
              width: 260,
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#121215',
              padding: 16,
              position: 'relative',
            }}
          >
            <div
              ref={previewMountRef}
              style={{
                width: '100%',
                height: 280,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#18181b',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            />
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: '#71717a',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              🔄 Live 3D Preview (Auto-rotating)
            </div>
          </div>

          {/* Right: Tabs & Customization Panels */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: 20,
              gap: 16,
            }}
          >
            {/* Tab Switcher */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 10,
                padding: 4,
                gap: 4,
              }}
            >
              <button
                onClick={() => setActiveTab('presets')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'presets' ? '#4f46e5' : 'transparent',
                  color: activeTab === 'presets' ? '#fff' : '#a1a1aa',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                ✨ Premade Avatars ({AVATAR_PRESETS.length})
              </button>
              <button
                onClick={() => setActiveTab('customize')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: activeTab === 'customize' ? '#4f46e5' : 'transparent',
                  color: activeTab === 'customize' ? '#fff' : '#a1a1aa',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                🎨 Custom Builder
              </button>
            </div>

            {/* Tab 1: Presets */}
            {activeTab === 'presets' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {AVATAR_PRESETS.map((p) => {
                  const isSelected = config.presetId === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 12,
                        borderRadius: 12,
                        background: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1.5px solid ${isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 26, flexShrink: 0 }}>{p.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#a5b4fc' : '#fff' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2, lineHeight: 1.3 }}>
                          {p.desc}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Tab 2: Custom Builder */}
            {activeTab === 'customize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Outfit Color */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
                    🧥 Outfit / Hoodie Color
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CLOTH_PALETTES.map((c) => (
                      <button
                        key={c.color}
                        title={c.name}
                        onClick={() => setConfig(prev => ({ ...prev, clothColor: c.color, presetId: null }))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: c.color,
                          border: config.clothColor === c.color ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          boxShadow: config.clothColor === c.color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                          transform: config.clothColor === c.color ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.1s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Hair Color */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
                    💇 Hair Color
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {HAIR_PALETTES.map((h) => (
                      <button
                        key={h.color}
                        title={h.name}
                        onClick={() => setConfig(prev => ({ ...prev, hairColor: h.color, presetId: null }))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: h.color,
                          border: config.hairColor === h.color ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          boxShadow: config.hairColor === h.color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                          transform: config.hairColor === h.color ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.1s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Skin Tone */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
                    👤 Skin Tone
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SKIN_PALETTES.map((s) => (
                      <button
                        key={s.color}
                        title={s.name}
                        onClick={() => setConfig(prev => ({ ...prev, skinColor: s.color, presetId: null }))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: s.color,
                          border: config.skinColor === s.color ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          boxShadow: config.skinColor === s.color ? '0 0 10px rgba(255,255,255,0.4)' : 'none',
                          transform: config.skinColor === s.color ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.1s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Head Accessories */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
                    ✨ 3D Head Accessory
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {ACCESSORIES.map((acc) => {
                      const isSelected = config.accessory === acc.id
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setConfig(prev => ({ ...prev, accessory: acc.id, presetId: null }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isSelected ? 'rgba(79, 70, 229, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: isSelected ? '#fff' : '#a1a1aa',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{acc.icon}</span>
                          <span>{acc.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: 'rgba(24, 24, 27, 0.8)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '8px 16px',
              color: '#a1a1aa',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 20px',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            }}
          >
            Save & Apply Avatar
          </button>
        </div>
      </div>
    </div>
  )
}
