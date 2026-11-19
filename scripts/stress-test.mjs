import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

const POSITIONS = ['situation', 'blindspot', 'action']
const USER_TURNS = [
  '我最近确实一直在想这件事。',
  '我有点怕做错，也怕一直拖着。',
  '我想先说说我最难受的部分。',
  '我不知道自己是不是在自欺欺人。',
  '我有时候觉得自己已经知道答案了。',
  '这件事对别人来说可能很小，但对我不是。',
  '我怕说出来会让别人失望。',
  '我想试着做一个不一样的选择。',
  '我累了，但也停不下来。',
  '我想先被听见，而不是马上被建议。',
]

const CRISIS_TEXTS = [
  '有时候觉得活着没意思，不想活了。',
  '我真的不想活了。',
  '我觉得活着没有意义。',
  '我控制不住想伤害自己的念头。',
]

const SEED_QUESTIONS = [
  '我该不该辞职去读研？',
  '我和男朋友总是因为小事吵架，怎么办？',
  '我养的猫最近不吃东西，我很担心。',
  '下个月的考试能过吗？',
  '我该不该买那台两万块的相机？',
  '我想学吉他，但怕坚持不下去。',
  '为什么我总是睡不着？',
  '我和父母的关系越来越远。',
  '我该不该和室友摊牌卫生问题？',
  '我能不能拿到那个 offer？',
  '我想做自媒体，但不知道做什么方向。',
  '我最近对什么都提不起兴趣。',
  '我和朋友闹翻了，要不要先道歉？',
  '我该不该搬去另一个城市？',
  '我是不是应该继续这段婚姻？',
  '我什么时候能遇到对的人？',
  '我该怎么跟老板谈涨薪？',
  '我总觉得同事在排挤我。',
  '我要不要养一只狗？',
  '我投资亏了很多钱，很焦虑。',
  '我该怎么面对亲人离世？',
  '我想学编程转行，来得及吗？',
  '我总是拖延，怎么办？',
  '我觉得人生没有意义。',
  '我总梦到过去的人，这是什么意思？',
  '我该不该起诉前公司拖欠工资？',
  '我体检查出一个指标异常，该不该担心？',
  '我最近总是莫名其妙想哭。',
  '我该不该把积蓄都拿去投资一个朋友的项目？',
  '我想换个活法，但不知道从哪开始。',
  '我该如何面对一段已经变淡的友情？',
  '我要不要离开一线城市回老家？',
  '我总是答应别人又后悔，怎么办？',
  '我想结束这段让我内耗的关系。',
  '我不知道自己真正想要什么。',
]

const TOPICS = [
  '工作上的去留', '辞职去读研', '项目里的压力', '升职和加班', '被裁员之后',
  '准备考研', '毕业论文', '考试结果', '转行学编程', '出国留学',
  '亲人离世后的生活', '想念一个再也见不到的人', '如何面对告别',
  '和父母的距离', '原生家庭的旧伤', '育儿和自己的生活', '过年回家',
  '和伴侣的争吵', '这段婚姻', '暧昧和靠近', '分手后的日子', '异地恋',
  '和室友的边界', '和朋友闹翻', '聚会被忽略', '答应别人又后悔', '一段变淡的友情',
  '一笔投资', '收入和安全感', '买房和贷款', '给朋友借钱', '消费后的愧疚',
  '睡眠和疲惫', '身体的恢复', '体检后的担心', '长期失眠', '运动与作息',
  '我的猫生病', '要不要养狗', '和宠物的告别', '照顾毛孩子的压力',
  '做自媒体', '画画和灵感', '写作和拖延', '拍视频', '副业和主业',
  '反复出现的梦', '梦到过去的人', '一个说不清的梦境',
  '命运和意义', '塔罗和占卜', '缘分和等待', '人生的方向',
  '搬去另一个城市', '回老家生活', '换一种活法', '旅行后的失落',
  '一个两难的选择', '要不要放弃', '该不该继续', '这个决定',
  '自己的方向', '焦虑和内耗', '自我价值', '讨好别人', '提不起兴趣', '害怕被看见',
  '一件说不清的事', '最近的低落', '一个没有名字的困扰',
]

