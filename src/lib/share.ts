import type { DrawnCard, Insight } from '../types'
import { POSITIONS } from '../types'
import { formatDate } from './format'

export type ShareFormat = 'poster' | 'story' | 'long'

interface ShareData {
  insight: Insight
  question: string
  querent?: string
  cards: DrawnCard[]
  createdAt?: number
  verse: string[]
}

const NO_LINE_START = new Set('，。；、！？：」』）》〉】”’%,.!?;:)]}')
const NO_LINE_END = new Set('「『（《〈【“‘([')

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
      if (NO_LINE_START.has(char)) {
        // 标点悬挂在行尾，避免下一行以标点开头。
        line = test
        continue
      }
      if (NO_LINE_END.has(line[line.length - 1] ?? '')) {
        const opener = line.slice(-1)
        lines.push(line.slice(0, -1))
        line = opener + char
        continue
      }
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

// 长标题/问题先缩字号再截断，尽量保留完整文字。
function layoutBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    maxWidth: number
    maxLines: number
    baseSize: number
    minSize: number
    lineHeightRatio: number
    font: (size: number) => string
  },
): { lines: string[]; lineHeight: number; size: number } {
  let size = options.baseSize
  ctx.font = options.font(size)
  let lines = wrapText(ctx, text, options.maxWidth)
  while (lines.length > options.maxLines && size > options.minSize) {
    size = Math.max(options.minSize, Math.round(size * 0.92))
    ctx.font = options.font(size)
    lines = wrapText(ctx, text, options.maxWidth)
  }
  return {
    size,
    lines: fitLines(lines, options.maxLines),
    lineHeight: Math.round(size * options.lineHeightRatio),
  }
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

function drawCardTile(
  ctx: CanvasRenderingContext2D,
  drawn: DrawnCard,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
) {
  roundRect(ctx, x, y, width, height, 10)
  ctx.fillStyle = 'rgba(13, 16, 32, 0.92)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(217, 182, 103, 0.55)'
  ctx.lineWidth = 1.2
  ctx.stroke()

  roundRect(ctx, x + 6, y + 6, width - 12, height - 12, 6)
  ctx.strokeStyle = 'rgba(217, 182, 103, 0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = 'rgba(217, 182, 103, 0.85)'
  ctx.font = `400 ${14 * scale}px Cinzel, "Cormorant Garamond", serif`
  ctx.fillText(drawn.card.roman, x + width / 2, y + 28 * scale)

  ctx.font = `400 ${38 * scale}px "Songti SC", SimSun, serif`
  ctx.fillStyle = '#e7d5a8'
  ctx.fillText(drawn.card.symbol, x + width / 2, y + 96 * scale)

  ctx.font = `500 ${21 * scale}px "Songti SC", SimSun, serif`
  ctx.fillStyle = '#efe6d2'
  ctx.fillText(drawn.card.name, x + width / 2, y + 154 * scale)

  ctx.font = `400 ${11 * scale}px Cinzel, "Cormorant Garamond", serif`
  ctx.fillStyle = 'rgba(217, 182, 103, 0.65)'
  ctx.fillText(
    drawn.card.nameEn.toUpperCase(),
    x + width / 2,
    y + 180 * scale,
  )

  ctx.font = `400 ${12 * scale}px "Songti SC", SimSun, serif`
  ctx.fillStyle = 'rgba(163, 157, 177, 0.8)'
  ctx.fillText(
    drawn.orientation === 'upright' ? '正位' : '逆位',
    x + width / 2,
    y + 204 * scale,
  )
}

async function saveCanvas(
  canvas: HTMLCanvasElement,
  format: ShareFormat,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('签文图生成失败')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lunar-mirror-${format}-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

interface LongSection {
  label: string
  lines: string[]
  lineHeight: number
  size: number
  color: string
  y: number
}

async function downloadJournalImage(data: ShareData): Promise<void> {
  const WIDTH = 1080
  const TEXT_WIDTH = 860
  const TEXT_X = (WIDTH - TEXT_WIDTH) / 2
  const titleFont = (size: number) =>
    `500 ${size}px "Cormorant Garamond", "Songti SC", SimSun, serif`
  const bodyFont = (size: number) =>
    `400 ${size}px "Songti SC", SimSun, serif`

  try {
    await document.fonts.ready
  } catch {
    // 字体不可用时用系统回退字体绘制
  }

  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = WIDTH
  measureCanvas.height = 10
  const measure = measureCanvas.getContext('2d')
  if (!measure) throw new Error('无法创建画布')

  const title = layoutBlock(measure, data.insight.title, {
    maxWidth: 900,
    maxLines: 2,
    baseSize: 48,
    minSize: 34,
    lineHeightRatio: 1.3,
    font: titleFont,
  })
  const question = layoutBlock(measure, `「${data.question}」`, {
    maxWidth: TEXT_WIDTH,
    maxLines: 4,
    baseSize: 25,
    minSize: 17,
    lineHeightRatio: 1.55,
    font: bodyFont,
  })

  const headerY = 132
  const metaY = 186
  const titleStartY = 272
  const titleEndY =
    titleStartY + Math.max(0, title.lines.length - 1) * title.lineHeight
  const questionStartY = titleEndY + 52
  const questionEndY =
    questionStartY +
    Math.max(0, question.lines.length - 1) * question.lineHeight
  const dividerY = questionEndY + 48
  const cardsY = dividerY + 70
  const cardsHeight =
    data.insight.crisis || data.cards.length === 0 ? 120 : 258
  const verseLabelY = cardsY + cardsHeight + 58
  const verseStartY = verseLabelY + 46
  const verseLineHeight = 52
  const verseEndY =
    verseStartY + Math.max(0, data.verse.length - 1) * verseLineHeight

  let cursorY = verseEndY + 74
  const sectionDefs = [
    {
      label: '你身上的模式',
      text: data.insight.pattern,
      size: 27,
      color: 'rgba(226, 218, 201, 0.9)',
    },
    {
      label: '镜面',
      text: data.insight.mirror,
      size: 27,
      color: 'rgba(226, 218, 201, 0.92)',
    },
    {
      label: '留给你的问题',
      text: data.insight.invitation,
      size: 29,
      color: '#f0d28e',
    },
  ].filter((section) => section.text.trim().length > 0)

  const sections: LongSection[] = sectionDefs.map((section) => {
    measure.font = bodyFont(section.size)
    const lines = wrapText(measure, section.text.trim(), TEXT_WIDTH)
    const lineHeight = Math.round(section.size * 1.75)
    const y = cursorY
    cursorY = y + 30 + lines.length * lineHeight + 46
    return { ...section, lines, lineHeight, y }
  })

  const keywordText = data.insight.keywords.slice(0, 6).join(' · ')
  const keywordLayout = keywordText
    ? layoutBlock(measure, keywordText, {
        maxWidth: 760,
        maxLines: 2,
        baseSize: 20,
        minSize: 15,
        lineHeightRatio: 1.6,
        font: bodyFont,
      })
    : null
  const keywordY = keywordLayout ? cursorY + 4 : cursorY
  const keywordBlockHeight = keywordLayout
    ? 34 + keywordLayout.lines.length * keywordLayout.lineHeight
    : 0
  const contentBottom = keywordY + keywordBlockHeight
  const HEIGHT = Math.max(1920, Math.ceil(contentBottom + 230))

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
  glow(ctx, 900, HEIGHT - 380, 560, 'rgba(170, 125, 68, 0.16)', WIDTH, HEIGHT)

  ctx.strokeStyle = 'rgba(217, 182, 103, 0.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(WIDTH / 2, HEIGHT * 0.46, 420, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(WIDTH / 2, HEIGHT * 0.46, 330, 0, Math.PI * 2)
  ctx.stroke()

  const starCount = Math.min(420, Math.round(HEIGHT / 8))
  for (let index = 0; index < starCount; index += 1) {
    const x = Math.random() * WIDTH
    const y = Math.random() * HEIGHT
    ctx.globalAlpha = Math.random() * 0.5 + 0.15
    ctx.fillStyle = '#f4e6c2'
    ctx.beginPath()
    ctx.arc(x, y, Math.random() * 1.6 + 0.4, 0, Math.PI * 2)
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
  ctx.fillText('LUNAR MIRROR', WIDTH / 2, headerY)

  ctx.font = '400 23px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(163, 157, 177, 0.9)'
  const meta = `${data.querent ? `为「${data.querent}」` : '一次自省'} · ${formatDate(
    data.createdAt ?? Date.now(),
  )}`
  ctx.fillText(meta, WIDTH / 2, metaY)

  ctx.font = titleFont(title.size)
  ctx.fillStyle = '#f0e8d6'
  drawLines(ctx, title.lines, WIDTH / 2, titleStartY, title.lineHeight)

  ctx.font = bodyFont(question.size)
  ctx.fillStyle = 'rgba(163, 157, 177, 0.85)'
  drawLines(
    ctx,
    question.lines,
    WIDTH / 2,
    questionStartY,
    question.lineHeight,
  )

  const divider = ctx.createLinearGradient(220, 0, WIDTH - 220, 0)
  divider.addColorStop(0, 'rgba(217,182,103,0)')
  divider.addColorStop(0.5, 'rgba(217,182,103,0.5)')
  divider.addColorStop(1, 'rgba(217,182,103,0)')
  ctx.strokeStyle = divider
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(220, dividerY)
  ctx.lineTo(WIDTH - 220, dividerY)
  ctx.stroke()
  ctx.fillStyle = '#f0d28e'
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2, dividerY - 4)
  ctx.lineTo(WIDTH / 2 + 4, dividerY)
  ctx.lineTo(WIDTH / 2, dividerY + 4)
  ctx.lineTo(WIDTH / 2 - 4, dividerY)
  ctx.closePath()
  ctx.fill()

  if (data.insight.crisis) {
    ctx.font = '500 28px "Songti SC", SimSun, serif'
    ctx.fillStyle = '#f0d28e'
    ctx.fillText('此刻先不解读牌面', WIDTH / 2, cardsY + 30)
    ctx.font = '400 20px "Songti SC", SimSun, serif'
    ctx.fillStyle = 'rgba(228, 220, 203, 0.85)'
    ctx.fillText(
      '把注意力放回身边的人，以及此刻的安全。',
      WIDTH / 2,
      cardsY + 76,
    )
  } else {
    const cardWidth = 150
    const cardHeight = 230
    const gap = 38
    const totalWidth = cardWidth * 3 + gap * 2
    const startX = (WIDTH - totalWidth) / 2
    data.cards.forEach((drawn, index) => {
      const x = startX + index * (cardWidth + gap)
      ctx.font = '400 14px "Songti SC", SimSun, serif'
      ctx.fillStyle = 'rgba(217, 182, 103, 0.8)'
      ctx.fillText(
        POSITIONS[drawn.position].label,
        x + cardWidth / 2,
        cardsY - 22,
      )
      drawCardTile(ctx, drawn, x, cardsY, cardWidth, cardHeight, 1)
    })
  }

  ctx.font = '400 15px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
  ctx.fillText('签  文', WIDTH / 2, verseLabelY)

  ctx.font = `400 32px "Songti SC", SimSun, serif`
  data.verse.forEach((line, index) => {
    ctx.fillStyle =
      index === data.verse.length - 1
        ? '#f0d28e'
        : 'rgba(228, 220, 203, 0.95)'
    ctx.fillText(line, WIDTH / 2, verseStartY + index * verseLineHeight)
  })

  for (const section of sections) {
    ctx.textAlign = 'center'
    ctx.font = '400 16px "Songti SC", SimSun, serif'
    ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
    ctx.fillText(section.label, WIDTH / 2, section.y)

    ctx.textAlign = 'left'
    ctx.font = bodyFont(section.size)
    ctx.fillStyle = section.color
    drawLines(
      ctx,
      section.lines,
      TEXT_X,
      section.y + 30 + section.lineHeight / 2,
      section.lineHeight,
    )
  }

  if (keywordLayout) {
    ctx.textAlign = 'center'
    ctx.font = '400 16px "Songti SC", SimSun, serif'
    ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
    ctx.fillText('此刻的词', WIDTH / 2, keywordY + 14)
    ctx.font = bodyFont(keywordLayout.size)
    ctx.fillStyle = 'rgba(239, 230, 210, 0.9)'
    drawLines(
      ctx,
      keywordLayout.lines,
      WIDTH / 2,
      keywordY + 34 + keywordLayout.lineHeight / 2,
      keywordLayout.lineHeight,
    )
  }

  ctx.textAlign = 'center'
  ctx.font = '400 20px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(217, 182, 103, 0.72)'
  ctx.fillText('塔罗不预言命运，只邀请你看见自己', WIDTH / 2, HEIGHT - 160)

  ctx.font = '500 14px Cinzel, "Cormorant Garamond", serif'
  ctx.fillStyle = 'rgba(163, 157, 177, 0.55)'
  ctx.fillText('LUNAR MIRROR · 月鉴', WIDTH / 2, HEIGHT - 110)

  await saveCanvas(canvas, 'long')
}

export async function downloadInsightImage(
  data: ShareData,
  format: ShareFormat = 'poster',
): Promise<void> {
  if (format === 'long') {
    await downloadJournalImage(data)
    return
  }
  const isStory = format === 'story'
  const WIDTH = 1080
  const HEIGHT = isStory ? 1920 : 1350
  const cardScale = isStory ? 1.2 : 1
  const headerY = isStory ? 150 : 104
  const metaY = isStory ? 208 : 152
  const titleSize = isStory ? 50 : 44
  const titleStartY = isStory ? 340 : 238
  const questionGap = isStory ? 66 : 54
  const questionSize = isStory ? 27 : 23
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
  ctx.fillText('LUNAR MIRROR', WIDTH / 2, headerY)

  ctx.font = '400 23px "Songti SC", SimSun, serif'
  ctx.fillStyle = 'rgba(163, 157, 177, 0.9)'
  const meta = `${data.querent ? `为「${data.querent}」` : '一次自省'} · ${formatDate(
    data.createdAt ?? Date.now(),
  )}`
  ctx.fillText(meta, WIDTH / 2, metaY)

  const titleFont = (size: number) =>
    `500 ${size}px "Cormorant Garamond", "Songti SC", SimSun, serif`
  const titleLayout = layoutBlock(ctx, data.insight.title, {
    maxWidth: 900,
    maxLines: 2,
    baseSize: titleSize,
    minSize: isStory ? 36 : 32,
    lineHeightRatio: 1.32,
    font: titleFont,
  })
  ctx.font = titleFont(titleLayout.size)
  ctx.fillStyle = '#f0e8d6'
  let cursorY = drawLines(
    ctx,
    titleLayout.lines,
    WIDTH / 2,
    titleStartY,
    titleLayout.lineHeight,
  )

  const questionFont = (size: number) =>
    `400 ${size}px "Songti SC", SimSun, serif`
  const questionLayout = layoutBlock(ctx, `「${data.question}」`, {
    maxWidth: 860,
    maxLines: 3,
    baseSize: questionSize,
    minSize: isStory ? 19 : 17,
    lineHeightRatio: 1.55,
    font: questionFont,
  })
  ctx.font = questionFont(questionLayout.size)
  ctx.fillStyle = 'rgba(163, 157, 177, 0.85)'
  cursorY = drawLines(
    ctx,
    questionLayout.lines,
    WIDTH / 2,
    cursorY + questionGap,
    questionLayout.lineHeight,
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
      drawCardTile(ctx, drawn, x, cardY, cardWidth, cardHeight, cardScale)
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
    'LUNAR MIRROR · 月鉴',
    WIDTH / 2,
    HEIGHT - (isStory ? 100 : 78),
  )

  await saveCanvas(canvas, format)
}
