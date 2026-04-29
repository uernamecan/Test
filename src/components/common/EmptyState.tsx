import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-soft">
      <div
        aria-hidden="true"
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-slate-950/60">
          <div className="h-2 w-2 rounded-full bg-slate-400" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
