const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';

type SendTransactionalEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const parseProvider = (): 'log' | 'resend' | 'disabled' => {
  const raw = (process.env.EMAIL_PROVIDER ?? 'log').trim().toLowerCase();
  if (raw === 'resend' || raw === 'disabled') {
    return raw;
  }
  return 'log';
};

const provider = parseProvider();
const fromAddress = process.env.EMAIL_FROM ?? 'Synqit <no-reply@synqit.local>';
const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

const sendViaResend = async (params: SendTransactionalEmailParams): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing while EMAIL_PROVIDER=resend.');
  }

  const response = await fetch(DEFAULT_RESEND_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Resend email failed with status ${response.status}: ${payload}`);
  }
};

export const sendTransactionalEmail = async (
  params: SendTransactionalEmailParams,
): Promise<void> => {
  if (provider === 'disabled') {
    return;
  }

  if (provider === 'resend') {
    await sendViaResend(params);
    return;
  }

  console.info('[worker] email log transport', {
    provider: 'log',
    from: fromAddress,
    replyTo,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
};
