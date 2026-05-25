export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-border rounded-card overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-300 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children }) {
  return <h3 className="font-syne text-sm font-bold text-t1">{children}</h3>
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
