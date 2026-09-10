import type { EmailLocale, WeeklyRecapPlaylist, WeeklyRecapPlaylistKind } from '@synqit/shared';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

type Copy = {
  subject: string;
  title: string;
  intro: (totalNewTracks: number, windowDays: number) => string;
  groupLabels: Record<WeeklyRecapPlaylistKind, string>;
  songs: (count: number) => string;
  cta: string;
  outro: string;
};

const COPY: Record<EmailLocale, Copy> = {
  en: {
    subject: 'Your Synqit weekly recap',
    title: 'New songs on your playlists',
    intro: (total, days) =>
      `${total} new ${total === 1 ? 'song was' : 'songs were'} added across the playlists you follow in the last ${days} days.`,
    groupLabels: {
      owned_sync: 'Synced playlists you own',
      subscribed_sync: 'Synced playlists you follow',
      hosted_event: 'Event playlists you host',
      followed_event: 'Event playlists you follow',
    },
    songs: (count) => `${count} new ${count === 1 ? 'song' : 'songs'}`,
    cta: 'Open Synqit',
    outro: 'You receive this recap because you own or follow active playlists on Synqit.',
  },
  fr: {
    subject: 'Votre recap hebdomadaire Synqit',
    title: 'Nouveaux titres sur vos playlists',
    intro: (total, days) =>
      `${total} ${total === 1 ? 'nouveau titre a ete ajoute' : 'nouveaux titres ont ete ajoutes'} sur les playlists que vous suivez ces ${days} derniers jours.`,
    groupLabels: {
      owned_sync: 'Playlists synchronisees que vous possedez',
      subscribed_sync: 'Playlists synchronisees que vous suivez',
      hosted_event: 'Playlists evenement que vous hebergez',
      followed_event: 'Playlists evenement que vous suivez',
    },
    songs: (count) => `${count} ${count === 1 ? 'nouveau titre' : 'nouveaux titres'}`,
    cta: 'Ouvrir Synqit',
    outro: 'Vous recevez ce recap car vous possedez ou suivez des playlists actives sur Synqit.',
  },
  es: {
    subject: 'Tu resumen semanal de Synqit',
    title: 'Canciones nuevas en tus playlists',
    intro: (total, days) =>
      `${total === 1 ? 'Se ha añadido 1 canción nueva' : `Se han añadido ${total} canciones nuevas`} a las playlists que sigues en los últimos ${days} días.`,
    groupLabels: {
      owned_sync: 'Playlists sincronizadas que te pertenecen',
      subscribed_sync: 'Playlists sincronizadas que sigues',
      hosted_event: 'Playlists de evento que organizas',
      followed_event: 'Playlists de evento que sigues',
    },
    songs: (count) => `${count} ${count === 1 ? 'canción nueva' : 'canciones nuevas'}`,
    cta: 'Abrir Synqit',
    outro: 'Recibes este resumen porque tienes o sigues playlists activas en Synqit.',
  },
};

const GROUP_ORDER: WeeklyRecapPlaylistKind[] = [
  'owned_sync',
  'subscribed_sync',
  'hosted_event',
  'followed_event',
];

export const renderWeeklyRecapTemplate = (params: {
  locale: EmailLocale;
  webAppUrl: string;
  windowDays: number;
  totalNewTracks: number;
  playlists: WeeklyRecapPlaylist[];
}) => {
  const copy = COPY[params.locale] ?? COPY.en;
  const normalizedAppUrl = params.webAppUrl.replace(/\/+$/, '');
  const normalizedSiteUrl = (
    process.env.SITE_URL ??
    process.env.PUBLIC_SITE_URL ??
    params.webAppUrl
  ).replace(/\/+$/, '');
  const safeSiteUrl = escapeHtml(normalizedSiteUrl);
  const safeAppUrl = escapeHtml(normalizedAppUrl);
  const safeLogoUrl = escapeHtml(`${normalizedAppUrl}/assets/logos/logo-full.png`);

  const renderItemRow = (item: WeeklyRecapPlaylist): string => `
    <tr>
      <td style="padding:9px 0; font-family: Arial, sans-serif; vertical-align:middle;">
        <a href="${escapeHtml(item.url)}" style="color:#15803d; font-size:15px; font-weight:700; text-decoration:none;">${escapeHtml(item.name)}</a>
      </td>
      <td align="right" style="padding:9px 0; font-family: Arial, sans-serif; color:#9ca3af; font-size:13px; white-space:nowrap; vertical-align:middle;">
        ${escapeHtml(copy.songs(item.newTrackCount))}
      </td>
    </tr>`;

  const renderGroupHtml = (kind: WeeklyRecapPlaylistKind, items: WeeklyRecapPlaylist[]): string => `
    <tr>
      <td style="padding:22px 28px 0 28px; font-family: Arial, sans-serif;">
        <div style="font-size:11px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:#9ca3af; padding-bottom:8px; border-bottom:1px solid #edf0f2;">
          ${escapeHtml(copy.groupLabels[kind])}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          ${items.map(renderItemRow).join('')}
        </table>
      </td>
    </tr>`;

  const groupsHtml = GROUP_ORDER.map((kind) => {
    const items = params.playlists.filter((item) => item.kind === kind);
    return items.length > 0 ? renderGroupHtml(kind, items) : '';
  }).join('');

  const html = `
    <div style="margin:0; padding:0; width:100%; background:#f4f6f8;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6f8; width:100%;">
        <tr>
          <td align="center" style="padding:28px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border:1px solid #d8dee4; border-radius:16px; overflow:hidden;">
              <tr>
                <td align="center" style="padding:28px 28px 8px 28px;">
                  <a href="${safeSiteUrl}" style="display:inline-block; text-decoration:none;">
                    <img src="${safeLogoUrl}" alt="Synqit" width="150" style="display:block; width:150px; max-width:100%; height:auto; border:0;" />
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 28px 0 28px; font-family: Arial, sans-serif; color:#111827; text-align:center;">
                  <h1 style="margin:0 0 10px 0; font-size:22px; line-height:1.25; font-weight:800; color:#111827;">${escapeHtml(copy.title)}</h1>
                  <p style="margin:0; font-size:15px; line-height:1.5; color:#6b7280;">${escapeHtml(copy.intro(params.totalNewTracks, params.windowDays))}</p>
                </td>
              </tr>
              ${groupsHtml}
              <tr>
                <td align="center" style="padding:28px 28px 6px 28px;">
                  <a href="${safeAppUrl}" style="display:inline-block; background:#91f034; border:1px solid #7ecb2d; color:#111827; text-decoration:none; font-weight:800; font-size:14px; padding:12px 28px; border-radius:10px;">${escapeHtml(copy.cta)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 28px 26px 28px; font-family: Arial, sans-serif; color:#9ca3af; font-size:12px; line-height:1.5; text-align:center;">
                  ${escapeHtml(copy.outro)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();

  const textLines = [copy.title, '', copy.intro(params.totalNewTracks, params.windowDays), ''];
  for (const kind of GROUP_ORDER) {
    const items = params.playlists.filter((item) => item.kind === kind);
    if (items.length === 0) {
      continue;
    }
    textLines.push(copy.groupLabels[kind].toUpperCase());
    for (const item of items) {
      textLines.push(`- ${item.name} (${copy.songs(item.newTrackCount)}): ${item.url}`);
    }
    textLines.push('');
  }
  textLines.push(`${copy.cta}: ${normalizedAppUrl}`, '', copy.outro);

  return {
    subject: copy.subject,
    html,
    text: textLines.join('\n'),
  };
};
