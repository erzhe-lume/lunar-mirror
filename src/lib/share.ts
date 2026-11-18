import type { DrawnCard, Insight } from '../types'
import { POSITIONS } from '../types'
import { formatDate } from './format'

export type ShareFormat = 'poster' | 'story'

interface ShareData {
  insight: Insight
  question: string
  querent?: string
  cards: DrawnCard[]
  createdAt?: number
  verse: string[]
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of [...text]) {
    if (char === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    const test = line + char
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function fitLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  kept[max - 1] = `${kept[max - 1].replace(/[，。；、！？\s]+$/, '')}…`
  return kept
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
): number {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight)
  })
  return startY + Math.max(0, lines.length - 1) * lineHeight
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  width: number,
  height: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

export async function downloadInsightImage(
  data: ShareData,
  format: ShareFormat = 'poster',
): Promise<void> {
  const isStory = format === 'story'
  const WIDTH = 1080
  const HEIGHT = isStory ? 1920 : 1350
  const cardScale = isStory ? 1.2 : 1
  const headerY = isStory ? 150 : 104
  const metaY = isStory ? 208 : 152
  const titleSize = isStory ? 50 : 44
  const titleStartY = isStory ? 340 : 238
  const titleLineHeight = isStory ? 66 : 58
  const questionGap = isStory ? 66 : 54
  const questionSize = isStory ? 27 : 23
  const questionLineHeight = isStory ? 42 : 36
  const dividerGap = isStory ? 58 : 44
  const dividerInset = isStory ? 250 : 220
  const verseLabelGap = isStory ? 72 : 56
  const verseStartGap = isStory ? 64 : 48
  const verseSize = isStory ? 34 : 30
  const verseLineHeight = isStory ? 62 : 50

  try {
    await document.fonts.ready
  } catch {
    // 字体不可用时用系统回退字体绘制
  }

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  background.addColorStop(0, '#0b0d18')
  background.addColorStop(0.45, '#080a14')
  background.addColorStop(1, '#05060b')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  glow(ctx, 210, 140, 520, 'rgba(111, 83, 160, 0.34)', WIDTH, HEIGHT)
  glow(ctx, 900, isStory ? HEIGHT - 380 : 1080, 560, 'rgba(170, 125, 68, 0.16)', WIDTH, HEIGHT)

  if (isStory) {
    ctx.strokeStyle = 'rgba(217, 182, 103, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(WIDTH / 2, 960, 380, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(WIDTH / 2, 960, 310, 0, Math.PI * 2)
    ctx.stroke()
  }

  const starCount = isStory ? 190 : 130
  for (let index = 0; index < starCount; index += 1) {
    const x = Math.random() * WIDTH
    const y = Math.random() * HEIGHT
    const radius = Math.random() * 1.6 + 0.4
    ctx.globalAlpha = Math.random() * 0.5 + 0.15
    ctx.fillStyle = '#f4e6c2'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.strokeStyle = 'rgba(217, 182, 103, 0.55)'
  ctx.lineWidth = 1.5
  roundRect(ctx, 36, 36, WIDTH - 72, HEIGHT - 72, 18)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(217, 182, 103, 0.18)'
  ctx.lineWidth = 1
  roundRect(ctx, 52, 52, WIDTH - 104, HEIGHT - 104, 12)
  ctx.stroke()

  const cornerStar = (x: number, y: number) => {
    ctx.fillStyle = 'rgba(240, 210, 142, 0.75)'
    ctx.beginPath()
    ctx.moveTo(x, y - 5)
    ctx.lineTo(x + 1.6, y - 1.6)
    ctx.lineTo(x + 5, y)
    ctx.lineTo(x + 1.6, y + 1.6)
    ctx.lineTo(x, y + 5)
    ctx.lineTo(x - 1.6, y + 1.6)
    ctx.lineTo(x - 5, y)
    ctx.lineTo(x - 1.6, y - 1.6)
    ctx.closePath()
    ctx.fill()
  }
  cornerStar(80, 80)
  cornerStar(WIDTH - 80, 80)
  cornerStar(80, HEIGHT - 80)
  cornerStar(WIDTH - 80, HEIGHT - 80)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = '500 22px Cinzel, "Cormorant Garamond", serif'
  ctx.fillStyle = 'rgba(232, 201, 135, 0.85)'
  ctx.fillText('MIRROR ARCANA', WIDTH / 2, headerY)

  ctx.font = '400 23px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(163, 157, 177, 0.9)'
  const meta = `${data.querent ? `为「${data.querent}」` : '一次自省'} · ${formatDate(
    data.createdAt ?? Date.now(),
  )}`
  ctx.fillText(meta, WIDTH / 2, metaY)

  ctx.font = `500 ${titleSize}px "Cormorant Garamond", "Songti SC", SimSun, serif`
  ctx.fillStyle = '#f0e8d6'
  const titleLines = fitLines(wrapText(ctx, data.insight.title, 900), 2)
  let cursorY = drawLines(ctx, titleLines, WIDTH / 2, titleStartY, titleLineHeight)

  ctx.font = `400 ${questionSize}px "Songti SC", SimSun, serif`
  ctx.fillStyle = 'rgba(163, 157, 177, 0.85)'
  const questionLines = fitLines(
    wrapText(ctx, `「${data.question}」`, 820),
    2,
  )
  cursorY = drawLines(
    ctx,
    questionLines,
    WIDTH / 2,
    cursorY + questionGap,
    questionLineHeight,
  )

  cursorY += dividerGap
  const divider = ctx.createLinearGradient(
    dividerInset,
    0,
    WIDTH - dividerInset,
    0,
  )
  divider.addColorStop(0, 'rgba(217,182,103,0)')
  divider.addColorStop(0.5, 'rgba(217,182,103,0.5)')
  divider.addColorStop(1, 'rgba(217,182,103,0)')
  ctx.strokeStyle = divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(dividerInset, cursorY)
  ctx.lineTo(WIDTH - dividerInset, cursorY)
  ctx.stroke()
  ctx.fillStyle = '#f0d28e'
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2, cursorY - 4)
  ctx.lineTo(WIDTH / 2 + 4, cursorY)
  ctx.lineTo(WIDTH / 2, cursorY + 4)
  ctx.lineTo(WIDTH / 2 - 4, cursorY)
  ctx.closePath()
  ctx.fill()

  cursorY += verseLabelGap
  ctx.font = '400 15px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
  ctx.fillText('签  文', WIDTH / 2, cursorY)

  cursorY += verseStartGap
  ctx.font = `400 ${verseSize}px "Songti SC", SimSun, serif`
  data.verse.forEach((line, index) => {
    ctx.fillStyle =
      index === data.verse.length - 1 ? '#f0d28e' : 'rgba(228, 220, 203, 0.95)'
    ctx.fillText(line, WIDTH / 2, cursorY + index * verseLineHeight)
  })
  cursorY += data.verse.length * verseLineHeight

  const cardWidth = 150 * cardScale
  const cardHeight = 230 * cardScale
  const gap = 38 * cardScale
  const totalWidth = cardWidth * 3 + gap * 2
  const startX = (WIDTH - totalWidth) / 2
  const cardY = isStory
    ? Math.min(Math.max(cursorY + 54, 1140), 1260)
    : Math.min(Math.max(cursorY + 30, 800), 860)

  if (data.insight.crisis) {
    ctx.font = `500 ${isStory ? 30 : 26}px "Songti SC", SimSun, serif`
    ctx.fillStyle = '#f0d28e'
    ctx.fillText('此刻先不解读牌面', WIDTH / 2, cardY + 36 * cardScale)
    ctx.font = `400 ${isStory ? 22 : 19}px "Songti SC", SimSun, serif`
    ctx.fillStyle = 'rgba(228, 220, 203, 0.85)'
    ctx.fillText('把注意力放回身边的人，以及此刻的安全。', WIDTH / 2, cardY + 82 * cardScale)
  } else {
    data.cards.forEach((drawn, index) => {
      const x = startX + index * (cardWidth + gap)
      ctx.font = `400 ${14 * cardScale}px "Songti SC", SimSun, serif`
      ctx.fillStyle = 'rgba(217, 182, 103, 0.8)'
      ctx.fillText(
        POSITIONS[drawn.position].label,
        x + cardWidth / 2,
        cardY - 22 * cardScale,
      )

      roundRect(ctx, x, cardY, cardWidth, cardHeight, 10)
      ctx.fillStyle = 'rgba(13, 16, 32, 0.92)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(217, 182, 103, 0.55)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      roundRect(ctx, x + 6, cardY + 6, cardWidth - 12, cardHeight - 12, 6)
      ctx.strokeStyle = 'rgba(217, 182, 103, 0.18)'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = 'rgba(217, 182, 103, 0.85)'
      ctx.font = `400 ${14 * cardScale}px Cinzel, "Cormorant Garamond", serif`
      ctx.fillText(
        drawn.card.roman,
        x + cardWidth / 2,
        cardY + 28 * cardScale,
      )

      ctx.font = `400 ${38 * cardScale}px "Songti SC", SimSun, serif`
      ctx.fillStyle = '#e7d5a8'
      ctx.fillText(
        drawn.card.symbol,
        x + cardWidth / 2,
        cardY + 96 * cardScale,
      )

      ctx.font = `500 ${21 * cardScale}px "Songti SC", SimSun, serif`
      ctx.fillStyle = '#efe6d2'
      ctx.fillText(
        drawn.card.name,
        x + cardWidth / 2,
        cardY + 154 * cardScale,
      )

      ctx.font = `400 ${11 * cardScale}px Cinzel, "Cormorant Garamond", serif`
      ctx.fillStyle = 'rgba(217, 182, 103, 0.65)'
      ctx.fillText(
        drawn.card.nameEn.toUpperCase(),
        x + cardWidth / 2,
        cardY + 180 * cardScale,
      )

      ctx.font = `400 ${12 * cardScale}px "Songti SC", SimSun, serif`
      ctx.fillStyle = 'rgba(163, 157, 177, 0.8)'
      ctx.fillText(
        drawn.orientation === 'upright' ? '正位' : '逆位',
        x + cardWidth / 2,
        cardY + 204 * cardScale,
      )
    })
  }

  ctx.font = `400 ${isStory ? 23 : 20}px "Songti SC", SimSun, serif`
  ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
  ctx.fillText(
    '塔罗不预言命运，只邀请你看见自己',
    WIDTH / 2,
    HEIGHT - (isStory ? 150 : 116),
  )

  ctx.font = '500 14px Cinzel, "Cormorant Garamond", serif'
  ctx.fillStyle = 'rgba(163, 157, 177, 0.55)'
  ctx.fillText(
    'MIRROR ARCANA · 心镜',
    WIDTH / 2,
    HEIGHT - (isStory ? 100 : 78),
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('签文图生成失败')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mirror-arcana-${format}-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
