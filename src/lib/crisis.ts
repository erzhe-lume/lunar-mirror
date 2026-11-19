export type SafetyKind =
  | 'self'
  | 'harm-others'
  | 'sexual-assault'
  | 'sexual-harm'
  | 'threat'
  | 'both'

const SELF_HARM_PATTERNS: RegExp[] = [
  /自杀|自尽|轻生|寻死|遗书|告别信|自残|伤害自己|杀自己|结束(?:自己的)?生命|结束自己|了结自己/,
  /不想活|活不下去|活够了|不想存在|不想(?:再)?醒来|生无可恋/,
  /活着(?:真|好|太|很)?(?:没意思|没有意义|没意义|太累|好累|太痛苦|很痛苦)/,
  /想死(?!你|我|磕)|想去死|要死掉|要去死|死了算了|不如死|一了百了|结束这一切|离开这个世界/,
  /跳楼|割腕|服毒|上吊|吞药|过量服药|烧炭|(?:很多|大量|一把|过量).*安眠药/,
]

const HARM_OTHERS_PATTERNS: RegExp[] = [
  /我.{0,8}(?:想|要|准备|打算|计划)(?:去)?杀(?:了|掉)?(?:一个|个)?人(?!游戏|案|电影|剧|小说|漫画|动漫)/,
  /我.{0,8}(?:想|要|准备|打算|计划)(?:去)?(?:杀|捅|砍|弄死|毒死|勒死|打死|开枪|炸死|烧死|伤害)(?:了|掉)?(?:他|她|他们|你|人|某人|那个|别人|他人)/,
  /我.{0,8}(?:想|要|准备|打算|计划)(?:去)?(?:捅|砍|弄死|毒死|勒死|开枪|炸死|烧死|伤害)(?:人|他|她|他们|你)/,
  /我.{0,8}(?:想|要|准备|打算|计划)(?:去)?(?:打|揍)(?:他|她|他们|人|某人|那个|你)(?!电话|手机|招呼|车|球|游戏|字)/,
  /(?:恨不得|真想|想要).{0,4}(?:杀|弄死|捅|砍|开枪)(?:他|她|他们|人)/,
  /让(?:他|她|他们|你|某人)死/,
  /(?:拿|带|买)(?:刀|枪).{0,8}(?:捅|砍|杀|弄死|开枪)/,
  /我.{0,8}(?:准备|打算|计划|要去).{0,10}(?:开枪|扫射|炸|放火|烧死|砍人|捅人)/,
  /怎么(?:杀人|弄死|下毒|伤害别人|伤害他人)/,
]

const SEXUAL_ASSAULT_PATTERNS: RegExp[] = [
  /(?:我被|我遭到|我遭遇|遭到|遭遇)(?:强奸|性侵|猥亵|性骚扰)/,
  /(?:有人|他|她|他们|那个人|同事|领导|老公|老婆|男友|女友|父亲|母亲|爸爸|妈妈|室友|邻居).{0,8}(?:强奸|性侵|猥亵|性骚扰)(?:我|我们)/,
  /(?:被|遭)(?:强迫|逼迫).{0,4}(?:发生关系|性行为)/,
]

const SEXUAL_HARM_PATTERNS: RegExp[] = [
  /(?:我|自己).{0,8}(?:想|要|准备|打算|计划|已经)(?:去)?(?:强奸|性侵|猥亵|性骚扰)/,
  /怎么(?:强奸|性侵|猥亵|性骚扰)/,
  /我(?!被).{0,4}(?:强奸|性侵|猥亵)了(?:她|他|她们|他们|那个|人)?/,
]

const THREAT_PATTERNS: RegExp[] = [
  /(?:有人|他|她|他们|那个人|同事|领导|老公|老婆|男友|女友|父亲|母亲|爸爸|妈妈|室友|邻居).{0,8}(?:要|想|正在|在|准备|打算).{0,5}(?:杀|捅|砍|打|揍|伤害|强奸|猥亵|性侵|跟踪|报复)(?:我|我们)/,
  /(?:他|她|他们|有人).{0,4}(?:跟踪|骚扰|威胁)(?:我|我们)/,
  /我.{0,4}(?:正在|马上|即将).{0,5}(?:被杀|被砍|被打|被威胁|被跟踪|被家暴)/,
  /我被(?:家暴|殴打|威胁|跟踪|性侵|强奸|猥亵)/,
  /我被(?:他|她|他们|人).{0,4}(?:打|殴|砍|捅|威胁|跟踪)/,
  /(?:他|她|他们|有人).{0,4}(?:拿|带|举)(?:刀|枪).{0,5}(?:冲|朝|对|砍|捅)/,
]

export function detectSafetyConcern(text: string): SafetyKind | null {
  const compact = text.replace(/\s+/g, '')
  const self = SELF_HARM_PATTERNS.some((pattern) => pattern.test(compact))
  const harmOthers = HARM_OTHERS_PATTERNS.some((pattern) => pattern.test(compact))
  const sexualAssault = SEXUAL_ASSAULT_PATTERNS.some((pattern) => pattern.test(compact))
  const sexualHarm = SEXUAL_HARM_PATTERNS.some((pattern) => pattern.test(compact))
  const threat = THREAT_PATTERNS.some((pattern) => pattern.test(compact))

  if (sexualAssault) return 'sexual-assault'
  if (sexualHarm) return 'sexual-harm'
  if (threat) return 'threat'
  if (self && harmOthers) return 'both'
  if (harmOthers) return 'harm-others'
  if (self) return 'self'
  return null
}

export function isCrisisText(text: string): boolean {
  return detectSafetyConcern(text) !== null
}
