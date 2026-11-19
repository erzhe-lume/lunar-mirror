export function isLitePerf(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.perf === 'lite'
  )
}
