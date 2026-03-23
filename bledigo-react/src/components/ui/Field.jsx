export function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11.5px] font-semibold text-t2 uppercase tracking-[0.05em] mb-1.5"
    >
      {children}
    </label>
  )
}

export function Input({ id, className = '', ...props }) {
  return (
    <input
      id={id}
      className={`w-full bg-surface-2 border-[1.5px] border-border-2 rounded-btn px-3 py-2.5 text-[13.5px] text-t1 font-dm outline-none transition-all focus:border-primary-light focus:bg-white focus:shadow-[0_0_0_3px_rgba(43,95,168,0.1)] ${className}`}
      {...props}
    />
  )
}

export function Select({ id, className = '', children, ...props }) {
  return (
    <select
      id={id}
      className={`w-full bg-surface-2 border-[1.5px] border-border-2 rounded-btn px-3 py-2.5 text-[13.5px] text-t1 font-dm outline-none transition-all focus:border-primary-light focus:bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ id, className = '', ...props }) {
  return (
    <textarea
      id={id}
      className={`w-full bg-surface-2 border-[1.5px] border-border-2 rounded-btn px-3 py-2.5 text-[13.5px] text-t1 font-dm outline-none transition-all focus:border-primary-light focus:bg-white resize-y min-h-[80px] ${className}`}
      {...props}
    />
  )
}

export function FormRow({ children, cols = 2 }) {
  return (
    <div className={`grid gap-3 grid-cols-${cols}`}>
      {children}
    </div>
  )
}

export function FormGroup({ label, htmlFor, children, error }) {
  return (
    <div>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error && <p className="text-[11.5px] text-danger mt-1">{error}</p>}
    </div>
  )
}
