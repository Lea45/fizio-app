function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+385" + digits.slice(1);
  if (digits.startsWith("385")) return "+" + digits;
  if (digits.startsWith("+")) return phone.replace(/\s/g, "");
  return "+" + digits;
}

export async function sendSmsInfobip(to: string, text: string): Promise<void> {
  const apiKey = import.meta.env.VITE_INFOBIP_API_KEY;
  const baseUrl = import.meta.env.VITE_INFOBIP_BASE_URL;
  const from = import.meta.env.VITE_INFOBIP_SMS_FROM;

  const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ from, destinations: [{ to: toE164(to) }], text }],
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`SMS failed (${res.status}): ${JSON.stringify(data)}`);
  }
}
