import type { EmailLocale } from '@synqit/shared';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const renderPasswordResetTemplate = (params: {
  locale: EmailLocale;
  webAppUrl: string;
  recipientEmail: string;
  resetToken: string;
}) => {
  const normalizedAppUrl = params.webAppUrl.replace(/\/+$/, '');
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeAppUrl = escapeHtml(normalizedAppUrl);
  const safeLogoUrl = escapeHtml(`${normalizedAppUrl}/assets/logos/logo-full.png`);
  const resetUrl = `${normalizedAppUrl}/auth/reset-password?token=${encodeURIComponent(params.resetToken)}`;
  const safeResetUrl = escapeHtml(resetUrl);

  const renderHtml = (content: {
    title: string;
    intro: string;
    body: string;
    cta: string;
    outro: string;
  }): string =>
    `
      <div style="margin:0; padding:0; width:100%; background:#f4f6f8;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8; width:100%;">
          <tr>
            <td align="center" style="padding:28px 12px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border:1px solid #d8dee4; border-radius:16px; overflow:hidden;">
                <tr>
                  <td align="center" style="padding:24px 24px 10px 24px;">
                    <a href="${safeAppUrl}" style="display:inline-block; text-decoration:none;">
                      <img src="${safeLogoUrl}" alt="Synqit" width="170" style="display:block; width:170px; max-width:100%; height:auto; border:0;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 24px 24px 24px; font-family: Arial, sans-serif; color:#111827; line-height:1.5; text-align:center;">
                    <h1 style="margin:0 0 12px 0; font-size:24px; line-height:1.25; font-weight:800; color:#111827; text-align:center;">${content.title}</h1>
                    <p style="margin:0 0 10px 0; font-size:15px;">${content.intro}</p>
                    <p style="margin:0 0 20px 0; font-size:15px;">${content.body}</p>
                    <p style="margin:0 0 24px 0; text-align:center;">
                      <a
                        href="${safeResetUrl}"
                        style="display:inline-block; background:#91f034; border:1px solid #7ecb2d; color:#111827; text-decoration:none; font-weight:800; font-size:14px; padding:11px 16px; border-radius:10px;"
                      >
                        ${content.cta}
                      </a>
                    </p>
                    <p style="margin:0; color:#6b7280; font-size:13px;">${content.outro}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `.trim();

  if (params.locale === 'fr') {
    return {
      subject: 'Reinitialisation de votre mot de passe Synqit',
      html: renderHtml({
        title: 'Reinitialisez votre mot de passe',
        intro: `Une demande de reinitialisation a ete recue pour <strong>${safeEmail}</strong>.`,
        body: 'Utilisez le bouton ci-dessous pour definir un nouveau mot de passe.',
        cta: 'Reinitialiser le mot de passe',
        outro:
          "Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet e-mail en toute securite.",
      }),
      text:
        `Une demande de reinitialisation de mot de passe a ete recue pour ${params.recipientEmail}.\n\n` +
        `Reinitialiser votre mot de passe: ${resetUrl}\n\n` +
        `Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer cet e-mail en toute securite.`,
    };
  }

  return {
    subject: 'Reset your Synqit password',
    html: renderHtml({
      title: 'Reset your password',
      intro: `A password reset request was received for <strong>${safeEmail}</strong>.`,
      body: 'Use the button below to set a new password.',
      cta: 'Reset password',
      outro: 'If you did not request this, you can safely ignore this email.',
    }),
    text:
      `A password reset request was received for ${params.recipientEmail}.\n\n` +
      `Reset your password: ${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email.`,
  };
};
