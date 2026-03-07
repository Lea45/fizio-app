export async function sendSmsInfobip(to: string, text: string): Promise<void> {
  const res = await fetch("/api/sendSms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`SMS failed (${res.status}): ${data?.error ?? res.statusText}`);
  }
}
