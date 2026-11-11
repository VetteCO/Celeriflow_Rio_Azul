import { Resend } from "resend";

// POC-08 outbound. Inbound chega em /api/email/inbound (webhook).
export async function sendProcessEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyToken: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.EMAIL_FROM!;
  // replyTo tokenizado permite rotear a resposta ao processo correto.
  const replyTo = from.replace("@", `+${opts.replyToken}@`);
  return resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo
  });
}
