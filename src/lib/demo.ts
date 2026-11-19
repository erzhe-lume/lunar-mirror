import type {
  ChatMessage,
  DrawnCard,
  Insight,
  JournalEntry,
  ThemeKey,
} from '../types'
import {
  EXTRA_AUTHORITY_LINES,
  EXTRA_COUNTER_VOICES,
  EXTRA_ECHO_OPENERS,
  EXTRA_GENERIC_SUGGESTIONS,
  EXTRA_INSIGHT_COUNTERS,
  EXTRA_REPLY_METAS,
  EXTRA_STAGE_PROMPTS,
  THEME_CORPUS,
} from '../data/reflection-corpus'
import { detectSafetyConcern, type SafetyKind } from './crisis'
import { READING_LENSES, type ReadingLens } from './lenses'
import {
  safetyInsight,
  safetyOpening,
  safetyReply,
  safetySuggestions,
  safetyRevisit,
} from '../data/safety-copy'

type FrameKey = 'decision' | 'prediction' | 'advice' | 'understanding' | 'general'

interface Theme {
  key: ThemeKey
  label: string
  lens: string
  core: string
  titleWord: string
  practice: string
  patternLine: string
  prompts: string[]
}

interface Tone {
  key: string
  line: string
  replyLine: string
}

interface Frame {
  key: FrameKey
  name: string
  line: string
}

interface Analysis {
  theme: Theme
  tone: Tone | null
  frame: Frame
}

const THEME_RULES: { key: Exclude<ThemeKey, 'other'>; words: string[] }[] = [
  {
    key: 'work',
    words: [
      '工作', '离职', '辞职', '跳槽', '团队', '老板', '领导', '同事', '事业',
      '加班', '项目', '公司', '创业', '失业', '升职', '职业', '上班', '实习',
      '转正', '裁员', 'offer', 'Offer', '职场', '涨薪', '汇报', 'KPI', 'kpi',
      '绩效', '面试', '转行',
    ],
  },
  {
    key: 'study',
    words: [
      '学习', '考试', '考研', '考公', '备考', '论文', '毕业', '留学', '成绩',
      '复习', '上课', '专业', '证书', '补考', '期末', '高考', '中考', '作业',
      '雅思', '托福', '保研', '博士', '硕士', '绩点', '录取', '编程', '代码',
      '程序员', '转码',
    ],
  },
  {
    key: 'grief',
    words: [
      '离世', '去世', '过世', '葬礼', '哀悼', '思念', '病逝', '离我而去',
      '失去亲人', '失去至亲', '失去他', '失去她', '纪念', '丧亲',
    ],
  },
  {
    key: 'family',
    words: [
      '家人', '父母', '父亲', '母亲', '爸爸', '妈妈', '孩子', '亲子', '婆婆',
      '公公', '亲戚', '家庭', '原生家庭', '养老', '哥哥', '姐姐', '弟弟',
      '妹妹', '亲人', '育儿', '寄宿', '坐月子', '外公', '外婆', '爷爷', '奶奶',
    ],
  },
  {
    key: 'relation',
    words: [
      '关系', '感情', '恋爱', '伴侣', '喜欢', '分手', '婚姻', '男朋友',
      '女朋友', '男友', '女友', '老公', '老婆', '丈夫', '妻子', '对象',
      '前任', '暗恋', '网恋', '相亲', '约会', '对的人', '暧昧', '亲密',
      '表白', '出轨', '异地', '结婚', '离婚', '相处',
    ],
  },
  {
    key: 'social',
    words: [
      '朋友', '室友', '社交', '合群', '聚会', '人际', '圈子', '排挤',
      '孤立', '闹翻', '道歉', '边界', '人缘', '同学', '邻居', '群聊',
      '同事关系', '拉黑', '误会', '被讨厌', '讨好', '友情', '好友',
      '老友', '发小', '闺蜜', '答应', '人情',
    ],
  },
  {
    key: 'money',
    words: [
      '钱', '收入', '存款', '工资', '投资', '理财', '买房', '房贷', '贷款',
      '债务', '预算', '消费', '花钱', '价格', '太贵', '很贵', '好贵', '贵吗',
      '便宜', '亏损', '基金', '股票', '薪水', '涨薪', '攒钱', '月光',
      '负债', '彩票', '奖金', '卖房', '买', '购买',
    ],
  },
  {
    key: 'health',
    words: [
      '健康', '身体', '睡眠', '失眠', '睡不着', '生病', '医院', '医生',
      '药', '运动', '减肥', '饮食', '很累', '太累', '好累', '疲惫', '头疼',
      '胃', '体检', '作息', '精力', '虚弱', '恢复', '焦虑症', '抑郁',
      '慢性', '疼',
    ],
  },
  {
    key: 'pet',
    words: [
      '猫', '狗', '宠物', '铲屎官', '喵', '汪', '兽医', '毛孩子', '兔子',
      '仓鼠', '宠物医院', '小猫', '小狗', '养宠',
    ],
  },
  {
    key: 'creation',
    words: [
      '写作', '画画', '音乐', '视频', '作品', '灵感', '创作', '副业',
      '自媒体', '博客', '播客', '摄影', '设计', '小说', '乐器', '吉他',
      '钢琴', '手作', '拍片', '账号', '编剧', '导演', '自由职业',
    ],
  },
  {
    key: 'dream',
    words: ['梦到', '做梦', '梦境', '梦见'],
  },
  {
    key: 'spiritual',
    words: [
      '命运', '前世', '缘分', '宇宙', '水逆', '星象', '灵性', '灵魂',
      '意义', '人生', '活着', '信仰', '轮回', '塔罗', '占卜', '显化',
      '能量', '因果', '潜意识', '宿命', '命盘', '星座',
    ],
  },
  {
    key: 'life',
    words: [
      '搬家', '搬去', '城市', '出国', '旅行', '旅游', '定居', '生活',
      '环境', '节奏', '换城市', '回乡', '北漂', '沪漂', '租房', '住处',
      '远方', '移民', '换一种活法', '换个活法', '活法', '日常',
    ],
  },
  {
    key: 'decision',
    words: [
      '该不该', '要不要', '选择', '决定', '犹豫', '两难', '机会', '放弃',
      '留下', '离开', '还是', '取舍', '继续', '值不值得', '赌', '冒险',
      '换工作', '转行', '挑明', '摊牌',
    ],
  },
  {
    key: 'self',
    words: [
      '自己', '自我', '焦虑', '害怕', '迷茫', '价值', '情绪', '内耗',
      '自信', '孤独', '方向', '我是谁', '疲惫', '不够好', '自卑', '拖延',
      '动力', '目标', '习惯', '空虚', '安全感', '敏感', '完美主义',
      '讨好型', '讨好', '崩溃', '低落', '提不起兴趣', '麻木', '没意思', '想哭',
    ],
  },
]

