import { MapPin, Calendar, MessageSquare, ThumbsUp } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

const statusMap = {
  'En cours':   'progress',
  'En attente': 'pending',
  'Resolue':    'resolved',
  'Critique':   'urgent',
}

export default function ReclamationCard({ rec, onVote, onDetail, voted = false, showActions = true }) {
  return (
    <div className="bg-white border border-border rounded-card overflow-hidden transition-shadow hover:shadow-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[12px] font-bold text-t3">#{rec.id}</span>
              <Badge status={statusMap[rec.status] ?? 'pending'}>{rec.status}</Badge>
              <span className="text-[11.5px] font-medium px-2 py-0.5 rounded bg-muted text-t2 border border-border">{rec.cat}</span>
            </div>
            <h3 className="font-syne text-[15px] font-bold text-t1 leading-snug">{rec.title}</h3>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {rec.loc && (
                <span className="flex items-center gap-1 text-[12px] text-t3">
                  <MapPin size={12} /> {rec.loc}
                </span>
              )}
              <span className="flex items-center gap-1 text-[12px] text-t3">
                <Calendar size={12} /> {rec.date}
              </span>
            </div>
          </div>
          {/* Vote */}
          <div className="text-center shrink-0">
            <button
              onClick={() => onVote?.(rec.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] text-[12.5px] font-semibold transition-all ${
                voted || rec.voted
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-white border-border-2 text-t2 hover:border-primary hover:text-primary'
              }`}
            >
              <ThumbsUp size={13} />
              <span>{rec.votes}</span>
            </button>
            <p className="text-[11px] text-t3 mt-1">soutiens</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-3">
        <p className="text-[13.5px] text-t2 leading-relaxed line-clamp-2">{rec.desc}</p>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-surface-2/50 border-t border-border flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[12.5px] text-t3">
          <MessageSquare size={13} />
          {rec.comments?.length ?? 0} commentaire{(rec.comments?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        {showActions && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onDetail?.(rec.id)}>
              Voir détails &amp; commenter
            </Button>
            <Button variant="primary" size="sm" className="ml-auto">
              + Soutenir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
