import { useEffect, useRef, useState } from 'react'
import { captureVideoFrame } from '../lib/image'
import { useFocusTrap } from '../lib/useFocusTrap'

interface Props {
  open: boolean
  onClose: () => void
  onCapture: (dataUrl: string) => void
}

export default function CameraModal({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(() =>
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
      ? ''
      : '当前页面无法调用摄像头，请用 HTTPS 或 localhost 打开后再试。',
  )

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let cancelled = false

    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
      return
    }

    const start = async () => {
      try {
        const mediaStream = await mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        const video = videoRef.current
        if (video) {
          video.srcObject = mediaStream
          await video.play()
          if (!cancelled) setReady(true)
        }
      } catch {
        if (!cancelled) {
          setError('无法访问摄像头，请检查浏览器权限，或改用文字记录此刻。')
        }
      }
    }
    void start()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const capture = () => {
    const video = videoRef.current
    if (!video || !ready) return
    try {
      onCapture(captureVideoFrame(video))
      onClose()
    } catch {
      setError('拍摄失败，请再试一次。')
    }
  }

  return (
    <div className="modal-veil" role="dialog" aria-modal="true" aria-label="拍下心情快照">
      <div className="modal camera-modal" ref={trapRef} tabIndex={-1}>
        <header className="modal-head">
          <div>
            <span className="eyebrow">心情快照</span>
            <h3>给此刻的自己留一张影</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="camera-stage">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {!ready && !error && <span className="camera-hint">正在打开摄像头…</span>}
          {error && <span className="camera-hint is-error">{error}</span>}
        </div>

        <p className="modal-note">
          快照只保存在你的浏览器本机，并会随这次自省记录一起归档。不会上传到任何服务器。
        </p>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-btn" onClick={capture} disabled={!ready}>
            拍下这一刻
          </button>
        </div>
      </div>
    </div>
  )
}
