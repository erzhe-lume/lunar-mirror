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
    name: '月蚀',
    tone: '墨黑 · 银',
    description: '像一枚被月蚀磨亮的银镜。',
  },
  {
    id: 'verdant',
    name: '霜庭',
    tone: '石墨 · 锡',
    description: '像落霜后的石庭，冷而安静。',
  },
  {
    id: 'abyss',
    name: '乌金',
    tone: '烟褐 · 月白',
    description: '像旧银器上残留的一点暖光。',
  },
]

const THEME_IDS = THEMES.map((theme) => theme.id)

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId)
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
  const colors: Record<ThemeId, string> = {
    violet: '#07080a',
    verdant: '#0a0b0a',
    abyss: '#0b0a09',
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', colors[theme])
}
