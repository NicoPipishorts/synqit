import type { EmailLocale } from '@synqit/shared';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const renderRegistrationConfirmationTemplate = (params: {
  locale: EmailLocale;
  webAppUrl: string;
  recipientEmail: string;
}) => {
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeAppUrl = escapeHtml(params.webAppUrl);

  if (params.locale === 'fr') {
    return {
      subject: "Confirmation d'inscription Synqit",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
          <h1 style="margin-bottom: 12px;">Bienvenue sur Synqit</h1>
          <p>Votre compte a bien été créé pour <strong>${safeEmail}</strong>.</p>
          <p>Vous pouvez maintenant créer vos playlists partagées et inviter vos proches.</p>
          <p style="margin: 24px 0;">
            <a
              href="${safeAppUrl}"
              style="display: inline-block; background: #91f034; color: #111827; text-decoration: none; font-weight: 700; padding: 10px 14px; border-radius: 8px;"
            >
              Ouvrir Synqit
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            Si vous n'êtes pas à l'origine de cette inscription, veuillez ignorer cet e-mail.
          </p>
        </div>
      `.trim(),
      text:
        `Bienvenue sur Synqit.\n\n` +
        `Votre compte a bien été créé pour ${params.recipientEmail}.\n` +
        `Ouvrir Synqit: ${params.webAppUrl}\n\n` +
        `Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.`,
    };
  }

  return {
    subject: 'Synqit registration confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h1 style="margin-bottom: 12px;">Welcome to Synqit</h1>
        <p>Your account has been created for <strong>${safeEmail}</strong>.</p>
        <p>You can now create shared playlists and invite friends and family.</p>
        <p style="margin: 24px 0;">
          <a
            href="${safeAppUrl}"
            style="display: inline-block; background: #91f034; color: #111827; text-decoration: none; font-weight: 700; padding: 10px 14px; border-radius: 8px;"
          >
            Open Synqit
          </a>
        </p>
        <p style="color: #6b7280; font-size: 13px;">
          If you did not create this account, you can safely ignore this email.
        </p>
      </div>
    `.trim(),
    text:
      `Welcome to Synqit.\n\n` +
      `Your account has been created for ${params.recipientEmail}.\n` +
      `Open Synqit: ${params.webAppUrl}\n\n` +
      `If you did not create this account, you can safely ignore this email.`,
  };
};
