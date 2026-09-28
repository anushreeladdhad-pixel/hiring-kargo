import { Resend } from 'resend';

let _client: Resend | null = null;

function client() {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      'Missing RESEND_API_KEY. Copy .env.example to .env.local and add your Resend key.'
    );
  }
  _client = new Resend(key);
  return _client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      'Missing RESEND_FROM_EMAIL. Set it to a verified sender/domain in your Resend account.'
    );
  }

  const { data, error } = await client().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data?.id ?? null;
}
