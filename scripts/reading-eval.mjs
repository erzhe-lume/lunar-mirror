import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { READING_EVAL_CASES } from './reading-eval-cases.mjs'

const ROOT = process.cwd()
const OUT_DIR =
  process.env.EVAL_OUT_DIR ??
  'C:/Users/32135/ego/reading-eval-20261119'
const BUILD_DIR = path.join(OUT_DIR, '.build')
const BASE = process.env.EVAL_BASE ?? 'http://127.0.0.1:8788/v1'
const MODELS = (process.env.EVAL_MODELS ?? 'deepseek-v4.1-flash,glm-5.3-flash')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const KEY = (process.env.EVAL_KEY ?? '').trim()
const LIMIT = Math.max(0, Number(process.env.EVAL_LIMIT ?? 0) || 0)
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3) || 3)
const CASES = LIMIT > 0 ? READING_EVAL_CASES.slice(0, LIMIT) : READING_EVAL_CASES
const POSITION_KEYS = ['situation', 'blindspot', 'action']
const BANNED = [
  '答案在你心里',
  '跟随你的内心',
  '相信自己',
  '一切都是最好的安排',
  '你需要学会爱自己',
  '放下执念',
  '牌告诉你',
  '牌面注定',
]

await fs.mkdir(BUILD_DIR, { recursive: true })
await build({
  entryPoints: [
    path.join(ROOT, 'src/lib/llm.ts'),
    path.join(ROOT, 'src/lib/demo.ts'),
    path.join(ROOT, 'src/data/tarot.ts'),
  ],
  outdir: BUILD_DIR,
  bundle: true,
  format: 'esm',
  platform: 'node',
  outExtension: { '.js': '.mjs' },
  logLevel: 'silent',
  define: {
    'import.meta.env': JSON.stringify({
      VITE_QWEN_BASE: '/api/qwen',
      VITE_OPENAI_BASE: '/api/openai',
      VITE_DEEPSEEK_BASE: '/api/deepseek',
      VITE_ANTHROPIC_BASE: '/api/anthropic',
      VITE_GEMINI_BASE: '/api/gemini',
    }),
  },
})

const llm = await import(
  pathToFileURL(path.join(BUILD_DIR, 'lib', 'llm.mjs')).href
)
const demo = await import(
  pathToFileURL(path.join(BUILD_DIR, 'lib', 'demo.mjs')).href
)
const tarot = await import(
  pathToFileURL(path.join(BUILD_DIR, 'data', 'tarot.mjs')).href
)
const cardsById = new Map(tarot.ALL_CARDS.map((card) => [card.id, card]))
const cardsByName = new Map(tarot.ALL_CARDS.map((card) => [card.name, card]))

function drawnCards(testCase) {
  return testCase.cards.map(([id, orientation], index) => ({
    card: cardsById.get(id),
    orientation,
    position: POSITION_KEYS[index],
  }))
}

