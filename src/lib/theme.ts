import type { ThemeId } from '../types'

export interface ThemeOption {
  id: ThemeId
  name: string
  tone: string
  description: string
}

export const THEMES: ThemeOption[] = [
  {
    id: 'violet',
    name: '镜夜',
    tone: '暗紫 · 旧金',
    description: '像一面被月光照亮的紫晶镜。',
  },
  {
    id: 'verdant',
    name: '苔庭',
    tone: '深绿 · 铜金',
    description: '像走进一座没有尽头的苔藓庭院。',
  },
  {
    id: 'abyss',
    name: '月潮',
    tone: '深蓝 · 银金',
    description: '像退潮后的深海与星图。',
  },
]

const THEME_IDS = THEMES.map((theme) => theme.id)

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId)
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
  const colors: Record<ThemeId, string> = {
    violet: '#07080f',
    verdant: '#04100a',
    abyss: '#030a12',
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', colors[theme])
}
