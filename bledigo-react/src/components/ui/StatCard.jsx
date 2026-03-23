const iconColors = {
  blue:   'bg-primary/10 text-primary',
  orange: 'bg-accent-light text-accent',
  green:  'bg-success-light text-success',
  red:    'bg-danger-light text-danger',
}

export default function StatCard({ icon, value, label, change, changeType = 'up', color = 'blue' }) {
  return (
    <div className="bg-white border border-border rounded-card p-5">
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-3 ${iconColors[color]}`}>
        {icon}
      </div>
      <div className="font-syne text-[26px] font-bold text-t1">{value}</div>
      <div className="text-[12.5px] text-t3 mt-0.5">{label}</div>
      {change && (
        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${
          changeType === 'up'
            ? 'bg-success-light text-success'
            : 'bg-danger-light text-danger'
        }`}>
          {change}
        </span>
      )}
    </div>
  )
}