const THEMES: Record<ThemeKey, Theme> = {
  work: {
    key: 'work',
    label: '工作与去留',
    lens: '工作里的事，往往不只在问去留，也在问你把什么当成安全感。',
    core: '你愿意为想要的生活承担多少不确定',
    titleWord: '去留',
    practice: '也可以花十分钟写一份“如果离开”的事实清单，只写事实，不写恐惧。',
    patternLine: '于是相似的犹豫一次次回来，去留被拖成了一种消耗。',
    prompts: [
      '如果没有人会评价你的选择，你会先去试哪一件小事？',
      '你现在的“留下”，有多少是安全感，有多少是不甘心？',
    ],
  },
  study: {
    key: 'study',
    label: '学习与考试',
    lens: '分数和结果看起来在评判能力，底下常常是你如何对待自己。',
    core: '你愿意按自己的节奏努力，而不只用结果衡量自己',
    titleWord: '学业',
    practice: '或者把任务拆成一个二十五分钟的小块，只完成这一块。',
    patternLine: '于是相似的紧张一次次回来，学习被拖成了自我审判。',
    prompts: [
      '如果分数不是评判，你最想学明白的是什么？',
      '你现在的努力，有多少是为了自己？',
    ],
  },
  grief: {
    key: 'grief',
    label: '失去与思念',
    lens: '失去没有标准答案，牌面也不能替你减轻思念；我们可以先陪你把这份想念说清楚。',
    core: '你如何带着这份想念继续生活',
    titleWord: '思念',
    practice: '或者写下你最想对那个人说的一句话，不必给任何人看。',
    patternLine: '于是相似的想念一次次回来，它不需要被解决。',
    prompts: [
      '如果对方能听见，你最想告诉对方什么？',
      '这份失去改变你生活里的哪一部分？',
    ],
  },
  family: {
    key: 'family',
    label: '家庭与亲情',
    lens: '家人的事很难像朋友那样说断就断，爱与边界常常缠在一起。',
    core: '你想守护这段关系里的什么，又不想再牺牲哪一部分自己',
    titleWord: '亲情',
    practice: '或者写下一句你一直没说出口的需要，先不发送。',
    patternLine: '于是相似的委屈一次次回来，亲近变成了消耗。',
    prompts: [
      '如果没有“应该”的压力，你会怎么表达自己？',
      '你希望家人看见你的哪一面？',
    ],
  },
  relation: {
    key: 'relation',
    label: '关系与靠近',
    lens: '关系里的拉扯，常常不只是在问对方做了什么，也在问你想被怎样看见。',
    core: '你想被怎样看见，又愿意怎样看见对方',
    titleWord: '靠近',
    practice: '或者在一次对话里，把“没关系”换成你真实的那半句话。',
    patternLine: '于是相似的退让一次次回来，需要被留在了对话之外。',
    prompts: [
      '在这段关系里，你最不敢说出口的那句话是什么？',
      '如果对方只能记住你的一个需要，你希望是哪一个？',
    ],
  },
  social: {
    key: 'social',
    label: '人际与边界',
    lens: '人际里的不舒服，往往不只是“谁对谁错”，也在提醒你的边界在哪里。',
    core: '你想被怎样对待，又愿意怎样表达',
    titleWord: '人际',
    practice: '或者在下一次不舒服时，先说出事实，再说感受。',
    patternLine: '于是相似的忍让一次次回来，关系里的距离被拉得更远。',
    prompts: [
      '如果不用维持表面的和气，你最想对谁说什么？',
      '你在这段关系里，最常忽略自己的哪个信号？',
    ],
  },
  money: {
    key: 'money',
    label: '金钱与消费',
    lens: '钱的问题很少只是数字，它也在问你愿意为什么承担风险、什么让你感到安全。',
    core: '你真正想买到的，是物品，还是一种确定感',
    titleWord: '金钱',
    practice: '或者把这次支出写成“需要 / 想要 / 害怕错过”三栏。',
    patternLine: '于是相似的焦虑一次次回来，金钱变成了安全感的替代品。',
    prompts: [
      '如果这笔钱不会影响你的安全感，你会怎么选？',
      '你更怕损失钱，还是损失一个机会？',
    ],
  },
  health: {
    key: 'health',
    label: '身体与作息',
    lens: '身体常常比语言更早知道答案，睡眠、食欲和疲惫都是它写给你的信。',
    core: '你愿不愿意先照顾身体的感受，而不是继续硬撑',
    titleWord: '身体',
    practice: '涉及身体的决定，请优先咨询医生；牌面只能陪你整理感受。',
    patternLine: '于是相似的不适一次次回来，疲惫被当成了理所当然。',
    prompts: [
      '如果身体可以开口，它最想让你停下来做什么？',
      '你最近一次真正休息，是什么时候？',
    ],
  },
  pet: {
    key: 'pet',
    label: '宠物与陪伴',
    lens: '宠物不会用语言解释，但你们之间的照料与牵挂很真实。',
    core: '你如何在爱与无能为力之间安放自己',
    titleWord: '陪伴',
    practice: '涉及宠物健康时，请优先咨询兽医；牌面只能陪你整理心情。',
    patternLine: '于是相似的担心一次次回来，牵挂变成了压力。',
    prompts: [
      '这件事里，你最怕失去的是什么？',
      '如果它能感受到你的心情，你希望它安心的是什么？',
    ],
  },
  creation: {
    key: 'creation',
    label: '创作与副业',
    lens: '创作和副业表面在问结果，底下常常在问：我是否允许自己认真地喜欢一件事。',
    core: '你能不能在不被看见的时候也继续做',
    titleWord: '创作',
    practice: '或者先做一个十五分钟的小样，不发布，只给自己看。',
    patternLine: '于是相似的迟疑一次次回来，灵感被“准备好了吗”挡在门外。',
    prompts: [
      '如果没有人点赞，你还想继续做它吗？',
      '你想通过它被看见，还是想看见自己？',
    ],
  },
  dream: {
    key: 'dream',
    label: '梦与象征',
    lens: '梦和象征不预言未来，它们更像借用一个画面，谈你最近心里放着的事。',
    core: '这个意象让你想起了哪一段自己',
    titleWord: '梦境',
    practice: '或者醒来后先不分析，只写下画面里最清楚的三个细节。',
    patternLine: '于是相似的画面一次次回来，它在等你多看它一眼。',
    prompts: [
      '这个画面里，最让你在意的是什么？',
      '如果它能说话，它会问你什么？',
    ],
  },
  spiritual: {
    key: 'spiritual',
    label: '意义与相信',
    lens: '你在寻找一个更大的解释，这很人性；但牌面不替你判定运气或命运，只照见你如何面对眼前的起伏。',
    core: '你想相信什么，又愿意为这种相信承担什么',
    titleWord: '意义',
    practice: '或者写下最近三件让你觉得“活着真好”的小事。',
    patternLine: '于是相似的追问一次次回来，答案被推得越来越远。',
    prompts: [
      '如果暂时没有答案，你愿意带着这个问题生活吗？',
      '你更想要确定，还是更想要自由？',
    ],
  },
  life: {
    key: 'life',
    label: '生活与改变',
    lens: '你想换的可能不只是地点或节奏，也在问自己愿意过怎样的日常。',
    core: '你想把日子过成什么样',
    titleWord: '生活',
    practice: '或者写下你理想中普通的一天，从起床到睡前。',
    patternLine: '于是相似的停滞一次次回来，生活被留在了“以后”。',
    prompts: [
      '如果不必向任何人解释，你想在哪里生活？',
      '你现在的日常里，哪一件小事最不像你？',
    ],
  },
  decision: {
    key: 'decision',
    label: '选择与代价',
    lens: '真正的选择，代价往往不是选项本身，而是你要放下哪一种自己。',
    core: '你愿意放下哪一种安全感',
    titleWord: '取舍',
    practice: '或者给两个选项各写三行代价，不写好处。',
    patternLine: '于是相似的犹豫一次次回来，选择被拖成了消耗。',
    prompts: [
      '两个选项里，哪一个更像你愿意成为的那个人？',
      '如果两边都不完美，你更愿意承担哪一种后悔？',
    ],
  },
  self: {
    key: 'self',
    label: '自我与方向',
    lens: '你问的方向里，也许先藏着一个身份问题：你想成为谁，而不只是做成什么。',
    core: '你想成为谁，而不只是完成什么',
    titleWord: '方向',
    practice: '或者每天留十分钟，不输入任何信息，只听自己的呼吸。',
    patternLine: '于是相似的空转一次次回来，方向感被日常淹没。',
    prompts: [
      '如果暂时不用证明什么，你想把时间花在哪里？',
      '什么样的时刻，会让你觉得自己是鲜活的？',
    ],
  },
  other: {
    key: 'other',
    label: '此刻与内心',
    lens: '问题看起来具体，底下也许还藏着一个更旧的问题。',
    core: '哪一部分的你一直在等被听见',
    titleWord: '此刻',
    practice: '或者把这件事写成三句话：事实、感受、需要。',
    patternLine: '于是相似的犹豫一次次回来。',
    prompts: [
      '如果这件事可以小声说话，它会先说什么？',
      '你希望别人理解你的哪一部分？',
    ],
  },
}

interface ThemeExtra {
  lenses: string[]
  practices: string[]
  patterns: string[]
  prompts: string[]
}

