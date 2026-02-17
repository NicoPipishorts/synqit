const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';
type EmailProvider = 'log' | 'resend' | 'disabled';

type SendTransactionalEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const parseProvider = (): EmailProvider => {
  const raw = (process.env.EMAIL_PROVIDER ?? 'log').trim().toLowerCase();
  if (raw === 'resend' || raw === 'disabled') {
    return raw;
  }
  return 'log';
};

const readEmailConfig = (): {
  provider: EmailProvider;
  fromAddress: string;
  replyTo: string | undefined;
} => ({
  provider: parseProvider(),
  fromAddress: process.env.EMAIL_FROM ?? 'Synqit <no-reply@synqit.local>',
  replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
});

const sendViaResend = async (
  params: SendTransactionalEmailParams,
  config: {
    fromAddress: string;
    replyTo: string | undefined;
  },
): Promise<void> => {
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
      from: config.fromAddress,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: config.replyTo,
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
  const config = readEmailConfig();

  // Read provider config at send-time so values loaded from .env/.env.local
  // in the worker entrypoint are respected.
  if (config.provider === 'disabled') {
    return;
  }

  if (config.provider === 'resend') {
    await sendViaResend(params, {
      fromAddress: config.fromAddress,
      replyTo: config.replyTo,
    });
    return;
  }

  console.info('[worker] email log transport', {
    provider: config.provider,
    from: config.fromAddress,
    replyTo: config.replyTo,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
};
