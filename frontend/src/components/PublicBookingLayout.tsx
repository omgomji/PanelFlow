import Link from 'next/link';

interface PublicBookingMainProps {
  children: React.ReactNode;
  maxWidth?: '2xl' | '4xl' | '5xl' | '6xl';
  className?: string;
}

interface PublicBookingHeaderProps {
  backHref?: string;
  backLabel?: string;
  rightLabel?: string;
}

const widthClasses = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '2xl': 'max-w-2xl',
};

export function PanelFlowMark({ compact = false, href }: { compact?: boolean; href?: string }) {
  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center border-2 border-ink text-stamp -rotate-3">
        <span className="material-symbols-outlined text-[22px] font-bold">gavel</span>
      </span>
      {!compact && (
        <span className="font-display text-[21px] font-bold tracking-tight text-ink">PanelFlow</span>
      )}
    </>
  );

  if (!href) return <span className="inline-flex items-center gap-2 select-none">{content}</span>;

  return (
    <Link href={href} className="inline-flex items-center gap-2 select-none" aria-label="PanelFlow home">
      {content}
    </Link>
  );
}


export function PublicBookingHeader({
  backHref,
  backLabel,
  rightLabel,
}: PublicBookingHeaderProps) {
  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-clay/40 text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
              aria-label={backLabel || 'Go back'}
              title={backLabel || 'Go back'}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
          )}
          <PanelFlowMark />
        </div>

        {rightLabel && (
          <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50 sm:inline">
            {rightLabel}
          </span>
        )}
      </div>
    </header>
  );
}

export function PublicBookingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {children}
    </div>
  );
}

export function PublicBookingMain({
  children,
  maxWidth = '5xl',
  className = '',
}: PublicBookingMainProps) {
  return (
    <main className={`mx-auto w-full ${widthClasses[maxWidth]} px-4 py-8 sm:px-6 sm:py-10 ${className}`}>
      {children}
    </main>
  );
}

export function PublicStateCard({
  icon,
  title,
  message,
  tone = 'neutral',
}: {
  icon: string;
  title: string;
  message?: string;
  tone?: 'neutral' | 'danger';
}) {
  const toneClasses = tone === 'danger'
    ? 'border-oxblood bg-oxblood/5 text-oxblood'
    : 'border-ink bg-paper text-ink';

  return (
    <div className={`w-full max-w-md border-2 p-8 text-center shadow-[6px_6px_0_var(--accent-clay)] ${toneClasses}`}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border-2 border-current">
        <span className="material-symbols-outlined text-[26px]">{icon}</span>
      </div>
      <h1 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h1>
      {message && <p className="mt-2 text-sm text-ink/65">{message}</p>}
    </div>
  );
}

export function PublicLoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin border-2 border-clay/30 border-b-stamp" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">
          Loading
        </span>
      </div>
    </div>
  );
}