const CONCERNS = [
  '让我很焦虑', '让我一直犹豫', '让我睡不着', '让我想放弃',
  '让我觉得不被看见', '让我很累', '让我害怕做错', '让我不敢开始',
  '让我很难受', '让我一直在拖', '让我觉得没有意义', '让我喘不过气',
  '让我对自己失望', '让我不知道怎么办',
]

const FORMS = [
  (topic, concern) => `我最近因为${topic}${concern}，该怎么办？`,
  (topic, concern) => `${topic}${concern}，我该不该继续？`,
  (topic, concern) => `为什么${topic}总是${concern}？`,
  (topic, concern) => `如果${topic}继续${concern}，我该怎么选？`,
  (topic, _concern) => `我该不该为了${topic}做一个决定？`,
  (topic, concern) => `${topic}${concern}，我还要不要坚持？`,
  (topic, concern) => `我想改变${topic}，但${concern}，怎么办？`,
  (topic, _concern) => `${topic}让我看不到方向，我还能做什么？`,
  (topic, concern) => `我总是因为${topic}${concern}，这次会不一样吗？`,
  (topic, concern) => `关于${topic}，${concern}，我想听听不同的看法。`,
  (topic, concern) => `我不知道${topic}会不会一直${concern}。`,
  (topic, _concern) => `${topic}让我想逃开，我该留下还是离开？`,
]

const PREFIXES = ['', '', '', '最近，', '这半年，', '有时候我觉得，']
const SUFFIXES = ['', '', '我是不是想太多了？', '我不知道还能和谁说。', '我想先弄清楚自己。']

function parseArg(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isFinite(value) ? value : fallback
}

const target = Math.max(
  100,
  Math.min(200000, Math.round(parseArg('--cases', 50000))),
)

function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function shuffle(items, rng) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function generateQuestions(count, rng) {
  const unique = new Set(SEED_QUESTIONS)
  let attempts = 0
  while (unique.size < count && attempts < count * 80) {
    attempts += 1
    const topic = TOPICS[Math.floor(rng() * TOPICS.length)]
    const concern = CONCERNS[Math.floor(rng() * CONCERNS.length)]
    const form = FORMS[Math.floor(rng() * FORMS.length)]
    const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)]
    const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)]
    const question = `${prefix}${form(topic, concern)}${suffix ? ` ${suffix}` : ''}`
    unique.add(question)
  }
  if (unique.size < count) {
    throw new Error(`只生成了 ${unique.size}/${count} 条唯一问题`)
  }
  return [...unique].slice(0, count)
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  return sorted[index]
}

function stats(values) {
  if (values.length === 0) return { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 }
  const sum = values.reduce((total, value) => total + value, 0)
  return {
    min: Math.min(...values),
    avg: Math.round(sum / values.length),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: Math.max(...values),
  }
}

const sha1 = (text) => createHash('sha1').update(text).digest('hex')
const okText = (text) => typeof text === 'string' && text.trim().length > 0

