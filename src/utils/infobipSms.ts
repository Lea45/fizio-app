// src/utils/infobipSms.ts

type InfobipSmsResponse = any;

function toE164(phoneRaw: string, defaultCountryCode = "+385"): string {
  // Ukloni sve osim znamenki i +
  let p = phoneRaw.trim();

  // Ako već ima +, samo očisti razmake/crtice
  if (p.startsWith("+")) {
    return "+" + p.slice(1).replace(/\D/g, "");
  }

  // Samo znamenke
  const digits = p.replace(/\D/g, "");

  // 00385xxxx -> +385xxxx
  if (digits.startsWith("00385")) return "+385" + digits.slice(5);

  // 385xxxx -> +385xxxx
  if (digits.startsWith("385")) return "+385" + digits.slice(3);

  // 0xxxxxxxxx -> +385xxxxxxxxx
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);

  // Ako je već bez 0 (npr. 91xxxxxxx), dodaj +385
  // (ovo je fallback – koristi samo ako ste sigurni da su HR brojevi)
  if (digits.length >= 8 && digits.length <= 10)
    return defaultCountryCode + digits;

  // zadnji fallback: vrati kako je (možda je već kompletan broj bez +)
  return defaultCountryCode + digits;
}

export async function sendSmsInfobip(
  to: string,
  text: string
): Promise<InfobipSmsResponse> {
  const baseUrl = import.meta.env.VITE_INFOBIP_BASE_URL as string | undefined;
  const apiKey = import.meta.env.VITE_INFOBIP_API_KEY as string | undefined;
  const from = import.meta.env.VITE_INFOBIP_SMS_FROM as string | undefined;

  if (!baseUrl || !apiKey || !from) {
    throw new Error(
      "Infobip SMS config missing. Provjeri .env: VITE_INFOBIP_BASE_URL, VITE_INFOBIP_API_KEY, VITE_INFOBIP_SMS_FROM"
    );
  }

  const toE164Phone = toE164(to);
  const fromE164Phone = toE164(from); // da bude sigurno +...

  const url = `${baseUrl.replace(/\/$/, "")}/sms/2/text/advanced`;

  const payload = {
    messages: [
      {
        from: fromE164Phone,
        destinations: [{ to: toE164Phone }],
        text,
      },
    ],
  };

  console.log("INFOBIP SMS REQUEST:", {
    url,
    from: fromE164Phone,
    to: toE164Phone,
    text,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Infobip često vraća JSON i kad je error – pa prvo probaj JSON, pa fallback na text
  let data: any = null;
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const t = await res.text();
      data = { raw: t };
    }
  } catch (e) {
    // fallback ako parsing pukne
    const t = await res.text().catch(() => "");
    data = { raw: t };
  }

  console.log("INFOBIP SMS RESPONSE:", {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    data,
  });

  if (!res.ok) {
    // Pokaži korisnu poruku (Infobip često vraća requestError/serviceException)
    const errMsg =
      data?.requestError?.serviceException?.text ||
      data?.requestError?.serviceException?.messageId ||
      data?.requestError?.serviceException?.validationErrors?.[0]?.message ||
      JSON.stringify(data);

    throw new Error(`Infobip SMS failed (${res.status}): ${errMsg}`);
  }

  return data;
}
