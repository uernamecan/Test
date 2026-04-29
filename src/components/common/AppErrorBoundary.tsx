import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null
  }

  static getDerivedStateFromError(error: Error) {
    return {
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Renderer crashed:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-mesh-glow px-6 text-slate-100">
        <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-slate-950/85 p-8 text-center shadow-soft backdrop-blur-xl">
          <div
            aria-hidden="true"
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-rose-400/30 bg-rose-500/10"
          >
            <div className="h-7 w-7 rounded-full border border-rose-200/70" />
          </div>
          <div className="text-xs uppercase tracking-[0.22em] text-rose-200">Renderer Error</div>
          <h1 className="mt-3 text-2xl font-semibold text-white">PulseLocal hit a recoverable crash.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Your local files and database are still safe. Try rendering again first; if the same
            screen keeps failing, reload the app shell.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-slate-400">
            {this.state.error.message || 'Unknown renderer error.'}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Reload App
            </button>
          </div>
        </section>
      </main>
    )
  }
}
