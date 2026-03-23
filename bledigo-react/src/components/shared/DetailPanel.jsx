import { X, CheckCircle, RefreshCw } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ProgressBar from '../ui/ProgressBar'

const statusMap   = { 'En cours':'progress','En attente':'pending','Resolue':'resolved','Critique':'urgent' }
const progressMap = { 'En attente':25,'En cours':60,'Critique':15,'Resolue':100 }

const TIMELINE = [
  { label:'Réclamation soumise',       key:'submitted'  },
  { label:'Affectée à un agent',       key:'assigned'   },
  { label:'En cours d\'intervention',  key:'inprogress' },
  { label:'Résolution confirmée',      key:'resolved'   },
]

// Safe helpers — never crash on objects or undefined
function safeStr(val, fallback = '—') {
  if (val == null)                 return fallback
  if (typeof val === 'string')     return val || fallback
  if (typeof val === 'number')     return String(val)
  // Object — try common patterns
  if (val.firstName || val.lastName)
    return `${val.firstName || ''} ${val.lastName || ''}`.trim() || fallback
  if (val.level)  return val.level
  if (val.name)   return val.name
  if (val.text)   return val.text
  return fallback
}

export default function DetailPanel({ rec, open, onClose, onResolve, onReassign, onStatusChange }) {
  if (!rec) return null

  const progress  = progressMap[rec.status] ?? 25
  const stepsDone = progress === 100 ? 4 : progress >= 60 ? 3 : progress >= 25 ? 2 : 1

  // Safe field extraction
  const citizenName  = safeStr(rec.citizen)
  const agentName    = safeStr(rec.assignedAgent || rec.agent)
  const categoryName = safeStr(rec.category || rec.cat)
  const urgencyText  = safeStr(rec.urgency?.level || rec.urgency || rec.urg, 'Normal')
  const recId        = String(rec._id || rec.id || rec.ref || '—').slice(-6)
  const recDate      = safeStr(rec.date || (rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('fr-FR') : null))
  const recDesc      = safeStr(rec.description || rec.desc, 'Aucune description disponible.')

  return (
    <>
      {open && <div className="fixed inset-0 bg-t1/20 z-40" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 w-[460px] max-w-[96vw] h-screen bg-white overflow-y-auto custom-scroll transition-transform duration-300 shadow-modal ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 41 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white sticky top-0 z-10">
          <h2 className="font-syne text-base font-bold text-t1 truncate pr-3">
            #{recId} — {safeStr(rec.title)}
          </h2>
          <button onClick={onClose} className="text-t3 hover:text-t2 transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={statusMap[rec.status] ?? 'pending'}>{rec.status}</Badge>
            <span className="text-[12px] text-t3">📅 {recDate}</span>
            {categoryName !== '—' && <span className="text-[12px] text-t3">🏷 {categoryName}</span>}
            {(rec.late || rec.isOverdue) && <Badge status="urgent">Hors délai</Badge>}
          </div>

          {/* Description */}
          <div className="bg-surface-2 rounded-[10px] p-3.5 text-[13.5px] text-t1 leading-relaxed">
            {recDesc}
          </div>

          {/* Info grid — all values are safe strings */}
          <div className="grid grid-cols-2 gap-2.5 text-[13px]">
            {[
              ['Citoyen',      citizenName],
              ['Agent assigné', agentName],
              ['Catégorie',    categoryName],
              ['Urgence IA',   urgencyText],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface-2 rounded-[8px] p-2.5">
                <div className="text-[11px] text-t3 mb-0.5">{k}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-[12.5px] mb-1.5">
              <span className="text-t2">Progression</span>
              <span className="font-bold">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>

          {/* Timeline */}
          <div>
            <h3 className="font-syne text-[13px] font-bold mb-3">Timeline</h3>
            <div className="flex flex-col">
              {TIMELINE.map((step, i) => {
                const done   = i < stepsDone
                const active = i === stepsDone - 1 && progress < 100
                return (
                  <div key={i} className="flex gap-3 pb-4 relative">
                    {i < TIMELINE.length - 1 && (
                      <div className="absolute left-[11px] top-[22px] bottom-0 w-px bg-border" />
                    )}
                    <div className={`w-[22px] h-[22px] rounded-full shrink-0 flex items-center justify-center border-2 border-white ${
                      progress === 100 ? 'bg-success' : done && active ? 'bg-primary' : done ? 'bg-success' : 'bg-border-2'
                    }`}>
                      {done && <CheckCircle size={10} className="text-white fill-white" />}
                    </div>
                    <div className="pt-0.5">
                      <div className={`text-[13px] font-medium ${!done && !active ? 'text-t3' : 'text-t1'}`}>
                        {step.label}
                      </div>
                      <div className="text-[11.5px] text-t3">{done ? recDate : 'En attente'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status change */}
          <div>
            <label className="block text-[11.5px] font-semibold text-t2 uppercase tracking-[0.05em] mb-1.5">
              Changer le statut
            </label>
            <select
              className="w-full bg-surface-2 border-[1.5px] border-border-2 rounded-btn px-3 py-2.5 text-[13.5px] text-t1 font-dm outline-none"
              defaultValue={rec.status}
              onChange={e => onStatusChange?.(rec._id || rec.id, e.target.value)}
            >
              <option>En attente</option>
              <option>En cours</option>
              <option>Resolue</option>
              <option>Critique</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="success" className="flex-1" onClick={() => onResolve?.(rec._id || rec.id)}>
              <CheckCircle size={14} /> Marquer résolue
            </Button>
            <Button variant="accent" className="flex-1" onClick={() => onReassign?.(rec._id || rec.id)}>
              <RefreshCw size={14} /> Réaffecter
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
