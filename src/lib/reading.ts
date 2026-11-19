export type ReadingKind = 'opening' | 'reply'

const SENTENCE_END = /[。！？!?…]/

function splitSentences(text: string): string[] {
  return (
    text.match(/[^。！？!?…]*[。！？!?…]+[”’」』]?|[^。！？!?…]+$/g) ?? []
  )
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

/**
 * 模型经常忽略分段要求，返回一整块长文。这里只做排版，不改写内容：
 * 把超过两段能力的单块文字按句号切成 2-4 段，方便手机上阅读。
 */
export function shapeReading(text: string, kind: ReadingKind): string {
  const clean = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!clean) return clean

  const blocks = clean
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (blocks.length >= 2) return blocks.join('\n\n')

  if (clean.length < 180) return clean

  const sentences = splitSentences(clean)
  if (sentences.length < 3) return clean

  const paragraphCount =
    kind === 'opening' ? (clean.length > 420 ? 3 : 2) : 2
  if (sentences.length < paragraphCount) return clean

  const groups: string[][] = []
  const perGroup = Math.ceil(sentences.length / paragraphCount)
  for (let index = 0; index < sentences.length; index += perGroup) {
    groups.push(sentences.slice(index, index + perGroup))
  }
  return groups
    .slice(0, 4)
    .map((group) => group.join(''))
    .join('\n\n')
}

export function hasSentenceEnd(value: string): boolean {
  return SENTENCE_END.test(value)
}