const THEME_EXTRAS: Record<ThemeKey, ThemeExtra> = {
  work: {
    lenses: [
      '去留只是表面，真正被放在天平上的，可能是自主、稳定和被认可。',
      '你不是只在选一份工作，也在选一种愿意长期承受的日常。',
    ],
    practices: [
      '也可以分别写下“留下最坏的一天”和“离开最坏的一天”，看哪一种更接近你能承受的生活。',
    ],
    patterns: ['于是每次选择都被当成最后一次机会，反而更难动。'],
    prompts: [
      '如果离开不会失去任何人的认可，你还会犹豫吗？',
      '这份工作最想带走你的哪一部分？',
      '你希望下一份工作给你什么，而不是拿走什么？',
    ],
  },
  study: {
    lenses: [
      '你也许不是不会，而是太习惯用结果来给自己定价。',
      '学习这件事，有时候考的不是记性，而是你允不允许自己慢一点。',
    ],
    practices: ['也可以先做一套不计分的题，只观察自己在哪一步屏住呼吸。'],
    patterns: ['于是学习变成了证明自己的考场，而不是探索。'],
    prompts: [
      '如果这次结果不写进任何简历，你会怎么学？',
      '你最怕谁看到你的成绩？',
      '学明白哪一个瞬间，会让你觉得这段时间没有白过？',
    ],
  },
  grief: {
    lenses: [
      '思念没有进度条，它会在最普通的日子里突然回来。',
      '你不需要把失去整理成一个漂亮的结论，能带着它生活已经很不容易。',
    ],
    practices: ['也可以为那个人留一个固定的小仪式，不必向别人解释。'],
    patterns: ['于是你把想念藏起来，只在没人看见的时候打开。'],
    prompts: [
      '你最想保留对方的哪一个习惯？',
      '有没有一句话，你一直没来得及说？',
      '如果想念有形状，它今天看起来像什么？',
    ],
  },
  family: {
    lenses: [
      '你想靠近，也想有自己的边界；这两件事并不矛盾，只是很难同时说出口。',
      '家人之间最难的地方，是爱和旧的角色常常绑在一起。',
    ],
    practices: ['也可以把一次对话的目标从“被理解”改成“把感受说完整”。'],
    patterns: ['于是亲近变成了猜测，真实的需要被留在沉默里。'],
    prompts: [
      '在家里，你最常扮演的角色是什么？',
      '如果不用懂事，你会怎么回应？',
      '你希望家人看见你的哪一面，而不是哪一类角色？',
    ],
  },
  relation: {
    lenses: [
      '你也许在等的不是对方改变，而是自己终于有勇气承认某个需要。',
      '亲密关系会放大一个人最熟悉的安全感，也会放大最熟悉的害怕。',
    ],
    practices: ['也可以把最近一次不舒服的对话写下来，只圈出你当时没有说出口的那一句。'],
    patterns: ['于是你不断靠近，又不断退回，关系被留在暧昧的距离里。'],
    prompts: [
      '你在这段关系里，最常替对方解释什么？',
      '如果不需要维持关系，你会怎么表达？',
      '你希望对方怎样知道你正在难过，而不必你先崩溃？',
    ],
  },
  social: {
    lenses: [
      '边界不是把人推远，而是让关系有一个双方都能呼吸的距离。',
      '有些不舒服不是玻璃心，而是你的边界在发出声音。',
    ],
    practices: ['也可以下一次先延迟十分钟再答应，看看身体怎么反应。'],
    patterns: ['于是你用退让换取表面的和平，代价是越来越不相信自己的感受。'],
    prompts: [
      '你最怕别人怎么评价你？',
      '如果拒绝不会被讨厌，你会先拒绝什么？',
      '你希望别人尊重你的哪一个界限？',
    ],
  },
  money: {
    lenses: [
      '数字背后，也许是你对未来的信任程度，以及你允许自己拥有多少。',
      '钱的问题有时候不是算术，而是你愿不愿意承认自己真正想要什么。',
    ],
    practices: ['也可以把“最坏会怎样”写具体，看看它是否真的无法承受。'],
    patterns: ['于是你用拥有来安抚不安，却很难真正停下来。'],
    prompts: [
      '这笔钱想替你解决哪一种不安？',
      '如果没有人知道你怎么花，你会怎么选？',
      '你更怕失去钱，还是失去对自己的信任？',
    ],
  },
  health: {
    lenses: [
      '你不是一台需要继续运转的机器；身体的信号也许在替你说“我已经撑了很久”。',
      '恢复不是把自己修好，而是重新学会听见身体。',
    ],
    practices: ['也可以先把今晚的睡眠当成一件正事，其他事明天再说。'],
    patterns: ['于是你把休息推迟到“忙完”，而忙碌没有尽头。'],
    prompts: [
      '你最不敢让自己停下来的是哪一刻？',
      '如果身体能提一个要求，它会提什么？',
      '你愿意为自己保留哪一种恢复方式？',
    ],
  },
  pet: {
    lenses: [
      '你已经在尽力，牵挂本身也是爱的一种形状。',
      '照顾一个不会说话的生命，会让人同时变得柔软和无力。',
    ],
    practices: ['也可以把今天能做的照料写成一张小清单，只做眼前这一项。'],
    patterns: ['于是担心变成了自责，反而更难听见它真正的需要。'],
    prompts: [
      '你最想给它一个怎样的日常？',
      '这件事里，你允许自己有多少无能为力？',
      '如果它能感受到你的心情，你最想让它知道什么？',
    ],
  },
  creation: {
    lenses: [
      '你也许不是缺灵感，而是把“被看见”提前放到了作品前面。',
      '创作最难的部分，常常是允许自己做出一个还不完美的版本。',
    ],
    practices: ['也可以给自己设一个不公开的截止日期，只完成一个粗糙版本。'],
    patterns: ['于是你不断准备，却很少真正开始。'],
    prompts: [
      '如果没有人会评价，你最想先做什么？',
      '你希望作品替你表达哪一种自己？',
      '哪一个十五分钟，可以只属于这件事？',
    ],
  },
  dream: {
    lenses: [
      '梦不需要被翻译成一个确定答案；它也许只是把你最近忽略的感受放大。',
      '梦里的画面更像一首诗，它不急着被解释。',
    ],
    practices: ['也可以记下梦里最强烈的身体感觉，而不是急着解释情节。'],
    patterns: ['于是你试图解开每一个象征，却错过了它此刻的情绪。'],
    prompts: [
      '梦里的哪一个细节，让你醒来后还留着感觉？',
      '如果这个梦是一位朋友，它想提醒你什么？',
      '这个画面让你想起了生活里的哪一段？',
    ],
  },
  spiritual: {
    lenses: [
      '你也许在寻找的不是命运的证据，而是一种允许自己继续走下去的意义。',
      '意义不是被找到的，它有时是在你愿意继续生活之后慢慢长出来的。',
    ],
    practices: ['也可以把“我必须知道”改成“我愿意先这样生活一阵子”。'],
    patterns: ['于是你不断向外寻找确定，自己的感受被放在最后。'],
    prompts: [
      '如果宇宙不给你答案，你愿意相信什么？',
      '哪一种不确定，是你也能带着生活的？',
      '如果意义可以从很小的地方开始，你会先看哪里？',
    ],
  },
  life: {
    lenses: [
      '你想换的也许不是城市，而是每天醒来时对自己的感觉。',
      '生活不是一道要一次选对的题，它更像一段可以不断调整的节奏。',
    ],
    practices: ['也可以写下你现在最想保留的三个日常片段，再写下最想减少的一件。'],
    patterns: ['于是“以后”越来越重，今天被过成了等待。'],
    prompts: [
      '如果不考虑别人怎么看，你想把日子过成什么样？',
      '现在的哪一件小事，最让你觉得不像自己？',
      '如果只能改变一天里的一个时刻，你会选哪里？',
    ],
  },
  decision: {
    lenses: [
      '你也许不是不知道该选什么，而是不愿意承认每个选择都要放弃一些东西。',
      '真正的选择常常不是找到更好的答案，而是认领一种代价。',
    ],
    practices: ['也可以只问自己：哪一个代价是我愿意学着承担的？'],
    patterns: ['于是你反复比较，却始终没有把任何一种代价真正放到桌面上。'],
    prompts: [
      '如果两个选项都不会完美，你更愿意成为哪种人？',
      '你最怕失去的是机会，还是别人对你的期待？',
      '这个决定里，哪一部分其实已经不能再拖了？',
    ],
  },
  self: {
    lenses: [
      '你问自己的方式，可能比答案更重要；“我是谁”也许本来就不是一道选择题。',
      '你不需要先成为某个人，才有资格做选择。',
    ],
    practices: ['也可以写下今天让你感到最像自己的一个瞬间。'],
    patterns: ['于是你不断向外找标准，却很少停下来问自己真正喜欢什么。'],
    prompts: [
      '如果不被任何身份定义，你想先做什么？',
      '你最近一次感到自在，是在什么时刻？',
      '你希望别人认识的你，和你自己感受到的你，差在哪里？',
    ],
  },
  other: {
    lenses: [
      '这件事也许没有单一主题，它更像几条线在你身上交汇。',
      '有些问题之所以反复出现，不是因为你想不明白，而是因为它还在长。',
    ],
    practices: ['也可以先把这件事写成一句事实、一句感受、一个需要。'],
    patterns: ['于是你把它当成一个待解决的问题，却忽略了它正在影响你的生活。'],
    prompts: [
      '如果不用急着解决，你最想先理解哪一部分？',
      '这件事让你对自己多了什么认识？',
      '如果只留下一句真实的话，你会留下什么？',
    ],
  },
}

