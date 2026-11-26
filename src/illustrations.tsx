/**
 * 空状态插图。
 *
 * 手写 SVG：跟随主题变量着色、不增加网络请求、任意尺寸都清晰。
 * 统一 96×96 画布，通过 className="empty-art" 由样式控制尺寸。
 */

const ART = 'empty-art'

export function EmptyMatches({ className = ART }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 96" role="img" aria-hidden="true">
    <rect x="12" y="24" width="40" height="56" rx="7" fill="var(--card-alt)" stroke="var(--rule)" strokeWidth="1.6" />
    <rect x="26" y="16" width="42" height="58" rx="7" fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="1.6" />
    <path d="M47 29 L52.5 41.5 L65 47 L52.5 52.5 L47 65 L41.5 52.5 L29 47 L41.5 41.5 Z" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M70 20 v13 M63.5 26.5 h13" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
    <circle cx="74" cy="56" r="2.4" fill="var(--gold)" opacity="0.5" />
  </svg>
}

export function EmptyArchive({ className = ART }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 96" role="img" aria-hidden="true">
    <rect x="20" y="24" width="46" height="10" rx="5" fill="var(--card-alt)" stroke="var(--rule)" strokeWidth="1.4" />
    <rect x="16" y="34" width="58" height="10" rx="5" fill="var(--card-alt)" stroke="var(--rule)" strokeWidth="1.4" />
    <rect x="12" y="44" width="66" height="36" rx="8" fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="1.6" />
    <path d="M24 57 h30" stroke="var(--rule-strong)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M24 66 h20" stroke="var(--rule)" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="66" cy="64" r="9" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.4" />
    <path d="M66 59 v5 l3.5 2" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
}

export function EmptyStats({ className = ART }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 96" role="img" aria-hidden="true">
    <rect x="14" y="18" width="68" height="60" rx="10" fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="1.6" />
    <path d="M22 68 h52" stroke="var(--rule)" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="25" y="52" width="9" height="16" rx="3.5" fill="var(--rule)" />
    <rect x="39" y="44" width="9" height="24" rx="3.5" fill="var(--rule-strong)" />
    <rect x="53" y="36" width="9" height="32" rx="3.5" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.2" />
    <rect x="67" y="27" width="9" height="41" rx="3.5" fill="var(--brand)" />
    <path d="M26 34 l12-6 l11 4 l13-9" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
  </svg>
}

export function EmptySearch({ className = ART }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 96" role="img" aria-hidden="true">
    <rect x="16" y="16" width="42" height="58" rx="7" fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="1.6" />
    <path d="M25 32 h24 M25 43 h24 M25 54 h13" stroke="var(--rule)" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="64" cy="56" r="15" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="2.6" />
    <path d="M75 67 l10 10" stroke="var(--brand)" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M59 51 l3.5 3.5 l6.5-7" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
}

export function EmptyPhoto({ className = ART }: { className?: string }) {
  return <svg className={className} viewBox="0 0 96 96" role="img" aria-hidden="true">
    <rect x="14" y="24" width="68" height="52" rx="9" fill="var(--card)" stroke="var(--rule-strong)" strokeWidth="1.6" />
    <circle cx="34" cy="42" r="6" fill="var(--gold-bg)" stroke="var(--gold)" strokeWidth="1.5" />
    <path d="M18 68 l18-20 l13 14 l11-10 l18 16" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
    <rect x="30" y="14" width="36" height="10" rx="5" fill="var(--card-alt)" stroke="var(--rule)" strokeWidth="1.4" />
  </svg>
}
