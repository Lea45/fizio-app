import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const CORS_ORIGINS = [
  "https://fizio-ea9f6.web.app",
  "https://fizio-ea9f6.firebaseapp.com",
];

function toE164(phoneRaw: string, defaultCountryCode = "+385"): string {
  let p = phoneRaw.trim();
  if (p.startsWith("+")) return "+" + p.slice(1).replace(/\D/g, "");
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("00385")) return "+385" + digits.slice(5);
  if (digits.startsWith("385")) return "+385" + digits.slice(3);
  if (digits.startsWith("0")) return defaultCountryCode + digits.slice(1);
  if (digits.length >= 8 && digits.length <= 10) return defaultCountryCode + digits;
  return defaultCountryCode + digits;
}

export const sendSms = onRequest(
  {
    region: "europe-west1",
    cors: CORS_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { to, text } = req.body as { to?: string; text?: string };

    if (!to || !text) {
      res.status(400).json({ error: "Missing required fields: to, text" });
      return;
    }

    const baseUrl = process.env.INFOBIP_BASE_URL;
    const apiKey = process.env.INFOBIP_API_KEY;
    const from = process.env.INFOBIP_SMS_FROM;

    if (!baseUrl || !apiKey || !from) {
      console.error("Infobip env vars missing");
      res.status(500).json({ error: "SMS service not configured" });
      return;
    }

    const toPhone = toE164(to);
    const fromPhone = toE164(from);
    const url = `${baseUrl.replace(/\/$/, "")}/sms/2/text/advanced`;

    const payload = {
      messages: [
        {
          from: fromPhone,
          destinations: [{ to: toPhone }],
          text,
        },
      ],
    };

    try {
      const infobipRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `App ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = infobipRes.headers.get("content-type") || "";
      let data: unknown = null;

      if (contentType.includes("application/json")) {
        data = await infobipRes.json();
      } else {
        data = { raw: await infobipRes.text() };
      }

      if (!infobipRes.ok) {
        const d = data as any;
        const errMsg =
          d?.requestError?.serviceException?.text ||
          d?.requestError?.serviceException?.messageId ||
          JSON.stringify(data);
        console.error("Infobip error:", errMsg);
        res.status(infobipRes.status).json({ error: errMsg });
        return;
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error("sendSms error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
