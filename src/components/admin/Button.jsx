'use client';

/**
 * دکمه‌ی مشترک پنل ادمین — یکسان‌سازی الگو و رادیوس ۶ پیکسل
 * variants: primary | secondary | danger | success | warning | outline | ghost
 * sizes: xs | sm | md | lg
 * همه‌ی رنگ‌ها از توکن‌های admin-scope خوانده می‌شوند تا در همه‌ی صفحات هارمونی داشته باشند.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  icon = null,
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-bold transition-all duration-200 ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ' +
    'active:scale-[0.97] whitespace-nowrap';

  const variantStyles = {
    primary: {
      background: 'var(--color-primary)',
      color: '#fff',
      border: '1px solid var(--color-primary)',
    },
    secondary: {
      background: 'var(--admin-card)',
      color: 'var(--admin-text)',
      border: '1px solid var(--admin-border)',
    },
    danger: {
      background: 'var(--admin-danger)',
      color: '#fff',
      border: '1px solid var(--admin-danger)',
    },
    success: {
      background: 'var(--admin-success)',
      color: '#fff',
      border: '1px solid var(--admin-success)',
    },
    warning: {
      background: 'var(--color-secondary)',
      color: '#1a1a1a',
      border: '1px solid var(--color-secondary)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-primary)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--admin-text-muted)',
      border: '1px solid transparent',
    },
  };

  const hoverClass = {
    primary: 'hover:bg-[var(--color-primary-hover)]',
    secondary: 'hover:bg-[var(--color-primary-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
    danger: 'hover:opacity-90',
    success: 'hover:opacity-90',
    warning: 'hover:opacity-90',
    outline: 'hover:bg-[var(--color-primary-soft)]',
    ghost: 'hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]',
  };

  const sizes = {
    xs: 'px-2.5 py-1.5 text-[11px] gap-1.5',
    sm: 'px-3.5 py-2 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-sm gap-2',
  };

  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${hoverClass[variant] || ''} ${className}`}
      style={{ ...variantStyles[variant], borderRadius: 'var(--admin-radius)' }}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>در حال پردازش…</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
