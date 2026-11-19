import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const POSITIONS = ['situation', 'blindspot', 'action']
const QUESTIONS = [
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

const TASK_QUESTIONS = [
  '帮我推荐一部电影。',
  '帮我写一份周报。',
  '我家路由器总是断网怎么办？',
  '明天会下雨吗？',
]

const CRISIS_QUESTION = '我不想活了，觉得撑不下去。'
const CRISIS_PHRASES = [
  '我真的不想活了。',
  '我想去死。',
  '我想结束自己的生命。',
  '我写了遗书，准备离开这个世界。',
  '我刚刚割腕了。',
  '我吃了很多安眠药。',
  '活着好累，一了百了。',
  '我不想再醒来。',
  '我觉得生无可恋。',
]
const NON_CRISIS_PHRASES = [
  '我想死你了，最近好吗？',
  '笑死我了。',
  '今天累死了。',
  '这个项目烦死了。',
  '我想死磕这个项目。',
  '我想结束这段让我内耗的关系。',
]
const HARM_PHRASES = [
  '我要杀人。',
  '我想杀了他。',
  '我想弄死那个同事。',
  '我准备去学校开枪。',
  '我想拿刀捅他。',
  '我要让他死。',
  '我想杀了他，然后自杀。',
  '我想打他一顿。',
]
const SEXUAL_HARM_PHRASES = ['我想强奸她。', '我要猥亵她。']
const SEXUAL_ASSAULT_PHRASES = ['我被强奸了。', '我被性侵了。']
const NON_HARM_PHRASES = [
  '我想杀价。',
  '我要杀毒。',
  '我想玩杀人游戏。',
  '这个电影里的杀人案好可怕。',
  '我快被他气死了。',
  '他杀了她。',
  '我想打他电话。',
]
const DANGER_PHRASES = [
  '他要杀我。',
  '有人拿刀朝我冲过来。',
  '我被家暴了。',
  '他一直在跟踪我。',
  '我被他打了。',
]

const outdir = await mkdtemp(join(tmpdir(), 'tarot-coverage-'))
let exitCode = 0

try {
  await build({
    entryPoints: [
      'src/lib/demo.ts',
      'src/lib/draw.ts',
      'src/lib/crisis.ts',
      'src/data/safety-copy.ts',
      'src/data/tarot.ts',
      'src/lib/storage.ts',
      'src/lib/revisits.ts',
      'src/lib/backup.ts',
      'src/lib/reading.ts',
      'src/lib/llm.ts',
    ],
    bundle: true,
    format: 'esm',
    define: { 'import.meta.env': '{}' },
    outdir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  })

  const demo = await import(pathToFileURL(join(outdir, 'lib', 'demo.mjs')).href)
  const crisis = await import(pathToFileURL(join(outdir, 'lib', 'crisis.mjs')).href)
  const safety = await import(pathToFileURL(join(outdir, 'data', 'safety-copy.mjs')).href)
  const draw = await import(pathToFileURL(join(outdir, 'lib', 'draw.mjs')).href)
  const tarot = await import(pathToFileURL(join(outdir, 'data', 'tarot.mjs')).href)
  const storage = await import(pathToFileURL(join(outdir, 'lib', 'storage.mjs')).href)
  const revisits = await import(pathToFileURL(join(outdir, 'lib', 'revisits.mjs')).href)
  const backup = await import(pathToFileURL(join(outdir, 'lib', 'backup.mjs')).href)
  const reading = await import(pathToFileURL(join(outdir, 'lib', 'reading.mjs')).href)
  const llm = await import(pathToFileURL(join(outdir, 'lib', 'llm.mjs')).href)
  const cards = (index) => {
    const ids = [[0, 17, 13], [2, 11, 7], [9, 15, 19]][index % 3]
    return ids.map((id, position) => ({
      card: tarot.MAJOR_ARCANA.find((card) => card.id === id),
      orientation: position === 1 ? 'reversed' : 'upright',
      position: POSITIONS[position],
    }))
  }

  const failures = []
  let themed = 0

  QUESTIONS.forEach((question, index) => {
    const spread = cards(index)
    const opening = demo.demoOpening(question, spread)
    const history = [
      { role: 'assistant', content: opening, at: 1 },
      { role: 'user', content: '我最近确实一直在想这件事。', at: 2 },
    ]
    const reply = demo.demoReply(question, spread, history)
    const lensReply = demo.demoReply(question, spread, history, 'inner')
    const insight = demo.demoInsight(question, spread, history)
    const suggestions = demo.demoSuggestions(question)
    const all = [opening, reply, JSON.stringify(insight)].join('\n')
    const theme = demo.classifyTheme(question)
    const openingCardNames = spread.filter((card) =>
      opening.includes(`《${card.card.name}》`),
    ).length

    if (all.includes('undefined')) failures.push(`${question}：包含 undefined`)
    if (all.includes('。；')) failures.push(`${question}：出现“。；”拼接`)
    if (!opening.includes('你问的是「')) failures.push(`${question}：缺少问题引用`)
    if (!opening.includes('？')) failures.push(`${question}：开场没有提问`)
    const openingParagraphs = opening.split('\n\n').length
    if (openingParagraphs < 3 || openingParagraphs > 4) {
      failures.push(`${question}：开场应分成 3-4 段`)
    }
    if (theme.key !== 'grief' && (openingCardNames < 1 || openingCardNames > 2)) {
      failures.push(`${question}：开场应只取 1-2 张牌作证据`)
    }
    if (
      theme.key !== 'grief' &&
      !/(反过来看|另一面|反读一下)/.test(opening)
    ) {
      failures.push(`${question}：开场缺少反读法`)
    }
    if (!reply.includes('？')) failures.push(`${question}：回应没有提问`)
    const replyParagraphs = reply.split('\n\n').length
    if (replyParagraphs < 3 || replyParagraphs > 4) {
      failures.push(`${question}：回应应分成 3-4 段`)
    }
    if (
      theme.key !== 'grief' &&
      !/(反过来看|另一面|反读一下)/.test(reply)
    ) {
      failures.push(`${question}：回应缺少反读法`)
    }
    if (
      theme.key !== 'grief' &&
      (lensReply === reply || !lensReply.includes('这次换一个角度'))
    ) {
      failures.push(`${question}：换一种读法没有生成新回答`)
    }
    if (reply.length < 80) failures.push(`${question}：回应内容过短`)
    if (!insight.title || !insight.mirror || !insight.invitation) {
      failures.push(`${question}：自省记录字段为空`)
    }
    if (suggestions.length !== 3) failures.push(`${question}：建议数量不是 3`)
    if (insight.keywords[0] !== '此刻') themed += 1
  })

  TASK_QUESTIONS.forEach((question) => {
    const opening = demo.demoOpening(question, cards(0))
    const reply = demo.demoReply(question, cards(0), [])
    const insight = demo.demoInsight(question, cards(0), [])
    if (!opening.includes('月鉴')) failures.push(`${question}：没有跑偏引导`)
    if (!reply.includes('？')) failures.push(`${question}：跑偏回应没有提问`)
    if (!insight.title) failures.push(`${question}：跑偏记录没有标题`)
  })

  const crisisOpening = demo.demoOpening(CRISIS_QUESTION, cards(0))
  const crisisInsight = demo.demoInsight(CRISIS_QUESTION, cards(0), [])
  if (!crisisOpening.includes('安全')) failures.push('危机语句：缺少安全引导')
  if (!crisisOpening.includes('110') || !crisisOpening.includes('120')) {
    failures.push('危机语句：缺少报警与急救电话')
  }
  if (!crisisInsight.keywords.includes('安全')) failures.push('危机记录：缺少安全关键词')
  if (crisisInsight.crisis !== true) failures.push('危机记录：缺少 crisis 标记')

  CRISIS_PHRASES.forEach((text) => {
    const kind = crisis.detectSafetyConcern(text)
    if (kind !== 'self') {
      failures.push(`自伤语句未识别：${text} -> ${kind}`)
      return
    }
    const opening = demo.demoOpening(text, cards(0))
    if (!opening.includes('110') || !opening.includes('120')) {
      failures.push(`危机引导缺少电话：${text}`)
    }
  })
  NON_CRISIS_PHRASES.forEach((text) => {
    if (crisis.isCrisisText(text)) failures.push(`普通语句被误判为危机：${text}`)
  })

  const checkSafetyCategory = (phrases, allowedKinds, label) => {
    phrases.forEach((text) => {
      const kind = crisis.detectSafetyConcern(text)
      if (!allowedKinds.includes(kind)) {
        failures.push(`${label}未识别：${text} -> ${kind}`)
        return
      }
      const opening = demo.demoOpening(text, cards(0))
      if (!opening.includes('110') || !opening.includes('120')) {
        failures.push(`${label}引导缺少电话：${text}`)
      }
      const history = [
        { role: 'assistant', content: '我在听。', at: 1 },
        { role: 'user', content: text, at: 2 },
      ]
      const reply = demo.demoReply(text, cards(0), history)
      if (!reply.includes('110') && !reply.includes('120')) {
        failures.push(`${label}回应缺少安全引导：${text}`)
      }
      const insight = demo.demoInsight(text, cards(0), history)
      if (!insight.crisis) {
        failures.push(`${label}记录未进入安全状态：${text}`)
      }
      if (demo.demoSuggestions(text).length !== 3) {
        failures.push(`${label}建议数量不是 3：${text}`)
      }
    })
  }

  checkSafetyCategory(HARM_PHRASES, ['harm-others', 'both'], '他伤语句')
  checkSafetyCategory(SEXUAL_HARM_PHRASES, ['sexual-harm'], '性暴力意图')
  checkSafetyCategory(SEXUAL_ASSAULT_PHRASES, ['sexual-assault'], '性侵受害语句')
  checkSafetyCategory(DANGER_PHRASES, ['threat'], '受威胁语句')

  Object.entries(safety.SAFETY_COPY).forEach(([kind, content]) => {
    if (content.comforts.length < 2) {
      failures.push(`安全分类 ${kind} 的安慰文案少于 2 条`)
    }
    if (content.steps.length === 0) {
      failures.push(`安全分类 ${kind} 缺少行动步骤`)
    }
  })
  NON_HARM_PHRASES.forEach((text) => {
    if (crisis.detectSafetyConcern(text)) {
      failures.push(`普通暴力词被误判为危机：${text}`)
    }
  })

  const CRISIS_FOLLOWUPS = [
    '有时候觉得活着没意思，不想活了。',
    '我真的不想活了。',
    '我觉得活着没有意义。',
  ]
  CRISIS_FOLLOWUPS.forEach((crisisText) => {
    const benignQuestion = '我最近因为工作上的去留很焦虑，该怎么办？'
    const spread = cards(0)
    const opening = demo.demoOpening(benignQuestion, spread)
    const history = [
      { role: 'assistant', content: opening, at: 1 },
      { role: 'user', content: crisisText, at: 2 },
    ]
    const safeReply = demo.demoReply(benignQuestion, spread, history)
    const safeInsight = demo.demoInsight(benignQuestion, spread, history)
    const entry = {
      id: 'crisis-followup',
      createdAt: Date.now(),
      question: benignQuestion,
      cards: spread,
      messages: history,
      insight: safeInsight,
    }
    const safeRevisit = demo.demoRevisit(entry, '我还在想这件事。')
    if (!safeReply.includes('安全') && !safeReply.includes('支持')) {
      failures.push(`危机追问「${crisisText}」：回应未进入安全引导`)
    }
    if (!safeInsight.keywords.includes('安全')) {
      failures.push(`危机追问「${crisisText}」：自省记录未进入安全引导`)
    }
    if (safeInsight.crisis !== true) {
      failures.push(`危机追问「${crisisText}」：自省记录缺少 crisis 标记`)
    }
    if (!safeRevisit.includes('安全') && !safeRevisit.includes('援助')) {
      failures.push(`危机追问「${crisisText}」：回访未进入安全引导`)
    }
  })

  const safeEcho = safety.safetyRevisit(
    'self',
    '我今天又听见了那句话：「先照顾你自己」。',
  )
  if (!safeEcho.includes('你这次写道：我今天又听见了那句话：「先照顾你自己」。')) {
    failures.push(`安全回访没有原样引用：${safeEcho}`)
  }
  if (safeEcho.includes('写到「')) {
    failures.push('安全回访仍用外层引号包裹回答')
  }

  const store = new Map()
  let rejectImages = true
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      if (rejectImages && String(value).includes('data:image')) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  const snapshotPayload = {
    question: '存储降级测试',
    cards: cards(0),
    messages: [],
    input: '',
    phase: 'insight',
    insight: null,
    savedEntry: {
      id: 'storage-fallback',
      snapshot: 'data:image/png;base64,AAAA',
    },
  }
  storage.saveReadingSnapshot(snapshotPayload)
  const fallbackRaw = localStorage.getItem('lunar-mirror.reading')
  if (!fallbackRaw) {
    failures.push('图片超出配额后没有写入纯文本快照')
  } else {
    const fallback = JSON.parse(fallbackRaw)
    if (!fallback.savedEntry || fallback.savedEntry.id !== 'storage-fallback') {
      failures.push('纯文本快照丢失了记录主体')
    }
    if (fallback.savedEntry.snapshot !== undefined) {
      failures.push('纯文本快照仍包含 dataURL')
    }
    if (fallback.question !== '存储降级测试' || fallback.version !== 1) {
      failures.push('纯文本快照字段不完整')
    }
  }
  rejectImages = false
  storage.saveReadingSnapshot(snapshotPayload)
  const fullRaw = localStorage.getItem('lunar-mirror.reading')
  const full = fullRaw ? JSON.parse(fullRaw) : null
  if (!full || full.savedEntry?.snapshot !== 'data:image/png;base64,AAAA') {
    failures.push('配额充足时图片快照没有保留')
  }

  const now = Date.now()
  const revisitEntry = (id, days, crisis = false, lastRevisitDays = null) => ({
    id,
    createdAt: now - days * 86400000,
    question: `${id} 的问题`,
    cards: cards(0),
    messages: [],
    insight: {
      title: id,
      mirror: '',
      pattern: '',
      invitation: '',
      keywords: [],
      crisis,
    },
    revisits:
      lastRevisitDays === null
        ? []
        : [{ at: now - lastRevisitDays * 86400000, answer: '回访', note: '备注' }],
  })
  const due = revisits.dueRevisits(
    [
      revisitEntry('due-8', 8),
      revisitEntry('due-35', 35),
      revisitEntry('not-yet', 6),
      revisitEntry('crisis', 40, true),
      revisitEntry('revisited', 20, false, 2),
    ],
    now,
  )
  if (due.length !== 2 || due[0].entry.id !== 'due-35') {
    failures.push(`回访提醒排序或过滤不正确：${due.map((item) => item.entry.id).join(',')}`)
  }
  if (due.some((item) => item.entry.id === 'crisis')) {
    failures.push('危机记录不应进入回访提醒')
  }
  if (due[0]?.days !== 35 || due[0]?.level !== 'long') {
    failures.push('30 天以上的回访提醒没有标记为久放')
  }

  const backupEntry = {
    id: 'backup-valid',
    createdAt: now - 3 * 86400000,
    question: '备份恢复测试',
    cards: cards(0),
    messages: [{ role: 'assistant', content: '一段回应', at: now }],
    insight: {
      title: '备份里的镜子',
      mirror: '也许这只是一次测试。',
      pattern: '反复检查边界。',
      invitation: '先恢复一条记录。',
      keywords: ['备份', '恢复'],
      crisis: true,
    },
    revisits: [{ at: now - 86400000, answer: '回访内容', note: '回访回应' }],
  }
  const parsedBackup = backup.parseBackup(JSON.stringify([backupEntry]))
  if (
    parsedBackup.entries.length !== 1 ||
    parsedBackup.entries[0].insight.crisis !== true ||
    parsedBackup.entries[0].revisits?.[0].answer !== '回访内容'
  ) {
    failures.push('备份解析没有保留危机标记或回访')
  }
  const mixedBackup = backup.parseBackup(
    JSON.stringify({
      entries: [
        backupEntry,
        { id: 'broken-entry' },
        { ...backupEntry, snapshot: `data:image/png;base64,${'A'.repeat(2100000)}` },
      ],
    }),
  )
  if (mixedBackup.entries.length !== 1 || mixedBackup.skipped !== 2) {
    failures.push('备份解析没有跳过损坏记录或重复 id')
  }
  if (
    mixedBackup.snapshotsDropped !== 1 ||
    mixedBackup.entries[0].snapshot !== undefined
  ) {
    failures.push('备份解析没有丢弃超大快照')
  }
  let invalidRejected = false
  try {
    backup.parseBackup('{ not json }')
  } catch {
    invalidRejected = true
  }
  if (!invalidRejected) failures.push('无效备份没有被拒绝')

  const longReading =
    '这句话先不急着解释。它可能同时装着两层意思。也许你怕的不是选择本身，而是选择之后要承担的想象。也可以反过来看，这份犹豫在保护你。牌面里的画面像一扇半开的门。先看看门后有什么。'
  const shapedReply = reading.shapeReading(longReading.repeat(4), 'reply')
  const shapedOpening = reading.shapeReading(longReading.repeat(6), 'opening')
  if (shapedReply.split('\n\n').length < 2) {
    failures.push('长段回答没有被分成多段')
  }
  if (shapedOpening.split('\n\n').length !== 3) {
    failures.push('长开场没有被分成三段')
  }
  if (shapedReply.replace(/\n/g, '') !== longReading.repeat(4)) {
    failures.push('自动分段改动了原文')
  }
  const alreadyShaped = '第一段。\n\n第二段。'
  if (reading.shapeReading(alreadyShaped, 'reply') !== alreadyShaped) {
    failures.push('已有分段的回答被重复改写')
  }
  if (reading.shapeReading('短句。', 'reply') !== '短句。') {
    failures.push('短回答被错误分段')
  }
  const manyParagraphs = ['一。', '二。', '三。', '四。', '五。', '六。'].join(
    '\n\n',
  )
  if (reading.shapeReading(manyParagraphs, 'opening') !== manyParagraphs) {
    failures.push('已有分段超过四段时被截断')
  }

  const spreadContext = llm.buildCardContext(cards(0))
  if (
    !spreadContext.includes('牌阵结构：') ||
    spreadContext.includes('undefined')
  ) {
    failures.push('牌阵结构上下文缺失或包含 undefined')
  }

  if (tarot.ALL_CARDS.length !== 78) {
    failures.push(`牌库应为 78 张，当前 ${tarot.ALL_CARDS.length} 张`)
  }
  if (tarot.MINOR_ARCANA.length !== 56) {
    failures.push(`小阿卡纳应为 56 张，当前 ${tarot.MINOR_ARCANA.length} 张`)
  }
  if (new Set(tarot.ALL_CARDS.map((card) => card.id)).size !== 78) {
    failures.push('牌库存在重复 id')
  }
  let sawUpright = false
  let sawReversed = false
  let sawMinor = false
  for (let round = 0; round < 300; round += 1) {
    const pile = draw.buildChoicePile(9)
    if (pile.length !== 9) failures.push('抽牌堆数量不为 9')
    if (new Set(pile.map((item) => item.card.id)).size !== 9) {
      failures.push('同一牌堆出现重复牌')
    }
    pile.forEach((item) => {
      if (item.orientation === 'upright') sawUpright = true
      if (item.orientation === 'reversed') sawReversed = true
      if (item.card.id >= 22) sawMinor = true
    })
  }
  if (!sawUpright || !sawReversed) failures.push('抽牌没有同时出现正位与逆位')
  if (!sawMinor) failures.push('抽牌从未抽到小阿卡纳')

  const coverage = themed / QUESTIONS.length
  console.log(`本心模式覆盖测试：${themed}/${QUESTIONS.length} 命中具体主题（${Math.round(coverage * 100)}%）`)
  console.log(
    `跑偏请求：${TASK_QUESTIONS.length} 条，自伤语句：${CRISIS_PHRASES.length + 1} 条，他伤语句：${HARM_PHRASES.length} 条，性暴力意图：${SEXUAL_HARM_PHRASES.length} 条，性侵受害：${SEXUAL_ASSAULT_PHRASES.length} 条，受威胁：${DANGER_PHRASES.length} 条，追问 ${CRISIS_FOLLOWUPS.length} 条，误判检查：${NON_CRISIS_PHRASES.length + NON_HARM_PHRASES.length} 条，分类文案：${Object.keys(safety.SAFETY_COPY).length} 类`,
  )
  console.log(`牌库测试：78 张（22 大 + 56 小），正逆位均出现，300 轮无重复牌`)
  if (failures.length > 0) {
    console.error('失败项：')
    failures.forEach((failure) => console.error(`- ${failure}`))
    exitCode = 1
  } else if (coverage < 0.8) {
    console.error('主题覆盖率低于 80%')
    exitCode = 1
  } else {
    console.log('全部通过')
  }
} finally {
  await rm(outdir, { recursive: true, force: true })
}

process.exitCode = exitCode
