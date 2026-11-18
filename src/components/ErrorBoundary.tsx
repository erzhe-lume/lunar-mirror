import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('心镜运行异常', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-fatal" role="alert">
        <span className="eyebrow">MIRROR ARCANA</span>
        <h1>镜面暂时起了雾</h1>
        <p>刚才的操作没有完成。你的本地记录仍在浏览器里，可以重新打开继续。</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => window.location.reload()}
        >
          重新打开心镜
        </button>
      </main>
    )
  }
}
