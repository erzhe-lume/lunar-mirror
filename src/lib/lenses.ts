export type ReadingLens = 'relationship' | 'inner' | 'action'

export interface ReadingLensOption {
  id: ReadingLens
  label: string
  instruction: string
}

export const READING_LENSES: ReadingLensOption[] = [
  {
    id: 'relationship',
    label: '关系动力',
    instruction:
      '这一轮把注意力放在你与对方、环境之间的动力、期待和边界；不要断言第三方的想法，只说你这边能观察到的部分。',
  },
  {
    id: 'inner',
    label: '内在冲突',
    instruction:
      '这一轮把注意力放在你内心的两股拉力：你想保住什么，又在防什么；不要做心理诊断。',
  },
  {
    id: 'action',
    label: '行动边界',
    instruction:
      '这一轮把注意力放在行动位：下一步的边界、代价，以及一个很小、可以尝试的动作；不要给清单。',
  },
]

export function lensInstruction(lens?: ReadingLens): string {
  return READING_LENSES.find((item) => item.id === lens)?.instruction ?? ''
}
