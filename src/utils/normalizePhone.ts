export function normalizePhone(input: string): string {
  if (!input) return "";
  let phone = input.replace(/\s+/g, "").replace(/^(\+385)/, "0");
  if (!phone.startsWith("0") && phone.length === 8) {
    phone = "0" + phone;
  }
  return phone;
}
