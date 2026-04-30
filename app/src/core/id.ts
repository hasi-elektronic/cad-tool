let n = 0;
export function uid(prefix = 'e'): string {
  n += 1;
  return `${prefix}_${Date.now().toString(36)}_${n.toString(36)}`;
}
