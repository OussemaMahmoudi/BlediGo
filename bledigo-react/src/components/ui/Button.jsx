const variants = {
  primary: 'bg-primary text-white hover:shadow-btn-primary',
  accent:  'bg-accent  text-white hover:shadow-btn-accent',
  outline: 'bg-white   text-t2    border border-border-2',
  ghost:   'bg-transparent text-t3 hover:bg-muted hover:text-t2',
  danger:  'bg-danger-light text-danger',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2   text-sm rounded-btn gap-1.5',
  lg: 'px-5 py-2.5 text-sm rounded-btn gap-2',
}

export default function Button({
  children,
  variant = 'primary',
  size    = 'md',
  className = '',
  disabled,
  onClick,
  type = 'button',
  full = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center font-semibold cursor-pointer border-none font-dm',
        'transition-all duration-150 hover:-translate-y-px active:translate-y-0',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        full ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
