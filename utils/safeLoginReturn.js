// Login callbacks must stay on this site. Preserve the encoded OAuth query
// verbatim so state and PKCE survive both password and Google sign-in.
export function safeLoginReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  try {
    const base = 'https://login-return.invalid';
    if (new URL(value, base).origin !== base) return '/';
    return value;
  } catch { return '/'; }
}
