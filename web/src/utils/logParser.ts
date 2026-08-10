export function detectLogLevel(line: string): string {
  const upper = line.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('Exception') || upper.includes('FAILED')) return 'error';
  if (upper.includes('WARN')) return 'warn';
  if (upper.includes('DEBUG') || upper.includes('TRACE')) return 'debug';
  return 'info';
}

export function isStackTrace(line: string): boolean {
  return /^\s+at\s+/.test(line) || /^\s+... \d+ more/.test(line) || /^\s*Caused by:/.test(line);
}

export function highlightErrors(line: string): string {
  return line.replace(/(ERROR|FATAL|Exception)/gi, '<span class="text-error font-bold">$1</span>');
}

export function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return ts;
  }
}