const TONES: { key: string; words: string[]; line: string; replyLine: string }[] = [
  {
    key: 'anxious',
    words: ['焦虑', '担心', '害怕', '紧张', '不安', '慌', '恐惧', '忐忑'],
    line: '听起来，这件事让你有些紧绷。',
    replyLine: '不用急着想清楚，先按你现在的感觉说。',
  },
  {
    key: 'sad',
    words: ['难过', '低落', '失落', '伤心', '哭', '委屈', '遗憾', '离世', '去世', '失去'],
    line: '这件事里有一些失落，需要被好好放在这里。',
    replyLine: '慢慢说，不用把情绪整理好。',
  },
  {
    key: 'angry',
    words: ['生气', '愤怒', '气死', '烦', '讨厌', '火大', '不公平', '憋屈'],
    line: '这份不舒服里，也许有被冒犯的部分。',
    replyLine: '这些不舒服可以直接放在这里。',
  },
  {
    key: 'tired',
    words: ['累', '疲惫', '撑不住', '耗竭', '没力气', '心累', '厌倦'],
    line: '你已经消耗了不少力气。',
    replyLine: '说一点点就够了。',
  },
  {
    key: 'confused',
    words: ['迷茫', '困惑', '不知道', '乱', '纠结', '犹豫', '说不清'],
    line: '卡住的时候，先不急着找到出口。',
    replyLine: '说不清也没关系，我们可以从最小的那一点开始。',
  },
  {
    key: 'lonely',
    words: ['孤独', '孤单', '寂寞', '没人理解', '被落下', '一个人'],
    line: '这件事里，有一种不被陪伴的孤独。',
    replyLine: '可以慢慢说，不需要先把自己整理好。',
  },
  {
    key: 'ashamed',
    words: ['羞耻', '丢脸', '没用', '失败', '自责', '后悔', '不够好', '讨厌自己'],
    line: '这里也许有一部分羞耻感；它很真实，但它不是对你的判决。',
    replyLine: '你不需要先证明自己值得被听。',
  },
  {
    key: 'numb',
    words: ['麻木', '没感觉', '空洞', '空落', '提不起兴趣', '提不起劲', '无感'],
    line: '当感受变得迟钝，可能是你已经撑了很久。',
    replyLine: '不用勉强自己产生情绪，能说一点就够了。',
  },
]

const FRAME_RULES: { key: FrameKey; name: string; words: string[]; line: string }[] = [
  {
    key: 'prediction',
    name: '不确定题',
    words: ['会不会', '能不能', '多久', '什么时候', '何时', '有希望', '运气', '会成吗', '会成功', '准不准', '结果怎样', '能过', '上岸', '考上', '能成', '还有机会', '有戏吗'],
    line: '牌面不预言结果，它更擅长照见你面对不确定时的样子。',
  },
  {
    key: 'decision',
    name: '权衡题',
    words: ['该不该', '要不要', '是不是应该', '选哪', '还是', '值不值得', '抉择'],
    line: '牌面不会替你做决定，但可以帮你把正在权衡的东西摆到桌面上。',
  },
  {
    key: 'understanding',
    name: '理解题',
    words: ['为什么', '是什么', '意味着', '什么意思', '我怎么了', '怎么会这样'],
    line: '先不急着解释，看看你提到它时，身体和情绪的反应。',
  },
  {
    key: 'advice',
    name: '行动题',
    words: ['怎么办', '怎么', '如何', '该怎么', '怎样', '方法'],
    line: '比起“怎么做”，我更想先看看是什么让你卡在这里。',
  },
]

const GENERAL_FRAME: Frame = {
  key: 'general',
  name: '开放题',
  line: '先不急着找答案，我们看看牌面把你的问题照成了什么样子。',
}

const STAGE_PROMPTS = [
  '如果把这件事里的“应该”拿掉，你最先想做的会是什么？',
  '有没有一个细节，你一提起来，身体就先有反应？',
  '如果三个月后的你回看今天，会希望你此刻多做一件什么事？',
  '你愿意把哪一个很小的动作，留给接下来的二十四小时？',
  '如果这件事不需要一个答案，你最想先被谁听见？',
  '你愿意把哪一句话留到明天再说？',
  '如果身体可以投票，它会选哪一边？',
  '最近有没有一个瞬间，你其实已经知道答案？',
  '如果把这件事缩小到十分之一，它还需要你做什么？',
  '你希望三个月后的自己如何评价你今天的选择？',
  '你现在最想保护的是什么？',
  '如果不用负责任何人的感受，你会怎么选？',
  '如果这件事里有一件事可以暂时不做，你会先放下什么？',
  '你希望谁看见你现在的为难？',
  '如果不用马上回答，你最想把这问题留在哪里？',
  '你现在最不想承认的答案是什么？',
  ...EXTRA_STAGE_PROMPTS,
]

const FRAME_PROMPTS: Record<FrameKey, string[]> = {
  decision: [
    '如果把“选对”这个压力拿掉，你更想靠近哪一边？',
    '这个选择里，你最不愿意失去的是什么？',
    '如果两边都不会完美，你更愿意承担哪一种后悔？',
    '你是在选一个结果，还是在选一种成为自己的方式？',
  ],
  prediction: [
    '在结果到来之前，你能为自己做的第一件事是什么？',
    '你更害怕的是坏结果，还是等待本身？',
    '你愿意为想要的结果做哪一件可控的事？',
    '如果结果暂时不变，你还能怎样照顾自己？',
  ],
  advice: [
    '你已经试过什么？哪一步最卡？',
    '如果只能改变一个小环节，你会先动哪里？',
    '你已经知道但还没做的那一步是什么？',
    '如果需要别人帮忙，你会先找谁？',
  ],
  understanding: [
    '如果这件事有它的好处，那可能是什么？',
    '这个模式第一次出现，是在什么时候？',
    '这个解释给你带来了什么？',
    '有没有另一种同样合理的解释？',
  ],
  general: [
    '如果这件事可以小声说话，它会先说什么？',
    '此刻你最需要被理解的是哪一部分？',
    '如果不用急着解决，你最想先理解哪一部分？',
    '这件事让你对自己多了什么认识？',
  ],
}

const COUNTER_VOICES = [
  '也可以反过来看：其中一张牌说的不是问题，而是你已经在做的努力。',
  '还有另一种可能：这不是要你马上改变，而是提醒你看见自己已经承受了什么。',
  '如果把这些牌当成一个整体，也许会看到：保护与想要，正在同时拉扯。',
  '但牌面也可能说错。它不认识你的全部生活，只认识你刚刚说出口的部分。',
  '有一个反向的读法：你一直以为的“卡住”，也可能是一种谨慎的保护。',
  '也可以把其中一张牌读成提醒：你不必把每件事都解释成自己的问题。',
  '如果换成你朋友的处境，你也许会对 TA 更宽容一点；这句话也可以还给你。',
  '还有一层：真正让你难动的，可能不是选项，而是你不想让任何人失望。',
  ...EXTRA_COUNTER_VOICES,
]

const AUTHORITY_LINES = [
  '这些只是镜子，不是命令；最后的分辨仍然在你手里。',
  '你可以同意其中一句，也可以全部推翻。牌不比你更了解你的生活。',
  '没有哪一张牌拥有最终解释权，包括月鉴。',
  '不必急着把三句话统一成一个答案；有些问题允许同时有几种真实。',
  '如果有一句让你不舒服，也可以把它放回去。你不需要接受整组解释。',
  '可以只带走一句，也可以一句都不带走。',
  '这不是标准答案，只是你此刻可以借用的理解。',
  '牌面没有资格定义你；它只是在陪你把问题看深一点。',
  ...EXTRA_AUTHORITY_LINES,
]

const DEMO_POSITION_LABELS: Record<DrawnCard['position'], string> = {
  situation: '处境',
  blindspot: '盲点',
  action: '行动',
}

const ECHO_OPENERS: ((quote: string) => string)[] = [
  (quote) => `你说的「${quote}」，我听见了。`,
  (quote) => `「${quote}」这句，值得多停一会儿。`,
  (quote) => `你停在「${quote}」这里，我没有把它当成一句普通的话。`,
  (quote) => `读到「${quote}」的时候，我感觉你在对自己承认什么。`,
  (quote) => `我记住了「${quote}」。`,
  (quote) => `「${quote}」——这句话里有一部分真实的你。`,
  (quote) => `你刚才说的「${quote}」，我没有跳过。`,
  (quote) => `「${quote}」让我停了一下。`,
  (quote) => `在你写的「${quote}」里，有一个没有被说完的部分。`,
  (quote) => `你选择了「${quote}」这几个字，我想知道它对你意味着什么。`,
  ...EXTRA_ECHO_OPENERS,
]

const REPLY_METAS = [
  '这两个读法不必二选一，它们可能同时成立。',
  '我不确定哪一种更接近你；你比我更有资格判断。',
  '牌面没有投票权，最后的票在你手里。',
  '如果都不像你，也可以把这两句一起放下。',
  '它们只是两种可能，不是关于你的判决。',
  '这两句话都不是判决，只是两个可以暂时站上去的位置。',
  '如果你愿意，也可以两句话都不选。',
  '牌面只负责把可能摊开，不负责替你盖章。',
  '哪一种更像你，不需要现在回答。',
  '把它们并排放着，也许比急着选一个更诚实。',
  ...EXTRA_REPLY_METAS,
]

