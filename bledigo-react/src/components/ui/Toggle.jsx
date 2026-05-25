export default function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={`relative w-9 h-5 rounded-full border-none outline-none cursor-pointer transition-colors duration-200 shrink-0 ${
        checked ? 'bg-success' : 'bg-border-2'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
          checked ? 'left-[18px]' : 'left-[2px]'
        }`}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
      />
    </button>
  )
}