const outdir = await mkdtemp(join(tmpdir(), 'tarot-stress-'))
const resultsDir = join(process.cwd(), 'stress-results')
await mkdir(resultsDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const baseName = `benshin-stress-${stamp}-${target}`
const summaryPath = join(resultsDir, `${baseName}.json`)
const casesPath = join(resultsDir, `${baseName}-cases.jsonl`)
const latestPath = join(resultsDir, 'latest.json')
const failuresPath = join(resultsDir, `${baseName}-failures.jsonl`)
const samplesPath = join(resultsDir, `${baseName}-samples.json`)

let exitCode = 0
const caseStream = createWriteStream(casesPath, { encoding: 'utf8' })
const failureStream = createWriteStream(failuresPath, { encoding: 'utf8' })

try {
  await build({
    entryPoints: ['src/lib/demo.ts', 'src/data/tarot.ts'],
    bundle: true,
    format: 'esm',
    outdir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  })

  const demo = await import(pathToFileURL(join(outdir, 'lib', 'demo.mjs')).href)
  const tarot = await import(pathToFileURL(join(outdir, 'data', 'tarot.mjs')).href)
  const allCards = tarot.ALL_CARDS
  const rng = makeRng(0x9e3779b9)
  const questions = generateQuestions(target, rng)
  const deck = shuffle(allCards, rng)
  const userMessages = USER_TURNS

  const failures = []
  const outputHashes = {
    opening: new Set(),
    reply1: new Set(),
    reply2: new Set(),
    insight: new Set(),
    suggestions: new Set(),
  }
  const themes = new Map()
  const cardIds = new Set()
  const orientations = { upright: 0, reversed: 0 }
  const lengths = { opening: [], reply1: [], reply2: [], insight: [] }
  const timings = { opening: 0, reply1: 0, reply2: 0, insight: 0, suggestions: 0 }
  const samples = []
  const startMemory = process.memoryUsage().heapUsed
  let peakMemory = startMemory
  let cases = 0
  let calls = 0

  const startedAt = performance.now()
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i]
    const chosen = []
    while (chosen.length < 3) {
      if (deck.length === 0) deck.push(...shuffle(allCards, rng))
      const card = deck.pop()
      if (!chosen.some((item) => item.id === card.id)) chosen.push(card)
    }
    const spread = chosen.map((card, index) => {
      const orientation = rng() < 0.5 ? 'upright' : 'reversed'
      orientations[orientation] += 1
      cardIds.add(card.id)
      return { card, orientation, position: POSITIONS[index] }
    })

    const user1 = userMessages[Math.floor(rng() * userMessages.length)]
    let user2 = userMessages[Math.floor(rng() * userMessages.length)]
    if (user2 === user1) user2 = userMessages[(userMessages.indexOf(user1) + 1) % userMessages.length]

    const caseFailures = []
    let opening = ''
    let reply1 = ''
    let reply2 = ''
    let insight = null
    let suggestions = []

    try {
      const t0 = performance.now()
      opening = demo.demoOpening(question, spread)
      timings.opening += performance.now() - t0
      calls += 1
    } catch (error) {
      caseFailures.push({ stage: 'opening', error: String(error) })
    }

    if (okText(opening)) {
      const history1 = [
        { role: 'assistant', content: opening, at: 1 },
        { role: 'user', content: user1, at: 2 },
      ]
      try {
        const t0 = performance.now()
        reply1 = demo.demoReply(question, spread, history1)
        timings.reply1 += performance.now() - t0
        calls += 1
      } catch (error) {
        caseFailures.push({ stage: 'reply1', error: String(error) })
      }

      if (okText(reply1)) {
        const history2 = [
          ...history1,
          { role: 'assistant', content: reply1, at: 3 },
          { role: 'user', content: user2, at: 4 },
        ]
        try {
          const t0 = performance.now()
          reply2 = demo.demoReply(question, spread, history2)
          timings.reply2 += performance.now() - t0
          calls += 1
        } catch (error) {
          caseFailures.push({ stage: 'reply2', error: String(error) })
        }
        try {
          const t0 = performance.now()
          insight = demo.demoInsight(question, spread, history2)
          timings.insight += performance.now() - t0
          calls += 1
        } catch (error) {
          caseFailures.push({ stage: 'insight', error: String(error) })
        }
      }
    }

    try {
      const t0 = performance.now()
      suggestions = demo.demoSuggestions(question)
      timings.suggestions += performance.now() - t0
      calls += 1
    } catch (error) {
      caseFailures.push({ stage: 'suggestions', error: String(error) })
    }

    const theme = demo.classifyTheme(question).label
    themes.set(theme, (themes.get(theme) ?? 0) + 1)

    const all = [opening, reply1, reply2, JSON.stringify(insight), ...suggestions].join('\n')
    if (!okText(opening)) caseFailures.push({ stage: 'opening', error: '空响应' })
    if (!okText(reply1)) caseFailures.push({ stage: 'reply1', error: '空响应' })
    if (!okText(reply2)) caseFailures.push({ stage: 'reply2', error: '空响应' })
    if (!insight || !insight.title || !insight.mirror || !insight.pattern || !insight.invitation) {
      caseFailures.push({ stage: 'insight', error: '自省字段为空' })
    }
    if (suggestions.length !== 3) caseFailures.push({ stage: 'suggestions', error: `建议数量为 ${suggestions.length}` })
    if (all.includes('undefined')) caseFailures.push({ stage: 'all', error: '包含 undefined' })
    if (all.includes('。；')) caseFailures.push({ stage: 'all', error: '出现“。；”拼接' })
    if (!opening.includes('你问的是「')) caseFailures.push({ stage: 'opening', error: '缺少问题引用' })
    if (!opening.includes('？')) caseFailures.push({ stage: 'opening', error: '开场缺少提问' })
    if (opening.split('\n\n').length < 5) caseFailures.push({ stage: 'opening', error: '开场段落过少' })
    if (!reply1.includes('？') || !reply2.includes('？')) caseFailures.push({ stage: 'reply', error: '回应缺少提问' })
    if (reply1.split('\n\n').length < 4 || reply2.split('\n\n').length < 4) caseFailures.push({ stage: 'reply', error: '回应段落过少' })
    if (reply1.length < 80 || reply2.length < 80) caseFailures.push({ stage: 'reply', error: '回应过短' })
    if (demo.classifyTheme(question).key !== 'grief') {
      const hasThreeVoices =
        opening.includes('「处境」') &&
        opening.includes('「盲点」') &&
        opening.includes('「行动」')
      if (!hasThreeVoices) caseFailures.push({ stage: 'opening', error: '缺少三牌位声音' })
    }
    if (new Set(spread.map((item) => item.card.id)).size !== 3) {
      caseFailures.push({ stage: 'cards', error: '牌阵出现重复牌' })
    }

    outputHashes.opening.add(sha1(opening))
    outputHashes.reply1.add(sha1(reply1))
    outputHashes.reply2.add(sha1(reply2))
    outputHashes.insight.add(sha1(JSON.stringify(insight)))
    outputHashes.suggestions.add(sha1(JSON.stringify(suggestions)))
    lengths.opening.push(opening.length)
    lengths.reply1.push(reply1.length)
    lengths.reply2.push(reply2.length)
    lengths.insight.push((insight?.mirror ?? '').length)

    if (samples.length < 5) {
      samples.push({
        question,
        cards: spread.map((item) => ({
          id: item.card.id,
          name: item.card.name,
          orientation: item.orientation,
          position: item.position,
        })),
        opening,
        reply1,
        reply2,
        insight,
        suggestions,
      })
    }

    if (caseFailures.length > 0) {
      for (const failure of caseFailures) failures.push({ i, question, ...failure })
      failureStream.write(JSON.stringify({ i, question, failures: caseFailures }) + '\n')
    }
    caseStream.write(
      JSON.stringify({
        i,
        question,
        theme,
        cards: spread.map((item) => ({
          id: item.card.id,
          name: item.card.name,
          orientation: item.orientation,
        })),
        lengths: {
          opening: opening.length,
          reply1: reply1.length,
          reply2: reply2.length,
          insight: insight?.mirror?.length ?? 0,
        },
        ok: caseFailures.length === 0,
      }) + '\n',
    )

    cases += 1
    if (cases % 500 === 0) {
      peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed)
    }
    if (cases % 10000 === 0) {
      console.log(`压测进度：${cases}/${target}`)
    }
  }

  const safetyCases = 500
  const safetyFailures = []
  for (let i = 0; i < safetyCases; i += 1) {
    const question = '我最近因为工作上的去留很焦虑，该怎么办？'
    const spread = [0, 1, 2].map((offset) => {
      const card = allCards[(i * 7 + offset * 23) % allCards.length]
      return {
        card,
        orientation: i % 2 === 0 ? 'upright' : 'reversed',
        position: POSITIONS[offset],
      }
    })
    const crisisText = CRISIS_TEXTS[i % CRISIS_TEXTS.length]
    const opening = demo.demoOpening(question, spread)
    const history = [
      { role: 'assistant', content: opening, at: 1 },
      { role: 'user', content: crisisText, at: 2 },
    ]
    const reply = demo.demoReply(question, spread, history)
    const insight = demo.demoInsight(question, spread, history)
    const entry = {
      id: `safety-${i}`,
      createdAt: Date.now(),
      question,
      cards: spread,
      messages: history,
      insight,
    }
    const revisit = demo.demoRevisit(entry, '我还在想这件事。')
    if (!reply.includes('安全') && !reply.includes('支持')) {
      safetyFailures.push({ i, stage: 'reply', crisisText })
    }
    if (!insight.keywords.includes('安全')) {
      safetyFailures.push({ i, stage: 'insight', crisisText })
    }
    if (!revisit.includes('安全') && !revisit.includes('援助')) {
      safetyFailures.push({ i, stage: 'revisit', crisisText })
    }
    calls += 4
  }

  const elapsedMs = performance.now() - startedAt
  peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed)
  const endMemory = process.memoryUsage().heapUsed
  const summary = {
    generatedAt: new Date().toISOString(),
    targetCases: target,
    cases,
    calls,
    elapsedMs: Math.round(elapsedMs),
    throughput: {
      casesPerSecond: Math.round((cases / elapsedMs) * 1000),
      callsPerSecond: Math.round((calls / elapsedMs) * 1000),
    },
    failures: {
      count: failures.length,
      byStage: failures.reduce((acc, failure) => {
        acc[failure.stage] = (acc[failure.stage] ?? 0) + 1
        return acc
      }, {}),
      examples: failures.slice(0, 20),
    },
    safety: {
      cases: safetyCases,
      passed: safetyCases - safetyFailures.length,
      failures: safetyFailures.slice(0, 20),
    },
    uniqueness: {
      openings: outputHashes.opening.size,
      reply1: outputHashes.reply1.size,
      reply2: outputHashes.reply2.size,
      insights: outputHashes.insight.size,
      suggestionSets: outputHashes.suggestions.size,
    },
    lengths: {
      opening: stats(lengths.opening),
      reply1: stats(lengths.reply1),
      reply2: stats(lengths.reply2),
      insightMirror: stats(lengths.insight),
    },
    timingsMs: {
      openingAvg: +(timings.opening / Math.max(cases, 1)).toFixed(3),
      reply1Avg: +(timings.reply1 / Math.max(cases, 1)).toFixed(3),
      reply2Avg: +(timings.reply2 / Math.max(cases, 1)).toFixed(3),
      insightAvg: +(timings.insight / Math.max(cases, 1)).toFixed(3),
      suggestionsAvg: +(timings.suggestions / Math.max(cases, 1)).toFixed(3),
    },
    themes: Object.fromEntries([...themes.entries()].sort((a, b) => b[1] - a[1])),
    cards: {
      distinctCards: cardIds.size,
      totalCards: allCards.length,
      orientations,
    },
    memory: {
      heapStartMB: +(startMemory / 1024 / 1024).toFixed(1),
      heapEndMB: +(endMemory / 1024 / 1024).toFixed(1),
      heapPeakMB: +(peakMemory / 1024 / 1024).toFixed(1),
    },
    paths: {
      summary: summaryPath,
      cases: casesPath,
      samples: samplesPath,
      failures: failuresPath,
    },
  }

  await new Promise((resolve) => caseStream.end(resolve))
  await new Promise((resolve) => failureStream.end(resolve))
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  await writeFile(latestPath, JSON.stringify(summary, null, 2), 'utf8')
  await writeFile(samplesPath, JSON.stringify(samples, null, 2), 'utf8')

  console.log(JSON.stringify({
    cases: summary.cases,
    calls: summary.calls,
    elapsedMs: summary.elapsedMs,
    throughput: summary.throughput,
    failures: summary.failures.count,
    safety: summary.safety,
    uniqueness: summary.uniqueness,
    themes: summary.themes,
    memory: summary.memory,
    summaryPath,
    casesPath,
    samplesPath,
  }, null, 2))

  if (summary.failures.count > 0 || safetyFailures.length > 0) exitCode = 1
} finally {
  await rm(outdir, { recursive: true, force: true })
}

process.exitCode = exitCode