const INSIGHT_COUNTERS = [
  '这种模式也在保护你不被更深的失望击中。',
  '它也是你在有限条件里做出的最好保护。',
  '它不是单纯的缺点，更像一个曾经有用的旧策略。',
  '你不是不知道，而是还没有被允许按自己的感觉选择。',
  '它不是在拖住你，而是在等一个更安全的时机。',
  '这不是一个需要被修正的模式，而是你曾经活下来的方式。',
  '它在替你争取一点喘息的空间。',
  '你已经在松动了，只是变化还不够显眼。',
  ...EXTRA_INSIGHT_COUNTERS,
]

const GENERIC_SUGGESTIONS = [
  '我说不清，只是心里一直有点不安。',
  '我想先说说这件事让我最难受的部分。',
  '我不确定自己是不是在自欺欺人。',
  '如果诚实一点，我其实更想……',
  ...EXTRA_GENERIC_SUGGESTIONS,
]

const GRIEF_METAS = [
  '你不需要按任何进度悲伤。',
  '想念没有标准流程，今天能说出一点就已经很好。',
  '牌面不能替你减轻思念，它只陪你把这份想念放到光下。',
  '你可以同时想念一个人，也继续过自己的生活。',
]

const THEME_SUGGESTION_EXTRAS: Record<ThemeKey, string> = {
  work: '我也在想，留下是不是只是因为我害怕变化。',
  study: '我一边想努力，一边又很抗拒开始。',
  grief: '我只是想有人知道，我还在想 TA。',
  family: '我既想让他们满意，又很想为自己活一次。',
  relation: '我总觉得先说出需要的人会输。',
  social: '我常常答应之后才后悔。',
  money: '我花钱或省钱，好像都在缓解同一种不安。',
  health: '我总把休息放到所有事情之后。',
  pet: '我怕自己的任何一个决定都会影响它。',
  creation: '我想做点真的属于自己的东西。',
  dream: '我醒来后一直在想那个画面。',
  spiritual: '我不想再向外找标准答案了。',
  life: '我好像一直在等一个允许自己改变的信号。',
  decision: '我一直在等一个不会后悔的选项。',
  self: '我好像很久没有听见自己的声音了。',
  other: '我想先弄清楚这件事为什么让我这么在意。',
}

const FRAME_SUGGESTION_EXTRAS: Record<FrameKey, string> = {
  decision: '我担心不管怎么选，都会辜负一部分自己。',
  prediction: '我一直在等一个确定的结果，才敢开始生活。',
  advice: '我知道一些方法，但就是迈不出那一步。',
  understanding: '我越想解释，越觉得自己说不清。',
  general: '我想先被听见，而不是马上被建议。',
}

function seedOf(...parts: (string | number)[]): number {
  const text = parts.join('|')
  let seed = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }
  return seed >>> 0
}

function choose<T>(items: T[], seed: number, offset = 0): T {
  const index = (seed + Math.imul(offset, 31)) >>> 0
  return items[index % items.length]
}

function chooseFresh<T>(
  items: T[],
  seed: number,
  offset: number,
  recent: string,
): T {
  const normalizedRecent = recent.replace(/\s+/g, '')
  const index = (seed + Math.imul(offset, 31)) >>> 0
  for (let step = 0; step < items.length; step += 1) {
    const item = items[(index + step) % items.length]
    const key = String(item).replace(/\s+/g, '')
    if (!normalizedRecent.includes(key)) return item
  }
  return choose(items, seed, offset)
}

const FOCUS_PREFIX =
  /^(请问|我想问一下|我想问|想问一下|想问|我想知道|我想|我觉得|我感觉|我该不该|我要不要|我是不是应该|我是不是|我该怎么|我应该|要不要|该不该|能不能|会不会|为什么我|为什么|如何|怎么|我和|我跟|我们|我(?!们))/

