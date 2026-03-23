export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-5 py-2.5 rounded-[10px] text-white text-sm font-medium shadow-modal animate-fade-up whitespace-nowrap ${
            t.type === 'ok'  ? 'bg-success' :
            t.type === 'err' ? 'bg-danger'  : 'bg-t1'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
