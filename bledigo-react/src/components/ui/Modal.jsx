import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-[500px]', lg: 'max-w-2xl' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-t1/45"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`bg-white rounded-2xl w-full ${widths[size]} mx-4 shadow-modal max-h-[90vh] overflow-y-auto animate-fade-up`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="font-syne text-base font-bold text-t1">{title}</h2>
          <button
            onClick={onClose}
            className="text-t3 hover:text-t2 transition-colors p-0.5 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-3.5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
