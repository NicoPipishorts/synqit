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
  const normalizedAppUrl = params.webAppUrl.replace(/\/+$/, '');
  const normalizedSiteUrl = (
    process.env.SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    params.webAppUrl
  ).replace(/\/+$/, '');
  const safeEmail = escapeHtml(params.recipientEmail);
  const safeSiteUrl = escapeHtml(normalizedSiteUrl);
  const safeLogoUrl = escapeHtml(`${normalizedAppUrl}/assets/logos/logo-full.png`);

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
                    <a href="${safeSiteUrl}" style="display:inline-block; text-decoration:none;">
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
                        href="${escapeHtml(normalizedAppUrl)}"
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
      subject: "Confirmation d'inscription Synqit",
      html: renderHtml({
        title: 'Bienvenue sur Synqit',
        intro: `Votre compte a bien &eacute;t&eacute; cr&eacute;&eacute; pour <strong>${safeEmail}</strong>.`,
        body: 'Vous pouvez maintenant cr&eacute;er vos playlists partag&eacute;es et inviter vos proches.',
        cta: 'Ouvrir Synqit',
        outro:
          "Si vous n'&ecirc;tes pas &agrave; l'origine de cette inscription, veuillez ignorer cet e-mail.",
      }),
      text:
        `Bienvenue sur Synqit.\n\n` +
        `Votre compte a bien été créé pour ${params.recipientEmail}.\n` +
        `Ouvrir Synqit: ${params.webAppUrl}\n\n` +
        `Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet e-mail.`,
    };
  }

  if (params.locale === 'es') {
    return {
      subject: 'Confirmación de registro en Synqit',
      html: renderHtml({
        title: 'Te damos la bienvenida a Synqit',
        intro: `Tu cuenta se ha creado correctamente para <strong>${safeEmail}</strong>.`,
        body: 'Ya puedes crear tus playlists compartidas e invitar a quien quieras.',
        cta: 'Abrir Synqit',
        outro: 'Si no has creado esta cuenta, puedes ignorar este correo sin problema.',
      }),
      text:
        `Te damos la bienvenida a Synqit.\n\n` +
        `Tu cuenta se ha creado correctamente para ${params.recipientEmail}.\n` +
        `Abrir Synqit: ${params.webAppUrl}\n\n` +
        `Si no has creado esta cuenta, puedes ignorar este correo sin problema.`,
    };
  }

  return {
    subject: 'Synqit registration confirmed',
    html: renderHtml({
      title: 'Welcome to Synqit',
      intro: `Your account has been created for <strong>${safeEmail}</strong>.`,
      body: 'You can now create shared playlists and invite friends and family.',
      cta: 'Open Synqit',
      outro: 'If you did not create this account, you can safely ignore this email.',
    }),
    text:
      `Welcome to Synqit.\n\n` +
      `Your account has been created for ${params.recipientEmail}.\n` +
      `Open Synqit: ${params.webAppUrl}\n\n` +
      `If you did not create this account, you can safely ignore this email.`,
  };
};
