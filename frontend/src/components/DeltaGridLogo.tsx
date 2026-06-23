interface DeltaGridLogoProps {
  className?: string;
  title?: string;
}

export function DeltaGridLogo({ className, title = 'DeltaGrid' }: DeltaGridLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <rect width="32" height="32" rx="7" fill="url(#dg-logo-bg)" />
      <g stroke="#7dd3fc" strokeOpacity="0.48" strokeWidth="0.85">
        <path d="M5 11h22M5 16h22M5 21h22" />
        <path d="M10 7v18M16 7v18M22 7v18" />
      </g>
      <path
        d="M16 9.5 23.5 22.5H8.5L16 9.5Z"
        fill="url(#dg-logo-delta)"
        stroke="#020617"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="dg-logo-bg" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="dg-logo-delta" x1="16" y1="9.5" x2="16" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
    </svg>
  );
}