function wordsOf(text) {
  return text
    .split(/[，。？！、；：“”‘’\s]/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
}

function sentencesOf(value) {
  return value
    .split(/[。！？!?\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
}

function repeatedPhrase(text, previous) {
  if (!previous) return false
  const previousSentences = new Set(sentencesOf(previous))
  return sentencesOf(text).some((sentence) => previousSentences.has(sentence))
}

function measure(text, testCase, kind, previous = '', quoteText = testCase.question) {
  const clean = String(text ?? '').trim()
  const drawn = drawnCards(testCase)
  const cardHits = drawn
    .filter(
      ({ card }) =>
        clean.includes(card.name) || clean.includes(`《${card.name}》`),
    )
    .map(({ card }) => card.name)
  const quoteHits = wordsOf(quoteText).filter((word) =>
    clean.includes(word),
  )
  const hedgeHits =
    clean.match(/也许|可能|我不确定|不太确定|也可以|另一种|反过来|或者/g) ?? []
  const bannedHits = BANNED.filter((phrase) => clean.includes(phrase))
  const voiceFlags = ['牌告诉你', '牌面注定', '牌面说', '命中注定'].filter(
    (phrase) => clean.includes(phrase),
  )
  const relationHits =
    clean.match(/两张|三张|同属|数字|逆位|互相|之间|重复|呼应|一边|另一张/g) ??
    []
  const paragraphs = clean
    .split(/\n\s*\n|\n/)
    .map((item) => item.trim())
    .filter(Boolean).length
  const opening = kind === 'opening'
  const minLength = opening ? 300 : 180
  const maxLength = opening ? 650 : 480
  const checks = {
    quote: quoteHits.length > 0,
    cardFocus: cardHits.length >= 1 && cardHits.length <= 3,
    plurality: hedgeHits.length >= 2,
    shape:
      clean.length >= minLength &&
      clean.length <= maxLength &&
      paragraphs >= 2 &&
      paragraphs <= 4,
    closing: /[？?]/.test(clean.slice(-80)),
    noBanned: bannedHits.length === 0,
    noMarkdown: !/(^|\n)#{1,6}\s|\*\*|(^|\n)[-*]\s/.test(clean),
    noRepeat: !repeatedPhrase(clean, previous),
  }
  const score =
    Number(checks.quote) +
    Number(checks.cardFocus) +
    Number(checks.plurality) +
    Number(checks.shape) +
    Number(checks.closing)
  return {
    kind,
    charCount: clean.length,
    paragraphs,
    score,
    checks,
    cardHits,
    quoteHits: [...new Set(quoteHits)].slice(0, 6),
    hedgeCount: hedgeHits.length,
    bannedHits,
    voiceFlags,
    relationHits: [...new Set(relationHits)],
  }
}

function mean(values) {
  if (values.length === 0) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

function summarize(records) {
  const groups = new Map()
  for (const record of records) {
    const key = `${record.model} · ${record.kind}`
    const group = groups.get(key) ?? []
    group.push(record.metrics)
    groups.set(key, group)
  }
  return [...groups.entries()].map(([key, metrics]) => ({
    key,
    samples: metrics.length,
    avgScore: mean(metrics.map((item) => item.score)),
    avgChars: mean(metrics.map((item) => item.charCount)),
    avgParagraphs: mean(metrics.map((item) => item.paragraphs)),
    cardsOneOrTwo: metrics.filter(
      (item) => item.cardHits.length >= 1 && item.cardHits.length <= 2,
    ).length,
    allThreeCards: metrics.filter((item) => item.cardHits.length >= 3).length,
    plurality: metrics.filter((item) => item.checks.plurality).length,
    shape: metrics.filter((item) => item.checks.shape).length,
    quote: metrics.filter((item) => item.checks.quote).length,
    banned: metrics.reduce((sum, item) => sum + item.bannedHits.length, 0),
    voiceFlags: metrics.reduce(
      (sum, item) => sum + item.voiceFlags.length,
      0,
    ),
    relations: metrics.filter((item) => item.relationHits.length > 0).length,
  }))
}

async function recordingsMode() {
  const source =
    process.env.EVAL_RECORDINGS ?? 'C:/Users/32135/ego/tarot-live-20261118'
  const files = (await fs.readdir(source))
    .filter((name) => /^flow-\d+\.json$/.test(name))
    .sort()
  const records = []
  for (const file of files) {
    const flow = JSON.parse(await fs.readFile(path.join(source, file), 'utf8'))
    if (!flow.question || !Array.isArray(flow.steps)) continue
    const testCase = {
      id: flow.flow ?? file,
      question: flow.question,
      cards: Array.isArray(flow.cards)
        ? flow.cards.map((drawn, index) => [
            cardsByName.get(drawn.card)?.id ?? index,
            drawn.orientation ?? 'upright',
          ])
        : [
            [0, 'upright'],
            [1, 'upright'],
            [2, 'upright'],
          ],
    }
    let previous = ''
    for (const step of flow.steps) {
      const text = Array.isArray(step.text) ? step.text.join('\n') : step.text
      if (!text || !['opening', 'reply-1', 'reply-2'].includes(step.kind)) {
        continue
      }
      const kind = step.kind === 'opening' ? 'opening' : 'reply'
      const metrics = measure(text, testCase, kind, previous)
      records.push({
        model: flow.model || 'unknown',
        caseId: testCase.id,
        question: flow.question,
        kind,
        text,
        metrics,
      })
      previous = text
    }
  }
  await fs.mkdir(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, 'recordings-baseline.json')
  await fs.writeFile(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), source, summary: summarize(records), records }, null, 2),
  )
  console.log(JSON.stringify({ mode: 'recordings', file, summary: summarize(records) }, null, 2))
}

function settingsFor(model) {
  return {
    apiKey: KEY,
    apiProtocol: 'openai',
    apiBase: BASE,
    model,
    modelHistory: {},
    modelProfiles: [],
    activeProfileId: null,
    voiceEnabled: false,
    voiceURI: '',
    soundEnabled: false,
    bgmEnabled: false,
    bgmVolume: 0.4,
    offline: false,
    theme: 'violet',
  }
}

async function pool(items, limit, worker) {
  const results = []
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function judgeRecord(record, testCase, judgeModel) {
  const cardLines = testCase.cards
    .map(([id, orientation], index) => {
      const card = cardsById.get(id)
      return `${POSITION_KEYS[index]}：《${card?.name ?? id}》${
        orientation === 'upright' ? '正位' : '逆位'
      }`
    })
    .join('；')
  const response = await fetch(`${BASE.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: judgeModel,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content:
            '你是严格的塔罗自省解读评审。只输出 JSON，不要解释。评分 1-5 分，5 分最好。标准：capture=是否接住用户具体原话；cardEvidence=是否引用具体牌面证据；只评价实际用到的牌，不要求提到全部三张，也不要求逐张报牌；plurality=是否先给明确主读法、再给真正拆台的反读法，而不是平均列可能；progression=是否推进了新的区分而不是复述；landing=结尾是否有一个具体落点；restraint=是否不诊断、不预测、不断言“牌告诉你/命中注定”；overall=整体。reason 用一句中文说明扣分点。',
        },
        {
          role: 'user',
          content: `用户问题：「${testCase.question}」
${record.kind === 'reply' ? `用户追问：「${testCase.followUp}」` : '（这是开场。不要评价它是否回应了后续追问。）'}
牌面：${cardLines}
${record.kind === 'reply' ? `上一轮回答：${record.previous ?? ''}` : ''}
待评审回答：
${record.text}

请输出 JSON：{"capture":1-5,"cardEvidence":1-5,"plurality":1-5,"progression":1-5,"landing":1-5,"restraint":1-5,"overall":1-5,"reason":"..."}`,
        },
      ],
    }),
  })
  if (!response.ok) {
    throw new Error(`评审模型返回 ${response.status}`)
  }
  const data = await response.json()
  const raw = data?.choices?.[0]?.message?.content
  if (typeof raw !== 'string') throw new Error('评审模型没有返回内容')
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('评审结果不是 JSON')
  const parsed = JSON.parse(match[0])
  const fields = [
    'capture',
    'cardEvidence',
    'plurality',
    'progression',
    'landing',
    'restraint',
    'overall',
  ]
  const scores = {}
  fields.forEach((field) => {
    const value = Number(parsed[field])
    scores[field] = Number.isFinite(value)
      ? Math.min(5, Math.max(1, Math.round(value)))
      : null
  })
  return {
    ...scores,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '',
  }
}

async function demoMode() {
  const records = []
  const lenses = ['relationship', 'inner', 'action']
  for (const [index, testCase] of CASES.entries()) {
    const cards = drawnCards(testCase)
    const opening = demo.demoOpening(testCase.question, cards)
    records.push({
      model: '本心模式',
      caseId: testCase.id,
      theme: testCase.theme,
      question: testCase.question,
      kind: 'opening',
      text: opening,
      metrics: measure(opening, testCase, 'opening'),
    })
    const reply = demo.demoReply(testCase.question, cards, [
      { role: 'assistant', content: opening, at: Date.now() },
      { role: 'user', content: testCase.followUp, at: Date.now() },
    ])
    records.push({
      model: '本心模式',
      caseId: testCase.id,
      theme: testCase.theme,
      question: testCase.question,
      kind: 'reply',
      followUp: testCase.followUp,
      text: reply,
      metrics: measure(reply, testCase, 'reply', opening, testCase.followUp),
    })
    const lens = lenses[index % lenses.length]
    const secondFollowUp = '我还是有点不确定，能再换一个角度吗？'
    const lensReply = demo.demoReply(
      testCase.question,
      cards,
      [
        { role: 'assistant', content: opening, at: Date.now() },
        { role: 'user', content: testCase.followUp, at: Date.now() },
        { role: 'assistant', content: reply, at: Date.now() },
        { role: 'user', content: secondFollowUp, at: Date.now() },
      ],
      lens,
    )
    records.push({
      model: '本心模式',
      caseId: testCase.id,
      theme: testCase.theme,
      question: testCase.question,
      kind: 'reply-lens',
      followUp: secondFollowUp,
      lens,
      text: lensReply,
      metrics: measure(lensReply, testCase, 'reply', reply, secondFollowUp),
    })
  }
  await fs.mkdir(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, 'demo-baseline.json')
  await fs.writeFile(
    file,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        promptVersion: llm.READING_PROMPT_VERSION,
        summary: summarize(records),
        records,
      },
      null,
      2,
    ),
  )
  for (const record of records) {
    await fs.writeFile(
      path.join(OUT_DIR, `demo-${record.caseId}-${record.kind}.txt`),
      record.text,
      'utf8',
    )
  }
  console.log(JSON.stringify({ mode: 'demo', file, summary: summarize(records) }, null, 2))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function retryable(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /没有返回内容|中断|超时|请求太频繁|返回错误（5\d\d）/.test(message)
}

function looksTruncated(text) {
  const clean = String(text ?? '').trim()
  return clean.length > 0 && !/[。！？!?…”』」]$/.test(clean)
}

async function withRetry(task) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt === 0 && retryable(error)) {
        await sleep(1200)
        continue
      }
      throw error
    }
  }
  throw lastError
}

async function liveMode() {
  if (!KEY) {
    console.error(
      '缺少 EVAL_KEY。真实基线需要本地网关 Key；未设置时只跑 recordings 基线。',
    )
    await recordingsMode()
    return
  }
  const jobs = []
  for (const model of MODELS) {
    for (const testCase of CASES) {
      jobs.push({ model, testCase })
    }
  }
  const records = []
  const errors = []
  await pool(jobs, CONCURRENCY, async ({ model, testCase }) => {
    const settings = settingsFor(model)
    const cards = drawnCards(testCase)
    const started = Date.now()
    try {
      const opening = await withRetry(async () => {
        const value = await llm.requestOpening(
          settings,
          testCase.question,
          cards,
        )
        if (looksTruncated(value)) {
          const retry = await llm.requestOpening(
            settings,
            testCase.question,
            cards,
          )
          return retry
        }
        return value
      })
      const openingMs = Date.now() - started
      records.push({
        model,
        caseId: testCase.id,
        theme: testCase.theme,
        question: testCase.question,
        kind: 'opening',
        latencyMs: openingMs,
        previous: '',
        text: opening,
        metrics: measure(opening, testCase, 'opening'),
      })
      const replyStarted = Date.now()
      const reply = await withRetry(async () => {
        const value = await llm.requestReply(
          settings,
          testCase.question,
          cards,
          [
            { role: 'assistant', content: opening, at: Date.now() },
            { role: 'user', content: testCase.followUp, at: Date.now() },
          ],
        )
        if (looksTruncated(value)) {
          return llm.requestReply(settings, testCase.question, cards, [
            { role: 'assistant', content: opening, at: Date.now() },
            { role: 'user', content: testCase.followUp, at: Date.now() },
          ])
        }
        return value
      })
      records.push({
        model,
        caseId: testCase.id,
        theme: testCase.theme,
        question: testCase.question,
        kind: 'reply',
        followUp: testCase.followUp,
        latencyMs: Date.now() - replyStarted,
        previous: opening,
        text: reply,
        metrics: measure(reply, testCase, 'reply', opening, testCase.followUp),
      })
      process.stdout.write('.')
    } catch (error) {
      errors.push({
        model,
        caseId: testCase.id,
        message: error instanceof Error ? error.message : String(error),
      })
      process.stdout.write('x')
    }
  })
  process.stdout.write('\n')

  let judgeSummary = null
  if (process.env.EVAL_JUDGE === '1' && records.length > 0) {
    const judgeModel = process.env.EVAL_JUDGE_MODEL ?? MODELS[0]
    await pool(records, CONCURRENCY, async (record) => {
      const testCase = CASES.find(
        (item) => item.id === record.caseId,
      )
      if (!testCase) return
      try {
        record.judge = await judgeRecord(record, testCase, judgeModel)
      } catch {
        try {
          await sleep(700)
          record.judge = await judgeRecord(record, testCase, judgeModel)
        } catch (retryError) {
          record.judgeError =
            retryError instanceof Error
              ? retryError.message
              : String(retryError)
        }
      }
    })
    const fields = [
      'capture',
      'cardEvidence',
      'plurality',
      'progression',
      'landing',
      'restraint',
      'overall',
    ]
    const groups = new Map()
    for (const record of records) {
      if (!record.judge) continue
      const key = `${record.model} · ${record.kind}`
      const list = groups.get(key) ?? []
      list.push(record.judge)
      groups.set(key, list)
    }
    judgeSummary = [...groups.entries()].map(([key, list]) => ({
      key,
      samples: list.length,
      ...Object.fromEntries(
        fields.map((field) => [
          field,
          mean(
            list
              .map((item) => item[field])
              .filter((value) => value != null),
          ),
        ]),
      ),
    }))
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await fs.mkdir(OUT_DIR, { recursive: true })
  const payload = {
    generatedAt: new Date().toISOString(),
    promptVersion: llm.READING_PROMPT_VERSION,
    base: BASE,
    models: MODELS,
    summary: summarize(records),
    judgeSummary,
    judgeModel:
      process.env.EVAL_JUDGE === '1'
        ? process.env.EVAL_JUDGE_MODEL ?? MODELS[0]
        : null,
    errors,
    records,
  }
  const file = path.join(OUT_DIR, `eval-${stamp}.json`)
  await fs.writeFile(file, JSON.stringify(payload, null, 2))
  for (const record of records) {
    const name = `${record.model}-${record.caseId}-${record.kind}.txt`
    await fs.writeFile(path.join(OUT_DIR, name), record.text, 'utf8')
  }
  console.log(
    JSON.stringify(
      {
        mode: 'live',
        file,
        promptVersion: llm.READING_PROMPT_VERSION,
        summary: payload.summary,
        errors,
      },
      null,
      2,
    ),
  )
}

if (process.argv.includes('--recordings')) {
  await recordingsMode()
} else if (process.argv.includes('--demo')) {
  await demoMode()
} else {
  await liveMode()
}
