export default function ProgressBar({ value = 0, color = '#1A3C6B', height = 6 }) {
  return (
    <div
      className="w-full rounded overflow-hidden bg-border"
      style={{ height }}
    >
      <div
        className="h-full rounded transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  )
}
