import { forwardRef } from 'react';

/** A single consistent panel shape used everywhere instead of ad-hoc cards. */
export function Panel({ children, className = '', tight, lg, notched, flush, ...rest }) {
  const cls = [
    'hud-panel',
    tight && 'hud-panel--tight',
    lg && 'hud-panel--lg',
    notched && 'hud-panel--notched',
    flush && 'hud-panel--flush',
    className,
  ].filter(Boolean).join(' ');
  return <div className={cls} {...rest}>{children}</div>;
}

export function Eyebrow({ icon, children }) {
  return (
    <div className="hud-eyebrow">
      {icon && <span className="hud-icon">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

export const Button = forwardRef(function Button(
  { variant = 'default', size, block, className = '', children, ...rest },
  ref
) {
  const cls = [
    'hud-btn',
    variant === 'primary' && 'hud-btn--primary',
    variant === 'danger' && 'hud-btn--danger',
    variant === 'ghost' && 'hud-btn--ghost',
    size === 'sm' && 'hud-btn--sm',
    size === 'lg' && 'hud-btn--lg',
    block && 'hud-btn--block',
    className,
  ].filter(Boolean).join(' ');
  return <button ref={ref} className={cls} {...rest}>{children}</button>;
});

/** HP/XP style stat bar. value/max define fill %, color picks the bar tint. */
export function StatBar({ label, value, max = 100, color = 'gold', suffix }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="hud-stat-row">
      {label && <span className="hud-stat-label">{label}</span>}
      <div className="hud-bar-track">
        <div className={`hud-bar-fill hud-bar-fill--${color}`} style={{ width: `${pct}%` }} />
      </div>
      {suffix !== undefined && <span className="hud-stat-label" style={{ width: 'auto', textAlign: 'right' }}>{suffix}</span>}
    </div>
  );
}

/** Status / severity / category tag — color comes from currentColor via inline `color`. */
export function Tag({ color, children }) {
  return (
    <span className="hud-tag" style={{ color }}>
      <span className="hud-tag-dot" />
      {children}
    </span>
  );
}

/** The one clickable "quest item" card shape — feed items, mission rows, tickets. */
export const QuestCard = forwardRef(function QuestCard(
  { accentColor, className = '', children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`hud-card ${className}`}
      style={{ borderLeftColor: accentColor || 'var(--hud-border)' }}
      {...rest}
    >
      {children}
    </div>
  );
});

export function EmptyState({ icon, title, action }) {
  return (
    <div className="hud-empty">
      {icon && <div className="hud-icon">{icon}</div>}
      <p className="font-pixel" style={{ fontSize: '0.65rem' }}>{title}</p>
      {action && <div style={{ marginTop: 'var(--space-4)' }}>{action}</div>}
    </div>
  );
}

export function PageShell({ title, subtitle, children, wide }) {
  return (
    <div className="hud-page" style={wide ? { maxWidth: '1520px' } : undefined}>
      {title && <h1 className="hud-page-title">{title}</h1>}
      {subtitle && <p className="hud-page-subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}
