import type { RefObject } from 'react'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onCommit?: (value: string) => void
  inputRef?: RefObject<HTMLInputElement>
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search tracks, artists, or albums',
  onCommit,
  inputRef
}: SearchInputProps) {
  return (
    <label className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Find
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onCommit?.(event.currentTarget.value)
          }
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
      />
      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
        /
      </span>
    </label>
  )
}
