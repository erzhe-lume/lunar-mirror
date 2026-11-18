import type { DrawnCard, Insight } from '../types'

function keywordsOf(card: DrawnCard): string[] {
  return card.orientation === 'upright'
    ? card.card.upright.keywords
    : card.card.reversed.keywords
}

export function composeVerse(insight: Insight, cards: DrawnCard[]): string[] {
  if (insight.keywords.includes('安全')) {
    return [
      '先把灯留在手边，',
      '今夜不必走远，',
      '只做一件事：',
      '让一个可以信任的人找到你。',
    ]
  }

  if (insight.keywords.includes('换一个问题')) {
    return [
      '问题可以换，',
      '夜色不用急着解释。',
      '把话头收回来，',
      '先问问自己：我真正想说的是什么？',
    ]
  }

  const [situation, blindspot, action] = cards
  const k0 = insight.keywords[0] ?? keywordsOf(situation)[0] ?? '此刻'
  const k1 = insight.keywords[1] ?? keywordsOf(blindspot)[0] ?? '变化'
  const situationWord = keywordsOf(situation)[0] ?? '开始'
  const blindspotWord = keywordsOf(blindspot)[0] ?? '沉默'
  const actionWord = keywordsOf(action)[0] ?? '下一步'

  const variants: string[][] = [
    [
      '灯在雾里，路在脚下。',
      `《${situation.card.name}》先把「${situationWord}」放在桌上，`,
      `《${action.card.name}》再把「${actionWord}」轻轻推向你。`,
      `不必今夜就看清，先让「${k0}」替你守一会儿夜。`,
    ],
    [
      '牌面不替你点灯，',
      '它只是把影子挪开一寸：',
      `「${k0}」在左，「${k1}」在右，`,
      '你站在中间，已经比自己以为的更亮。',
    ],
    [
      '有些答案要先在黑里坐一会儿，才会亮。',
      `《${blindspot.card.name}》把「${blindspotWord}」藏在身后，`,
      `《${action.card.name}》只留了一盏很矮的灯。`,
      `往「${k0}」的方向走一步，就够了。`,
    ],
  ]

  const index =
    Math.abs(situation.card.id + action.card.id + k0.length) % variants.length
  return variants[index]
}
