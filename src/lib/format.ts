function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatShortDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
