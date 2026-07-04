export function normalizePhone(input: string): string {
  if (!input) return "";
  const digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("00385")) return "0" + digits.slice(5);
  if (digits.startsWith("385")) return "0" + digits.slice(3);
  return digits;
}
