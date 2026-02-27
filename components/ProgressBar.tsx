'use client'

interface ProgressBarProps {
  done: number
  total: number
}

export function ProgressBar({ done, total }: ProgressBarProps) {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center text-sm mb-2">
        <span className={allDone ? 'text-gray-700 font-medium' : 'text-gray-500'}>
          {allDone ? 'All done!' : 'Processing...'}
        </span>
        <span className="text-gray-400 tabular-nums">{done} / {total}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-gray-800'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
