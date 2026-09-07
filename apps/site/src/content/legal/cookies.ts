import { ENTITY, LEGAL_UPDATED_AT } from './entity';
import { type LegalDocumentSet } from './types';

export const cookiesDocument: LegalDocumentSet = {
  en: {
    title: 'Cookie Notice',
    subtitle: 'What Synqit stores in your browser, and why there is no cookie banner.',
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'On this page',
    sections: [
      {
        id: 'summary',
        heading: 'The short version',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit sets no advertising cookies, embeds no third-party trackers, and runs no cross-site analytics. The only cookies we set are the ones that keep you logged in, and they are set after you log in — never before.',
          },
        ],
      },
      {
        id: 'essential',
        heading: 'Essential cookies',
        blocks: [
          {
            kind: 'p',
            text: 'These are set by the Synqit application once you sign in. Without them you cannot stay logged in.',
          },
          {
            kind: 'table',
            head: ['Cookie', 'Purpose', 'Lifetime'],
            rows: [
              [
                'synqit_web_access',
                'Carries your short-lived session so each request can be authenticated. HTTP-only, so scripts cannot read it.',
                '15 minutes',
              ],
              [
                'synqit_web_refresh',
                'Lets the app renew your session without asking you to log in again. HTTP-only.',
                'Up to 30 days',
              ],
              [
                'synqit_web_csrf',
                'A token the app echoes back on each write, so another site cannot act in your name.',
                'Same as the refresh cookie',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'All three are marked Secure and SameSite, and are cleared when you log out. The back office uses the same three cookies under synqit_admin_ names.',
          },
        ],
      },
      {
        id: 'storage',
        heading: 'Browser storage',
        blocks: [
          {
            kind: 'p',
            text: 'A few preferences live in your browser rather than in a cookie. They stay on your device and are never sent to our servers as a tracking signal.',
          },
          {
            kind: 'table',
            head: ['Key', 'What it holds', 'Where'],
            rows: [
              ['synqit.theme.v1', 'Light or dark mode.', 'localStorage'],
              [
                'synqit.locale.v1 / synqit.site.locale.v1',
                'The language you picked.',
                'localStorage',
              ],
              ['synqit.preferences.v1', 'Interface preferences.', 'localStorage'],
              [
                'synqit.auth.v1',
                'Non-sensitive session state so the app knows it is signed in before the first request returns. No token is stored here.',
                'localStorage',
              ],
              [
                'synqit.analytics.session.v1',
                'A random identifier grouping the page views of a single visit.',
                'sessionStorage',
              ],
            ],
          },
        ],
      },
      {
        id: 'analytics',
        heading: 'How we measure audience',
        blocks: [
          {
            kind: 'p',
            text: 'Our analytics is built in-house and runs on our own servers. It records the page path, the name of the event, the referrer and the language, alongside a random session identifier held in sessionStorage — which the browser discards the moment you close the tab.',
          },
          {
            kind: 'p',
            text: 'We do not log IP addresses, we do not fingerprint devices, and no data goes to a third-party analytics company. Because the identifier cannot follow you between visits or across sites, the measurement is strictly limited to producing anonymous statistics for us alone.',
          },
        ],
      },
      {
        id: 'no-banner',
        heading: 'Why you are not seeing a consent banner',
        blocks: [
          {
            kind: 'p',
            text: 'French law (art. 82 of the Data Protection Act) requires consent for storage that is not strictly necessary to a service you asked for. Our session cookies are strictly necessary, so they are exempt. Our audience measurement meets the CNIL’s exemption criteria for first-party analytics: single-site, no cross-service tracking, anonymous statistics, and no sharing with third parties.',
          },
          {
            kind: 'p',
            text: 'If we ever add anything that does require consent, you will get a proper choice before it is set — not a banner that assumes your answer.',
          },
        ],
      },
      {
        id: 'control',
        heading: 'How to control this',
        blocks: [
          {
            kind: 'p',
            text: 'You can clear cookies and site data for synqit.fr from your browser settings at any time; doing so signs you out and resets your theme and language. Blocking cookies entirely will prevent you from staying logged in.',
          },
          {
            kind: 'p',
            text: `Questions about anything on this page: ${ENTITY.email.privacy}.`,
          },
        ],
      },
    ],
  },

  fr: {
    title: 'Notice cookies',
    subtitle: 'Ce que Synqit stocke dans votre navigateur, et pourquoi il n’y a pas de bandeau.',
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'Sur cette page',
    sections: [
      {
        id: 'summary',
        heading: 'En bref',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit ne dépose aucun cookie publicitaire, n’intègre aucun traceur tiers et n’effectue aucune mesure inter-sites. Les seuls cookies déposés sont ceux qui vous maintiennent connecté, et ils le sont après votre connexion — jamais avant.',
          },
        ],
      },
      {
        id: 'essential',
        heading: 'Cookies strictement nécessaires',
        blocks: [
          {
            kind: 'p',
            text: 'Ils sont déposés par l’application Synqit une fois que vous vous connectez. Sans eux, vous ne pouvez pas rester connecté.',
          },
          {
            kind: 'table',
            head: ['Cookie', 'Rôle', 'Durée'],
            rows: [
              [
                'synqit_web_access',
                'Porte votre session de courte durée pour authentifier chaque requête. HTTP-only : illisible par les scripts.',
                '15 minutes',
              ],
              [
                'synqit_web_refresh',
                'Permet de renouveler votre session sans vous redemander vos identifiants. HTTP-only.',
                'Jusqu’à 30 jours',
              ],
              [
                'synqit_web_csrf',
                'Jeton renvoyé à chaque écriture, afin qu’aucun autre site ne puisse agir en votre nom.',
                'Identique au cookie de rafraîchissement',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Les trois portent les attributs Secure et SameSite et sont supprimés à la déconnexion. Le back-office utilise les mêmes cookies sous les noms synqit_admin_.',
          },
        ],
      },
      {
        id: 'storage',
        heading: 'Stockage navigateur',
        blocks: [
          {
            kind: 'p',
            text: 'Quelques préférences résident dans votre navigateur plutôt que dans un cookie. Elles restent sur votre appareil et ne sont jamais transmises à nos serveurs comme signal de suivi.',
          },
          {
            kind: 'table',
            head: ['Clé', 'Contenu', 'Emplacement'],
            rows: [
              ['synqit.theme.v1', 'Thème clair ou sombre.', 'localStorage'],
              [
                'synqit.locale.v1 / synqit.site.locale.v1',
                'La langue que vous avez choisie.',
                'localStorage',
              ],
              ['synqit.preferences.v1', 'Préférences d’interface.', 'localStorage'],
              [
                'synqit.auth.v1',
                'État de session non sensible, pour que l’application sache qu’elle est connectée avant la première réponse du serveur. Aucun jeton n’y est stocké.',
                'localStorage',
              ],
              [
                'synqit.analytics.session.v1',
                'Identifiant aléatoire regroupant les pages vues d’une même visite.',
                'sessionStorage',
              ],
            ],
          },
        ],
      },
      {
        id: 'analytics',
        heading: 'Comment nous mesurons l’audience',
        blocks: [
          {
            kind: 'p',
            text: 'Notre mesure d’audience est développée en interne et tourne sur nos propres serveurs. Elle enregistre le chemin de la page, le nom de l’événement, le référent et la langue, avec un identifiant de session aléatoire conservé en sessionStorage — que le navigateur supprime dès la fermeture de l’onglet.',
          },
          {
            kind: 'p',
            text: 'Nous ne journalisons pas les adresses IP, n’utilisons aucune empreinte d’appareil, et aucune donnée n’est transmise à une société d’analytics tierce. L’identifiant ne pouvant vous suivre ni d’une visite à l’autre, ni d’un site à l’autre, la mesure se limite strictement à produire des statistiques anonymes pour notre seul usage.',
          },
        ],
      },
      {
        id: 'no-banner',
        heading: 'Pourquoi aucun bandeau ne s’affiche',
        blocks: [
          {
            kind: 'p',
            text: 'L’article 82 de la loi Informatique et Libertés impose le consentement pour tout stockage qui n’est pas strictement nécessaire au service demandé. Nos cookies de session étant strictement nécessaires, ils en sont exemptés. Notre mesure d’audience remplit les critères d’exemption posés par la CNIL pour les statistiques de première partie : site unique, aucun suivi inter-services, statistiques anonymes, aucune transmission à des tiers.',
          },
          {
            kind: 'p',
            text: 'Si nous ajoutions un jour quoi que ce soit nécessitant un consentement, vous obtiendriez un véritable choix avant tout dépôt — et non un bandeau qui présume votre réponse.',
          },
        ],
      },
      {
        id: 'control',
        heading: 'Comment reprendre la main',
        blocks: [
          {
            kind: 'p',
            text: 'Vous pouvez à tout moment effacer les cookies et données de site de synqit.fr depuis les réglages de votre navigateur : cela vous déconnecte et réinitialise votre thème et votre langue. Bloquer entièrement les cookies vous empêchera de rester connecté.',
          },
          {
            kind: 'p',
            text: `Toute question sur cette page : ${ENTITY.email.privacy}.`,
          },
        ],
      },
    ],
  },
};
