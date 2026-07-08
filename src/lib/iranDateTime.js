const IRAN_OFFSET_MINUTES = 3.5 * 60;

// Iran Standard Time is fixed at UTC+03:30 all year.
export function parseIranDateTimeLocal(value) {
  if (!value) return null;

  const str = String(value).trim();
  if (!str) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  const withSeconds = /T\d{2}:\d{2}$/.test(str) ? `${str}:00` : str;
  const d = new Date(`${withSeconds}+03:30`);
  return isNaN(d.getTime()) ? null : d;
}

export function formatIranDateTimeLocal(date) {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const iranDate = new Date(d.getTime() + IRAN_OFFSET_MINUTES * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = iranDate.getUTCFullYear();
  const mm = pad(iranDate.getUTCMonth() + 1);
  const dd = pad(iranDate.getUTCDate());
  const hh = pad(iranDate.getUTCHours());
  const mi = pad(iranDate.getUTCMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
