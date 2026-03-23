import { useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

// ── Filter chip ───────────────────────────────────────────
export function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition-all shrink-0 ${
        active
          ? 'bg-primary text-white shadow-sm'
          : 'bg-white text-t2 border border-border hover:border-primary-light hover:text-primary'
      }`}>
      {label}
    </button>
  )
}

// ── Select filter ─────────────────────────────────────────
export function FilterSelect({ value, onChange, options, placeholder = 'Tous' }) {
  return (
    <div className="relative">
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-border rounded-[9px] pl-3 pr-8 py-2 text-[12.5px] text-t1 font-dm outline-none hover:border-primary-light transition-colors cursor-pointer">
        <option value="">{placeholder}</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none"/>
    </div>
  )
}

// ── Search input ──────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className = '' }) {
  return (
    <div className={`flex items-center gap-2 bg-white border border-border rounded-[9px] px-3 py-2 ${className}`}>
      <Search size={13} className="text-t3 shrink-0"/>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-[13px] text-t1 w-full placeholder:text-t3 font-dm min-w-0"/>
      {value && (
        <button onClick={() => onChange('')} className="text-t3 hover:text-t1 shrink-0">
          <X size={12}/>
        </button>
      )}
    </div>
  )
}

// ── Full filter bar ───────────────────────────────────────
export default function FilterBar({
  search, onSearch,
  chips = [],           // [{ label, value }]
  activeChip, onChip,
  selects = [],         // [{ value, onChange, options, placeholder }]
  count,                // result count
  countLabel = 'résultats',
  right,                // extra right content
  className = '',
}) {
  return (
    <div className={`bg-white border border-border rounded-card px-4 py-3 flex flex-wrap gap-3 items-center ${className}`}>
      {search !== undefined && (
        <SearchInput
          value={search} onChange={onSearch}
          className="flex-1 min-w-[160px]"
          placeholder="Rechercher…"
        />
      )}
      {chips.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {chips.map(c => (
            <FilterChip key={c.value} label={c.label} active={activeChip === c.value} onClick={() => onChip(c.value)}/>
          ))}
        </div>
      )}
      {selects.map((s, i) => (
        <FilterSelect key={i} {...s}/>
      ))}
      {count != null && (
        <span className="text-[12px] text-t3 ml-auto shrink-0 font-medium">
          {count} {countLabel}
        </span>
      )}
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
