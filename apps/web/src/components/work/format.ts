export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}
