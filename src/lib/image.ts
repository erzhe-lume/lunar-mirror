function scaleToCanvas(
  source: HTMLVideoElement | HTMLImageElement,
  maxSize: number,
): HTMLCanvasElement {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function captureVideoFrame(video: HTMLVideoElement, maxSize = 720): string {
  return scaleToCanvas(video, maxSize).toDataURL('image/jpeg', 0.72)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片读取失败'))
    img.src = src
  })
}
