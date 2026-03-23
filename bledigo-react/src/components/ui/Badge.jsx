const variants = {
  pending:  'bg-warning-light  text-warning',
  progress: 'bg-primary/10     text-primary',
  resolved: 'bg-success-light  text-success',
  cancelled:'bg-gray-100       text-t3',
  urgent:   'bg-danger-light   text-danger',
  info:     'bg-primary/10     text-primary',
}

export default function Badge({ status, children, className = '' }) {
  const cls = variants[status] ?? variants.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap ${cls} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-65 shrink-0" />
      {children}
    </span>
  )
}