function extractFocus(question: string): string {
  const clauses = question
    .split(/[，。！？；,.!?;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  const first = clauses.find((part) => part.length >= 4) ?? clauses[0] ?? question
  let focus = first
  let changed = true
  while (changed) {
    const next = focus.replace(FOCUS_PREFIX, '').trim()
    changed = next !== focus
    focus = next
  }
  focus = focus
    .replace(/^(总是|一直|最近|其实|好像|可能|有点|很|太)/, '')
    .replace(/(怎么办|怎么选|如何选择|好不好|可以吗|来得及吗|该不该|要不要|吗|呢|吧|呀)$/g, '')
    .trim()
  if (!focus) focus = firstClause(question, 18)
  return focus.length > 24 ? `${focus.slice(0, 24)}…` : focus
}

function extractSecondary(question: string): string {
  const clauses = question
    .split(/[，。！？；,.!?;]/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (clauses.length < 2) return ''
  let second = clauses[1]
    .replace(/^(但|可是|但是|不过|而且|又|也|却|然后|同时|另外|还有)/, '')
    .replace(/(怎么办|怎么选|如何选择|好不好|可以吗|来得及吗|该不该|要不要|吗|呢|吧|呀)$/g, '')
    .trim()
  if (
    second.length < 4 ||
    second === extractFocus(question) ||
    (second.length <= 8 &&
      TONES.some((tone) => tone.words.some((word) => second.includes(word))))
  ) {
    return ''
  }
  return second.length > 22 ? `${second.slice(0, 22)}…` : second
}

function themeLens(theme: Theme, seed: number): string {
  return choose(
    [
      theme.lens,
      ...THEME_EXTRAS[theme.key].lenses,
      ...THEME_CORPUS[theme.key].lenses,
    ],
    seed,
    1,
  )
}

function themePractice(theme: Theme, seed: number): string {
  return choose(
    [
      theme.practice,
      ...THEME_EXTRAS[theme.key].practices,
      ...THEME_CORPUS[theme.key].practices,
    ],
    seed,
    2,
  )
}

function themePattern(theme: Theme, seed: number): string {
  return choose(
    [
      theme.patternLine,
      ...THEME_EXTRAS[theme.key].patterns,
      ...THEME_CORPUS[theme.key].patterns,
    ],
    seed,
    3,
  ).replace(/^于是/, '')
}

const seedBase = (question: string, cards: DrawnCard[]) =>
  seedOf(
    question,
    ...cards.flatMap((card) => [
      card.card.id,
      card.orientation,
      card.position,
    ]),
  )

const TASK_OPENING = `这件事我帮不上忙——月鉴不做检索、翻译或代写，只陪你做自省。如果愿意，我们可以换个角度：这件事此刻最让你在意的是什么？`

const TASK_REPLY = `月鉴只做自省陪伴，不做检索或代写。要不要告诉我：你问这件事时，心里真正担心的是什么？`

const TASK_PATTERNS = [
  /帮我(写|翻译|算|查|找|推荐|做|订)/,
  /推荐(一部|一本|一首|一家)/,
  /写(代码|程序|作业|文案)/,
  /翻译/,
  /计算|算一下/,
  /天气|下雨|气温|菜谱|攻略|快递|路由器|手机屏幕/,
]

function isTaskRequest(question: string): boolean {
  return TASK_PATTERNS.some((pattern) => pattern.test(question))
}

function conversationConcern(
  question: string,
  messages: ChatMessage[],
): SafetyKind | null {
  const kinds = [
    detectSafetyConcern(question),
    ...messages
      .filter((message) => message.role === 'user')
      .map((message) => detectSafetyConcern(message.content)),
  ].filter((kind): kind is SafetyKind => kind !== null)
  const priority: SafetyKind[] = [
    'both',
    'sexual-assault',
    'sexual-harm',
    'threat',
    'harm-others',
    'self',
  ]
  return priority.find((kind) => kinds.includes(kind)) ?? null
}

function detectTheme(question: string): Theme {
  let bestKey: ThemeKey = 'other'
  let bestScore = 0
  for (const rule of THEME_RULES) {
    if (rule.key === 'decision') continue
    const score = rule.words.reduce(
      (sum, word) => sum + (question.includes(word) ? Math.max(2, word.length) : 0),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      bestKey = rule.key
    }
  }
  if (bestScore > 0) return THEMES[bestKey]

  const decisionRule = THEME_RULES.find((rule) => rule.key === 'decision')
  const decisionHit = decisionRule?.words.some((word) => question.includes(word))
  return decisionHit ? THEMES.decision : THEMES.other
}

function detectTone(question: string): Tone | null {
  const match = TONES.find((tone) =>
    tone.words.some((word) => question.includes(word)),
  )
  return match
    ? { key: match.key, line: match.line, replyLine: match.replyLine }
    : null
}

function detectFrame(question: string): Frame {
  const match = FRAME_RULES.find((frame) =>
    frame.words.some((word) => question.includes(word)),
  )
  return match
    ? { key: match.key, name: match.name, line: match.line }
    : GENERAL_FRAME
}

function analyzeQuestion(question: string): Analysis {
  return {
    theme: detectTheme(question),
    tone: detectTone(question),
    frame: detectFrame(question),
  }
}

export interface ThemeProfile {
  key: ThemeKey
  label: string
  titleWord: string
}

export function classifyTheme(question: string): ThemeProfile {
  const theme = detectTheme(question)
  return { key: theme.key, label: theme.label, titleWord: theme.titleWord }
}

function cautionFor(question: string, themeKey: ThemeKey): string {
  if (
    themeKey === 'pet' &&
    ['生病', '不吃', '医院', '医生', '吐', '拉', '兽医'].some((word) =>
      question.includes(word),
    )
  ) {
    return '涉及宠物健康的判断，请以兽医的意见为准。'
  }
  if (
    ['起诉', '官司', '律师', '法律', '合同', '仲裁', '纠纷'].some((word) =>
      question.includes(word),
    )
  ) {
    return '涉及法律的决定，请以专业律师的意见为准。'
  }
  if (
    themeKey === 'health' ||
    ['医院', '医生', '手术', '诊断', '吃药', '症状', '治疗'].some((word) =>
      question.includes(word),
    )
  ) {
    return '涉及身体的判断，请以医生的意见为准。'
  }
  return ''
}

function meaningOf(card: DrawnCard): string {
  return card.orientation === 'upright'
    ? card.card.upright.meaning
    : card.card.reversed.meaning
}

function keywordsOf(card: DrawnCard): string[] {
  return card.orientation === 'upright'
    ? card.card.upright.keywords
    : card.card.reversed.keywords
}

function orientationLabel(card: DrawnCard): string {
  return card.orientation === 'upright' ? '正位' : '逆位'
}

function firstClause(text: string, max = 22): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const clause = clean.split(/[。！？；.!?;]/)[0] || clean
  return clause.length > max ? `${clause.slice(0, max)}…` : clause
}

function shortMeaning(card: DrawnCard, max = 42): string {
  return firstClause(meaningOf(card), max)
}

function asPrompt(text: string): string {
  return /[？?]$/.test(text.trim())
    ? text
    : `${text.replace(/[。.]$/, '')}？`
}

function uniqueKeywords(cards: DrawnCard[]): string[] {
  return [...new Set(cards.flatMap(keywordsOf))]
}

const DEMO_SUITS = [
  { name: '权杖', domain: '行动与欲望' },
  { name: '圣杯', domain: '情感与关系' },
  { name: '宝剑', domain: '思考与言语' },
  { name: '星币', domain: '现实与资源' },
]

function demoSpreadLine(cards: DrawnCard[]): string {
  const majorCount = cards.filter((card) => card.card.id < 22).length
  const reversedCount = cards.filter(
    (card) => card.orientation === 'reversed',
  ).length
  const suitCounts = [0, 0, 0, 0]
  cards
    .filter((card) => card.card.id >= 22)
    .forEach((card) => {
      const suitIndex = Math.floor((card.card.id - 22) / 14)
      if (suitIndex >= 0 && suitIndex < 4) suitCounts[suitIndex] += 1
    })
  const notes: string[] = []
  notes.push(
    majorCount >= 2
      ? '两张以上大阿卡纳，这次更接近阶段性的课题'
      : majorCount === 0
        ? '三张都是小阿卡纳，落点更贴近日常'
        : '一张大阿卡纳落在具体日常里',
  )
  if (reversedCount >= 2) {
    notes.push(`${reversedCount} 张逆位，能量更像向内收或被过度使用`)
  }
  const concentrated = suitCounts.findIndex((count) => count >= 2)
  if (concentrated >= 0) {
    notes.push(
      `${suitCounts[concentrated]} 张${DEMO_SUITS[concentrated].name}，${DEMO_SUITS[concentrated].domain}是这次的主线`,
    )
  }
  return `牌阵结构上，${notes.join('；')}。`
}

export function demoOpening(
  question: string,
  cards: DrawnCard[],
  querent?: string,
): string {
  const concern = detectSafetyConcern(question)
  if (concern) return safetyOpening(concern, querent)
  if (isTaskRequest(question)) return TASK_OPENING

  const { theme, tone, frame } = analyzeQuestion(question)
  const [situation] = cards
  const caution = cautionFor(question, theme.key)
  const seed = seedBase(question, cards)
  const focus = extractFocus(question)
  const secondary = extractSecondary(question)
  const whoLine = querent ? `这组牌，为「${querent}」而开。` : ''
  const questionLine = secondary
    ? `你问的是「${focus}」，同时也提到了「${secondary}」。`
    : `你问的是「${focus}」。`
  const intro = `${whoLine}${tone ? tone.line : ''}${questionLine}${frame.line}`
  const promptPool = [
    ...theme.prompts,
    ...THEME_EXTRAS[theme.key].prompts,
    ...THEME_CORPUS[theme.key].prompts,
    ...FRAME_PROMPTS[frame.key],
    ...cards.flatMap((card) => [...card.card.prompts]),
    ...STAGE_PROMPTS,
  ].filter(Boolean)
  const prompt = choose([...new Set(promptPool)], seed, 7)
  const lens = themeLens(theme, seed)

  if (theme.key === 'grief') {
    const griefLine = choose(GRIEF_METAS, seed, 2)
    return [
      `${intro}${lens}`,
      `《${situation.card.name}》${orientationLabel(situation)}让我想到：${shortMeaning(situation, 56)}。${griefLine}`,
      `${choose(AUTHORITY_LINES, seed, 6)}${asPrompt(prompt)}`,
    ].join('\n\n')
  }

  const [mainCard, counterCard] =
    seed % 2 === 0 ? [cards[0], cards[1]] : [cards[0], cards[2]]
  const mainTemplates = [
    (position: string, card: string, orientation: string, meaning: string) =>
      `我更倾向从「${position}」的《${card}》${orientation}读起：这可能是说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `这次我更愿意相信「${position}」的《${card}》${orientation}：它也许在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `如果先只信一面，我会看「${position}」的《${card}》${orientation}：这可能是在提醒，${meaning}。`,
  ]
  const counterTemplates = [
    (position: string, card: string, orientation: string, meaning: string) =>
      `但如果反过来看，「${position}」的《${card}》${orientation}提醒：这也许是在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `另一面也得算进来：「${position}」的《${card}》${orientation}也可能是在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `反读一下，「${position}」的《${card}》${orientation}也许指向另一件事：${meaning}。`,
  ]
  const mainRead = choose(mainTemplates, seed, 2)(
    DEMO_POSITION_LABELS[mainCard.position],
    mainCard.card.name,
    orientationLabel(mainCard),
    shortMeaning(mainCard, 62),
  )
  const counterRead = `${choose(counterTemplates, seed, 3)(
    DEMO_POSITION_LABELS[counterCard.position],
    counterCard.card.name,
    orientationLabel(counterCard),
    shortMeaning(counterCard, 62),
  )}${choose(COUNTER_VOICES, seed, 8)}`

  return [
    `${intro}${lens}`,
    `${demoSpreadLine(cards)}${mainRead}`,
    `${counterRead}${caution ? ` ${caution}` : ''}`,
    `不必现在选哪一边；${asPrompt(prompt)}`,
  ].join('\n\n')
}

export function demoReply(
  question: string,
  cards: DrawnCard[],
  messages: ChatMessage[],
  lens?: ReadingLens,
): string {
  const userMessages = messages.filter((message) => message.role === 'user')
  const lastUser = userMessages[userMessages.length - 1]?.content ?? ''
  const recentAssistant = messages
    .filter((message) => message.role === 'assistant')
    .slice(-4)
    .map((message) => message.content)
    .join('\n')
  const concern = conversationConcern(question, messages)
  if (concern) return safetyReply(concern)
  if (isTaskRequest(question)) return TASK_REPLY

  const { theme, tone, frame } = analyzeQuestion(question)
  const turn = userMessages.length
  const focus = extractFocus(question)
  const secondary = extractSecondary(question)
  const seed = seedOf(seedBase(question, cards), lastUser, turn)
  const toneTail = turn === 1 && tone ? ` ${tone.replyLine}` : ''
  const echo = lastUser
    ? `${choose(ECHO_OPENERS, seed, 1)(firstClause(lastUser, 24))}${toneTail}`
    : '我在听。'
  const situation = cards[0]
  const blindspot = cards[1]
  const action = cards[2]

  if (theme.key === 'grief') {
    const bridge = chooseFresh(
      [
        '想念不需要被解释成一个需要解决的问题，它只是说明那段关系对你仍然重要。',
        '你不需要按任何进度悲伤。能把一部分感受说出来，就已经在照顾自己。',
        '这份想念会以不同的样子回来，今天不必把它整理完。',
        '你可以同时想念一个人，也继续过自己的生活；这两件事并不冲突。',
      ],
      seed,
      2,
      recentAssistant,
    )
    const meta = chooseFresh(
      [
        '没有哪一种悲伤是标准答案。',
        '你可以保留自己的节奏，不必向任何人证明已经走出来。',
        '如果今天只能做到想念，也已经足够。',
        ...GRIEF_METAS,
      ],
      seed,
      3,
      recentAssistant,
    )
    const prompt = chooseFresh(
      [
        ...new Set([
          ...theme.prompts,
          ...THEME_EXTRAS.grief.prompts,
          ...THEME_CORPUS.grief.prompts,
          ...FRAME_PROMPTS[frame.key],
          ...STAGE_PROMPTS,
        ]),
      ],
      seed,
      4,
      recentAssistant,
    )
    return [
      `${echo} ${bridge}`,
      meta,
      asPrompt(prompt),
    ].join('\n\n')
  }

  const firstBridges = [
    ...(secondary
      ? [
          `你一开始问「${focus}」，又提到「${secondary}」；我们看看这两层是不是同一件事。`,
        ]
      : []),
    `我们先不急着替「${focus}」找结论，看看牌面给出的两种读法。`,
    `你问的「${focus}」里，可能不只装着一个问题。`,
    `比起立刻解释，我想先把「${focus}」的两种可能并排放在你面前。`,
    `这句话先不评价；把它和牌面放在一起，会看到两种方向。`,
    `先别急着把它归成一个问题；牌面给出了不止一个方向。`,
  ]
  const bridge =
    turn <= 1
      ? chooseFresh(firstBridges, seed, 2, recentAssistant)
      : turn === 2
        ? chooseFresh(
            [
              `把它放回牌阵：处境是「${keywordsOf(situation)[0]}」，行动位是「${keywordsOf(action)[0]}」。你难的也许正是这段距离。`,
              `你这次说的，和牌阵里的「${keywordsOf(blindspot)[0]}」撞在了一起。`,
              `如果盲点位说的是真的，它想保护的也许是你不想失去的「${keywordsOf(blindspot)[0]}」。`,
              `先说出来的部分已经变了；我们再看看那个没变的部分。`,
              `这两张牌没有站在一起，也许正说明你心里有两种同样真实的拉力。`,
            ],
            seed,
            2,
            recentAssistant,
          )
        : chooseFresh(
            [
              `你几次提到「${focus}」；它可能不是问题，而是你正在靠近的答案。`,
              `这段对话里，「${uniqueKeywords(cards).slice(0, 2).join('、')}」一直没有离开。`,
              `我注意到，你每多说一点，答案就更靠近「${focus}」一点。`,
              `我们不必急着把它收成一个结论；先让这些声音继续并排待着。`,
              `我们已经聊到这里，也许可以允许答案仍然不完全清楚。`,
            ],
            seed,
            2,
            recentAssistant,
          )

  if (lens) {
    const lensInfo = READING_LENSES.find((item) => item.id === lens)
    const [lensCard, otherCard] =
      lens === 'relationship'
        ? [situation, blindspot]
        : lens === 'inner'
          ? [blindspot, action]
          : [action, situation]
    const lensKeywords = keywordsOf(lensCard)
    const otherKeywords = keywordsOf(otherCard)
    const lensBodies: Record<ReadingLens, string[]> = {
      relationship: [
        `如果只看你们之间的动力，「${DEMO_POSITION_LABELS[lensCard.position]}」的《${lensCard.card.name}》把「${lensKeywords[0] ?? '靠近'}」放在桌面上；另一边「${otherKeywords[0] ?? '退让'}」也在拉扯。谁都没有错，只是两种期待还没被说清。这不一定说明关系变差了，也可能只是你们都在用旧的方式保护自己。`,
        `把镜头拉回关系里，《${lensCard.card.name}》${orientationLabel(lensCard)}让我想到「${lensKeywords[0] ?? '靠近'}」：它可能既是你想靠近的方式，也是你保护自己的方式。对方的动作先不解释，只看看你这边在等什么。也许你等的不是一个答案，而是一个更安全的靠近方式。`,
      ],
      inner: [
        `把镜头收回到你心里，《${lensCard.card.name}》${orientationLabel(lensCard)}把「${lensKeywords[0] ?? '靠近'}」和「${lensKeywords[1] ?? '退让'}」同时举了起来。一部分想往前走，另一部分想保住现有的安全；它们不是敌人，只是还没找到同一个方向。也许它们争的不是对错，而是同一种安全。`,
        `如果只看内在冲突，「${lensKeywords[0] ?? '靠近'}」像一股想往前的力，「${lensKeywords[1] ?? otherKeywords[0] ?? '退让'}」像另一股想保住的力。《${lensCard.card.name}》${orientationLabel(lensCard)}没有判谁对，它只是把这两股力放在同一张桌上。不一定哪一股更真实，也可能它们都在替你争取同一种安全。`,
      ],
      action: [
        `如果只看下一步，行动位的《${lensCard.card.name}》${orientationLabel(lensCard)}把「${lensKeywords[0] ?? '下一步'}」交给你：不是要你立刻决定，而是先设一个边界，看看身体在哪一刻松了一点。这不一定是一个承诺，也可能只是给自己留一点回旋。`,
        `把镜头停在行动位：《${lensCard.card.name}》${orientationLabel(lensCard)}提醒「${lensKeywords[0] ?? '下一步'}」。下一步不必很大，可以先做一个能让身体少紧一点的选择。也许你不需要一次走完，只要先让自己不再那么绷着。`,
      ],
    }
    const body = `${chooseFresh(
      lensBodies[lens],
      seed,
      9,
      recentAssistant,
    )}这也许只是这一层的一个读法，不必现在定论。`
    const promptPool = [
      ...lensCard.card.prompts,
      ...theme.prompts,
      ...THEME_EXTRAS[theme.key].prompts,
      ...THEME_CORPUS[theme.key].prompts,
      ...FRAME_PROMPTS[frame.key],
      ...STAGE_PROMPTS,
    ].filter(Boolean)
    const prompt = chooseFresh(
      [...new Set(promptPool)],
      seed,
      10,
      recentAssistant,
    )
    return [
      `${echo} 这次换一个角度：${lensInfo?.label ?? ''}。`,
      body,
      asPrompt(prompt),
    ].join('\n\n')
  }

  const openingSeed = seedBase(question, cards)
  const openingPair =
    openingSeed % 2 === 0
      ? [situation, blindspot]
      : [situation, action]
  const unusedCard =
    cards.find((card) => !openingPair.includes(card)) ?? action
  const lensPair =
    lens === 'relationship'
      ? [situation, blindspot]
      : lens === 'inner'
        ? [blindspot, action]
        : lens === 'action'
          ? [action, situation]
          : null
  const [mainCard, counterCard] =
    lensPair ??
    (turn <= 1
      ? [unusedCard, situation]
      : turn === 2
        ? [blindspot, action]
        : [action, situation])
  const replyMainTemplates = [
    (position: string, card: string, orientation: string, meaning: string) =>
      `我更倾向把这句话放回「${position}」的《${card}》${orientation}：这可能是说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `这次我更愿意从「${position}」的《${card}》${orientation}看：它也许在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `如果先只信一面，我会看「${position}」的《${card}》${orientation}：这可能是在提醒，${meaning}。`,
  ]
  const replyCounterTemplates = [
    (position: string, card: string, orientation: string, meaning: string) =>
      `但如果反过来看，「${position}」的《${card}》${orientation}提醒：这也许是在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `另一面也得算进来：「${position}」的《${card}》${orientation}也可能是在说，${meaning}。`,
    (position: string, card: string, orientation: string, meaning: string) =>
      `反读一下，「${position}」的《${card}》${orientation}也许指向另一件事：${meaning}。`,
  ]
  const lensLabel = lens
    ? READING_LENSES.find((item) => item.id === lens)?.label ?? ''
    : ''
  const mainRead = choose(replyMainTemplates, seed, 3)(
    DEMO_POSITION_LABELS[mainCard.position],
    mainCard.card.name,
    orientationLabel(mainCard),
    shortMeaning(mainCard, 50),
  )
  const counterRead = `${choose(replyCounterTemplates, seed, 4)(
    DEMO_POSITION_LABELS[counterCard.position],
    counterCard.card.name,
    orientationLabel(counterCard),
    shortMeaning(counterCard, 50),
  )}${chooseFresh(REPLY_METAS, seed, 5, recentAssistant)}`
  const promptPool = [
    ...mainCard.card.prompts,
    ...counterCard.card.prompts,
    ...theme.prompts,
    ...THEME_EXTRAS[theme.key].prompts,
    ...THEME_CORPUS[theme.key].prompts,
    ...FRAME_PROMPTS[frame.key],
    ...STAGE_PROMPTS,
  ].filter(Boolean)
  const prompt = chooseFresh(
    [...new Set(promptPool)],
    seed,
    6,
    recentAssistant,
  )

  return [
    `${echo}${lensLabel ? ` 这次换一个角度：${lensLabel}。` : ''} ${bridge}`,
    mainRead,
    counterRead,
    asPrompt(prompt),
  ].join('\n\n')
}

export function demoInsight(
  question: string,
  cards: DrawnCard[],
  messages: ChatMessage[],
): Insight {
  const userMessages = messages.filter((message) => message.role === 'user')
  const lastUser = userMessages[userMessages.length - 1]?.content

  const concern = conversationConcern(question, messages)
  if (concern) return safetyInsight(concern)

  if (isTaskRequest(question)) {
    return {
      title: '把问题带回自己',
      mirror:
        '你带来的更像一个待办任务，而月鉴只做自省陪伴。也许可以问问：这件事为什么此刻落在你手里？',
      pattern: '当事情以任务的形式出现时，背后的期待、压力或关系容易被忽略。',
      invitation: '如果愿意，换一个与你有关的问法，再抽一次牌。',
      keywords: ['换一个问题', '自省', '此刻'],
    }
  }

  const { theme, tone } = analyzeQuestion(question)
  const seed = seedOf(
    seedBase(question, cards),
    lastUser ?? '',
    messages.length,
  )
  const focus = extractFocus(question)
  const secondary = extractSecondary(question)
  const focusClause = secondary
    ? `「${focus}」和「${secondary}」`
    : `「${focus}」`
  const collected = uniqueKeywords(cards)
  const safety = collected.length > 0 ? collected : ['此刻', '变化', '选择']
  const action = cards[2]
  const actionWords = keywordsOf(action).filter(
    (word) => !/结束|失去|死亡|崩塌|断裂|停滞|束缚/.test(word),
  )
  const invited =
    choose(actionWords.length > 0 ? actionWords : keywordsOf(action), seed, 9) ??
    '下一步'
  const lastUserQuote = lastUser ? `你最后写下「${firstClause(lastUser, 28)}」，` : ''
  const toneLine = tone ? tone.line : ''

  if (theme.key === 'grief') {
    const title = choose(
      [
        '想念留下的几种声音',
        `「${safety[0]}」还在的时候`,
        `思念与「${safety[0]}」`,
        '不必急着走出来的想念',
      ],
      seed,
      1,
    )
    const practice = themePractice(theme, seed)
    return {
      title,
      mirror: `${lastUserQuote}失去不会因为一次对话就变小，但你愿意说出来，它就不必只由你一个人扛。牌面没有要求你把这份想念整理成一个结论。`,
      pattern:
        '反复想起、突然难过，都不是退步；它们说明那段关系仍在你的生命里继续。另一种可能是，你正在用自己的方式继续这段关系。',
      invitation: choose(
        [
          `接下来几天，想起对方时，允许自己停一小会儿。${practice}`,
          `如果愿意，为这份想念留一个不被打扰的十分钟。${practice}`,
          `不必急着走出来；先给这份想念一个可以安放的位置。${practice}`,
        ],
        seed,
        2,
      ),
      keywords: ['思念', ...safety].slice(0, 5),
    }
  }

  const title = choose(
    [
      `${theme.titleWord}：${safety[0]}与${safety[1] ?? '此刻'}`,
      `「${safety[0]}」背后，还有「${safety[1] ?? '此刻'}」`,
      `${theme.titleWord}里的两股拉力`,
      `把「${safety[0]}」说清楚`,
    ],
    seed,
    1,
  )
  const mirror = choose(
    [
      `${lastUserQuote}${toneLine}这组牌没有把${focusClause}推向一个结论，而是把「${safety[0]}」和「${safety[1]}」两种声音同时留给了你。`,
      `${lastUserQuote}你带来的${focusClause}，在牌面里不是一道选择题，而是几种需要被并排看见的真实。`,
      `${lastUserQuote}${toneLine}如果只看表面，你问的是${focusClause}；再往里一点，也许是${theme.core}。`,
      `${lastUserQuote}牌面没有给出一个中心答案；它更像三面镜子，把「${safety[0]}」「${safety[1]}」照在你面前。`,
    ],
    seed,
    3,
  )
  const patternOne = themePattern(theme, seed)
  const patternTwo = choose(INSIGHT_COUNTERS, seed, 4)
  const pattern = `一种可能是，${patternOne}另一种可能是，${patternTwo}这不是定论，只是两面镜子。`
  const practice = themePractice(theme, seed)
  const invitation = choose(
    [
      `接下来三天，留意「${invited}」出现的时刻；不用急着解决，只把它记录下来。${practice}`,
      `如果愿意，挑一个与你有关的「${invited}」小动作，在二十四小时内做一次。${practice}`,
      `先不急着行动；接下来三天，只观察「${invited}」在什么时候出现。${practice}`,
    ],
    seed,
    5,
  )

  return {
    title,
    mirror,
    pattern,
    invitation,
    keywords: [theme.titleWord, ...safety].slice(0, 5),
  }
}

export function demoSuggestions(question: string): string[] {
  const concern = detectSafetyConcern(question)
  if (concern) return safetySuggestions(concern)
  if (isTaskRequest(question)) {
    return ['其实我想问的不是这个任务。', '让我换一个和我有关的问法。', '我想先说说为什么这件事让我在意。']
  }
  const { theme, frame } = analyzeQuestion(question)
  const seed = seedOf(question)
  const perTheme: Record<ThemeKey, string> = {
    work: '我担心离开之后会失去现在的安全感。',
    study: '我很怕最后的结果证明我不够好。',
    grief: '我很想TA，也不知道该怎么和这份想念相处。',
    family: '我一边想靠近家人，一边又觉得很累。',
    relation: '我好像总在照顾对方的感受，把自己的需要放到最后。',
    social: '我不想再维持表面的和气，但又怕关系破裂。',
    money: '我既担心钱不够，也担心错过这个机会。',
    health: '我知道该休息，但一停下来就不安。',
    pet: '我很怕自己做得不够，帮不到它。',
    creation: '我想认真做，但又怕坚持不下去。',
    dream: '那个画面一直在我脑子里，我说不清它意味着什么。',
    spiritual: '我想要的也许不是答案，而是一种确定感。',
    life: '我想换个活法，但不知道从哪里开始。',
    decision: '两边都有我不舍得放下的东西。',
    self: '我很久没有认真问过自己想要什么了。',
    other: '这件事比我想象的更影响我。',
  }
  const perFrame: Record<FrameKey, string> = {
    decision: '我更怕的是选错，还是后悔没选？',
    prediction: '比起结果，我更担心的是过程里的什么？',
    advice: '我试过一些办法，但总卡在同一个地方。',
    understanding: '我说不清原因，但每次想到它，身体先有反应。',
    general: '我其实已经隐约知道答案，只是不敢承认。',
  }
  const candidates = [
    choose(
      [
        perTheme[theme.key],
        THEME_SUGGESTION_EXTRAS[theme.key],
        ...THEME_CORPUS[theme.key].suggestions,
      ],
      seed,
      1,
    ),
    choose([perFrame[frame.key], FRAME_SUGGESTION_EXTRAS[frame.key]], seed, 2),
    choose(GENERIC_SUGGESTIONS, seed, 3),
  ]
  const unique = [...new Set(candidates)]
  for (const fallback of GENERIC_SUGGESTIONS) {
    if (unique.length >= 3) break
    if (!unique.includes(fallback)) unique.push(fallback)
  }
  return unique.slice(0, 3)
}

export function demoRevisit(entry: JournalEntry, answer: string): string {
  const concern = conversationConcern(entry.question, entry.messages)
  if (concern) return safetyRevisit(concern, firstClause(answer, 26))

  const theme = detectTheme(entry.question)
  const keyword = entry.insight.keywords[0] ?? '那件事'
  const days = Math.floor((Date.now() - entry.createdAt) / 86400000)
  const opening =
    days >= 1
      ? `隔了 ${days} 天，你愿意回来看看当时的自己，这很珍贵。`
      : '你愿意在同一天回来看看，这也是一种诚实。'
  return `${opening}你这次写到「${firstClause(
    answer,
    26,
  )}」。我听见的是，「${keyword}」并没有消失，只是换了一种样子。在${theme.label}这件事上，答案还在继续长。留一点时间给它，也留一点时间给自己。`
}
