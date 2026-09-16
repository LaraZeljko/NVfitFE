import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const FRAME = 260
const OUTPUT = 512

type Props = {
  file: File
  onCancel: () => void
  onDone: (blob: Blob) => void
}

/** Square crop: drag to move, slider to zoom. What you see in the frame is what is saved. */
export default function ImageCropper({ file, onCancel, onDone }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  // Scale that makes the picture cover the square frame.
  const base = size ? Math.max(FRAME / size.w, FRAME / size.h) : 1
  const scale = base * zoom

  function clamp(next: { x: number; y: number }) {
    if (!size) return next
    const maxX = Math.max(0, (size.w * scale - FRAME) / 2)
    const maxY = Math.max(0, (size.h * scale - FRAME) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    setOffset(clamp({ x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) }))
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  async function handleSave() {
    const image = imgRef.current
    if (!image || !size) return
    setBusy(true)
    try {
      // The frame in image coordinates.
      const sourceSize = FRAME / scale
      const sx = size.w / 2 - offset.x / scale - sourceSize / 2
      const sy = size.h / 2 - offset.y / scale - sourceSize / 2

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is not available.')
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT)

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (blob) onDone(blob)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cropper">
      <div
        className="cropper__frame"
        style={{ width: FRAME, height: FRAME }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {url && (
          <img
            ref={imgRef}
            src={url}
            alt=""
            draggable={false}
            onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
          />
        )}
      </div>

      <label className="label cropper__zoom">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={e => {
            setZoom(Number(e.target.value))
            setOffset(current => clamp(current))
          }}
        />
      </label>

      <div className="cropper__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--accent" onClick={() => void handleSave()} disabled={busy || !size}>
          {busy ? 'Saving…' : 'Use this picture'}
        </button>
      </div>
    </div>
  )
}
