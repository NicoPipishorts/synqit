import { ENTITY, LEGAL_UPDATED_AT } from './entity';
import { type LegalDocumentSet } from './types';

export const privacyDocument: LegalDocumentSet = {
  en: {
    title: 'Privacy Policy',
    subtitle: `How ${ENTITY.brand} collects, uses and protects your personal data.`,
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'On this page',
    sections: [
      {
        id: 'controller',
        heading: 'Who is responsible for your data',
        blocks: [
          {
            kind: 'p',
            text: `${ENTITY.brand} is operated by ${ENTITY.publisher}, a French micro-entreprise registered under SIREN ${ENTITY.siren}, at ${ENTITY.address}. Under the General Data Protection Regulation (GDPR), we are the data controller for the personal data described on this page.`,
          },
          {
            kind: 'p',
            text: `For anything relating to your data, write to ${ENTITY.email.privacy}. We answer within one month, as the GDPR requires.`,
          },
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'What we collect',
        blocks: [
          {
            kind: 'p',
            text: 'We collect only what the service needs to work. There is no data broker, no advertising network, and no third-party tracker anywhere in Synqit.',
          },
          {
            kind: 'table',
            head: ['Category', 'What it contains', 'Where it comes from'],
            rows: [
              [
                'Account',
                'Email address, hashed password, account status, sign-up date, optional avatar.',
                'You, when you register.',
              ],
              [
                'Profile',
                'Display name, first and last name, date of birth, country — all optional.',
                'You, if you choose to fill them in.',
              ],
              ['Preferences', 'Interface theme and language.', 'You, from the app settings.'],
              [
                'Music platform connections',
                'Encrypted access and refresh tokens, the granted permission scopes, and their expiry. We never see or store your Spotify or Apple Music password.',
                'Spotify or Apple, after you authorise the connection.',
              ],
              [
                'Playlists and events',
                'Event titles and settings, the tracks added, who added them, follows and visits to an event page.',
                'You and, for an event, your guests.',
              ],
              [
                'Sync activity',
                'Which playlists you sync, to whom, and a per-track record of what was added, matched or skipped.',
                'Generated as syncs run.',
              ],
              [
                'Usage analytics',
                'Page path, event name, referrer, language, and a random session identifier that lives only until you close the tab.',
                'Your browser, as you use the site and app.',
              ],
              [
                'Security records',
                'Hashed session tokens, password-reset tokens, and — for accounts touched by an administrator — an audit record of the action and its reason.',
                'Generated automatically.',
              ],
            ],
          },
          {
            kind: 'note',
            text: 'We do not log IP addresses, we do not fingerprint your device, and our analytics sets no cookie. The session identifier is random, stored in sessionStorage, and disappears when the tab closes — it cannot follow you between visits or across sites.',
          },
        ],
      },
      {
        id: 'why',
        heading: 'Why we use it, and on what legal basis',
        blocks: [
          {
            kind: 'table',
            head: ['Purpose', 'Legal basis (GDPR Art. 6)'],
            rows: [
              [
                'Creating and running your account, syncing playlists, hosting your events.',
                'Performance of our contract with you (Art. 6(1)(b)).',
              ],
              [
                'Connecting to Spotify or Apple Music on your behalf.',
                'Performance of the contract — the connection is the service you asked for (Art. 6(1)(b)).',
              ],
              [
                'Transactional email: password resets, event notifications, sync results.',
                'Performance of the contract (Art. 6(1)(b)).',
              ],
              [
                'Measuring which pages and features are used, so we can improve them.',
                'Our legitimate interest in understanding and improving the product, balanced against your privacy by keeping the measurement anonymous and cookie-free (Art. 6(1)(f)).',
              ],
              [
                'Keeping accounts secure, preventing abuse, and keeping an admin audit trail.',
                'Our legitimate interest in the security of the service (Art. 6(1)(f)).',
              ],
              [
                'Meeting accounting and tax obligations on paid plans.',
                'Compliance with a legal obligation (Art. 6(1)(c)).',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'You can object to processing based on legitimate interest at any time — see “Your rights” below.',
          },
        ],
      },
      {
        id: 'music-platforms',
        heading: 'What we ask your music platform for',
        blocks: [
          {
            kind: 'p',
            text: 'Connecting a platform uses OAuth. You authorise Synqit on Spotify’s or Apple’s own screen; your password is never sent to us. We request the narrowest permissions that let the product work:',
          },
          {
            kind: 'table',
            head: ['Platform', 'Permissions requested', 'What that allows'],
            rows: [
              [
                'Spotify',
                'playlist-read-private, playlist-read-collaborative, playlist-modify-private, playlist-modify-public',
                'Read the playlists you choose to sync, and create or update the playlists Synqit maintains for you.',
              ],
              [
                'Apple Music',
                'music-library-read, music-library-modify',
                'Read your library to match tracks, and write the playlists Synqit maintains for you.',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'We do not request access to your listening history, your saved tracks, your followers, or your payment details. We do not play music on your behalf and we do not modify playlists that Synqit did not create, except the ones you explicitly select as sync targets.',
          },
          {
            kind: 'p',
            text: 'Access and refresh tokens are encrypted before they are written to our database. You can disconnect a platform at any time from your account settings, which deletes the stored tokens; you can also revoke Synqit’s access from your Spotify or Apple account settings.',
          },
        ],
      },
      {
        id: 'sharing',
        heading: 'Who else sees your data',
        blocks: [
          {
            kind: 'p',
            text: 'We do not sell personal data and we do not share it for advertising. A small number of providers process data on our behalf, under contract and on our instructions only:',
          },
          {
            kind: 'table',
            head: ['Provider', 'What they process', 'Where'],
            rows: [
              [
                'Spotify AB / Apple Inc.',
                'The playlist and library data needed to run a sync you requested.',
                'Under their own privacy policies — see below.',
              ],
              [
                'Resend',
                'Your email address and the content of transactional emails we send you.',
                'United States, under an EU data-transfer mechanism.',
              ],
              [
                ENTITY.host.name,
                'Hosting of the application servers and database.',
                ENTITY.host.address,
              ],
            ],
          },
          {
            kind: 'p',
            text: 'When you connect a music platform, that platform also processes your data as its own controller, under its own terms. Read Spotify’s and Apple’s privacy policies for what they do with it — we have no control over that part.',
          },
          {
            kind: 'p',
            text: 'We may also disclose data where the law requires it, or to establish or defend a legal claim.',
          },
        ],
      },
      {
        id: 'guests',
        heading: 'If you are a guest at someone’s event',
        blocks: [
          {
            kind: 'p',
            text: 'Guests who add tracks through an event link are visible to the host: the host sees which tracks were added and by whom, because moderating that list is the point of the feature. The host chooses whether to keep a recap of the event afterwards.',
          },
          {
            kind: 'p',
            text: `For the tracks you contribute to someone else’s event, the host decides how the event is run and how long the recap lives. You can ask us to remove your contributions at ${ENTITY.email.privacy}.`,
          },
        ],
      },
      {
        id: 'retention',
        heading: 'How long we keep it',
        blocks: [
          {
            kind: 'table',
            head: ['Data', 'Kept for'],
            rows: [
              ['Account, profile, preferences', 'As long as your account exists.'],
              [
                'Music platform tokens',
                'Until you disconnect the platform or delete your account.',
              ],
              ['Session (refresh) tokens', 'Up to 30 days, or until you log out.'],
              ['Password-reset tokens', '30 minutes.'],
              [
                'Event recaps on the free tier',
                'Purged around 30 days after the event. Paid plans keep them until you delete them.',
              ],
              [
                'Usage analytics',
                'Retained in aggregate to follow product trends; the session identifier is already gone when your tab closes.',
              ],
              ['Invoices and accounting records', 'Ten years, as French commercial law requires.'],
            ],
          },
          {
            kind: 'p',
            text: 'When you ask us to delete your account, we schedule it and then erase your personal data; records we are legally obliged to keep, such as invoices, are retained for the period the law sets and nothing more.',
          },
        ],
      },
      {
        id: 'security',
        heading: 'How we protect it',
        blocks: [
          {
            kind: 'list',
            items: [
              'Passwords are hashed, never stored in readable form.',
              'Music platform tokens are encrypted at rest with a key held outside the database.',
              'Sessions use HTTP-only, Secure, SameSite cookies plus a CSRF token, so a session cannot be read by scripts or replayed from another site.',
              'Traffic is served over HTTPS end to end.',
              'Administrative actions on user accounts are recorded with their author and reason.',
            ],
          },
          {
            kind: 'p',
            text: 'No system is perfectly secure. If a breach ever affects your rights, we will notify the CNIL within 72 hours and tell you directly where the law requires it.',
          },
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        blocks: [
          {
            kind: 'p',
            text: 'Under the GDPR you can, at any time:',
          },
          {
            kind: 'list',
            items: [
              'Access the personal data we hold about you, and get a copy.',
              'Correct anything inaccurate or incomplete.',
              'Erase your data, where no legal obligation requires us to keep it.',
              'Restrict how we process it while a dispute is resolved.',
              'Receive your data in a portable, machine-readable format.',
              'Object to processing based on our legitimate interest, including analytics.',
              'Withdraw consent where you gave it, without affecting what came before.',
              'Give instructions on what should happen to your data after your death (French Data Protection Act, art. 85).',
            ],
          },
          {
            kind: 'p',
            text: `Write to ${ENTITY.email.privacy} and we will reply within one month. If you are not satisfied with our answer, you can lodge a complaint with the CNIL, the French data protection authority: 3 place de Fontenoy, 75007 Paris, cnil.fr.`,
          },
        ],
      },
      {
        id: 'children',
        heading: 'Age',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit is not intended for children under 15, the age of digital consent in France. If you believe a child has created an account, tell us and we will remove it.',
          },
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to this policy',
        blocks: [
          {
            kind: 'p',
            text: 'When we change this policy we update the date at the top of the page. If a change materially affects how we use your data, we will tell you by email or in the app before it takes effect.',
          },
        ],
      },
    ],
  },

  fr: {
    title: 'Politique de confidentialité',
    subtitle: `Comment ${ENTITY.brand} collecte, utilise et protège vos données personnelles.`,
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'Sur cette page',
    sections: [
      {
        id: 'controller',
        heading: 'Qui est responsable de vos données',
        blocks: [
          {
            kind: 'p',
            text: `${ENTITY.brand} est édité par ${ENTITY.publisher}, micro-entreprise immatriculée sous le SIREN ${ENTITY.siren}, dont l’adresse est ${ENTITY.address}. Au sens du Règlement général sur la protection des données (RGPD), nous sommes responsable de traitement des données décrites sur cette page.`,
          },
          {
            kind: 'p',
            text: `Pour toute question relative à vos données, écrivez à ${ENTITY.email.privacy}. Nous répondons sous un mois, comme le RGPD l’exige.`,
          },
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'Ce que nous collectons',
        blocks: [
          {
            kind: 'p',
            text: 'Nous ne collectons que ce dont le service a besoin pour fonctionner. Aucun courtier en données, aucune régie publicitaire, aucun traceur tiers dans Synqit.',
          },
          {
            kind: 'table',
            head: ['Catégorie', 'Contenu', 'Origine'],
            rows: [
              [
                'Compte',
                'Adresse e-mail, mot de passe haché, statut du compte, date d’inscription, avatar facultatif.',
                'Vous, à l’inscription.',
              ],
              [
                'Profil',
                'Nom affiché, prénom et nom, date de naissance, pays — tous facultatifs.',
                'Vous, si vous choisissez de les renseigner.',
              ],
              ['Préférences', 'Thème de l’interface et langue.', 'Vous, depuis les réglages.'],
              [
                'Connexions aux plateformes musicales',
                'Jetons d’accès et de rafraîchissement chiffrés, permissions accordées et leur expiration. Nous ne voyons ni ne stockons jamais votre mot de passe Spotify ou Apple Music.',
                'Spotify ou Apple, après votre autorisation.',
              ],
              [
                'Playlists et événements',
                'Titres et réglages des événements, morceaux ajoutés, auteur de chaque ajout, abonnements et visites de la page d’un événement.',
                'Vous et, pour un événement, vos invités.',
              ],
              [
                'Activité de synchronisation',
                'Quelles playlists vous synchronisez, avec qui, et le détail par morceau de ce qui a été ajouté, apparié ou ignoré.',
                'Généré au fil des synchronisations.',
              ],
              [
                'Mesure d’audience',
                'Chemin de la page, nom de l’événement, référent, langue, et un identifiant de session aléatoire qui ne survit pas à la fermeture de l’onglet.',
                'Votre navigateur, pendant votre visite.',
              ],
              [
                'Journaux de sécurité',
                'Jetons de session hachés, jetons de réinitialisation de mot de passe et, pour les comptes touchés par un administrateur, la trace de l’action et de son motif.',
                'Généré automatiquement.',
              ],
            ],
          },
          {
            kind: 'note',
            text: 'Nous ne journalisons pas les adresses IP, nous n’utilisons aucune empreinte d’appareil, et notre mesure d’audience ne dépose aucun cookie. L’identifiant de session est aléatoire, stocké en sessionStorage, et disparaît à la fermeture de l’onglet : il ne peut ni vous suivre d’une visite à l’autre, ni d’un site à l’autre.',
          },
        ],
      },
      {
        id: 'why',
        heading: 'Pourquoi, et sur quelle base légale',
        blocks: [
          {
            kind: 'table',
            head: ['Finalité', 'Base légale (art. 6 RGPD)'],
            rows: [
              [
                'Créer et faire fonctionner votre compte, synchroniser vos playlists, héberger vos événements.',
                'Exécution du contrat conclu avec vous (art. 6.1.b).',
              ],
              [
                'Nous connecter à Spotify ou Apple Music pour votre compte.',
                'Exécution du contrat — la connexion est précisément le service demandé (art. 6.1.b).',
              ],
              [
                'E-mails transactionnels : réinitialisation de mot de passe, notifications d’événement, résultats de synchronisation.',
                'Exécution du contrat (art. 6.1.b).',
              ],
              [
                'Mesurer quelles pages et fonctionnalités sont utilisées, pour les améliorer.',
                'Notre intérêt légitime à comprendre et améliorer le produit, mis en balance avec votre vie privée par une mesure anonyme et sans cookie (art. 6.1.f).',
              ],
              [
                'Sécuriser les comptes, prévenir les abus, tenir une piste d’audit administrative.',
                'Notre intérêt légitime à la sécurité du service (art. 6.1.f).',
              ],
              [
                'Respecter nos obligations comptables et fiscales sur les offres payantes.',
                'Respect d’une obligation légale (art. 6.1.c).',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Vous pouvez à tout moment vous opposer aux traitements fondés sur l’intérêt légitime — voir « Vos droits » ci-dessous.',
          },
        ],
      },
      {
        id: 'music-platforms',
        heading: 'Ce que nous demandons à votre plateforme musicale',
        blocks: [
          {
            kind: 'p',
            text: 'La connexion passe par OAuth. Vous autorisez Synqit sur l’écran de Spotify ou d’Apple ; votre mot de passe ne nous est jamais transmis. Nous demandons les permissions les plus étroites permettant au produit de fonctionner :',
          },
          {
            kind: 'table',
            head: ['Plateforme', 'Permissions demandées', 'Ce que cela autorise'],
            rows: [
              [
                'Spotify',
                'playlist-read-private, playlist-read-collaborative, playlist-modify-private, playlist-modify-public',
                'Lire les playlists que vous choisissez de synchroniser, et créer ou mettre à jour celles que Synqit gère pour vous.',
              ],
              [
                'Apple Music',
                'music-library-read, music-library-modify',
                'Lire votre bibliothèque pour apparier les morceaux, et écrire les playlists que Synqit gère pour vous.',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Nous ne demandons aucun accès à votre historique d’écoute, à vos titres likés, à vos abonnés ni à vos moyens de paiement. Nous ne lançons aucune lecture à votre place et ne modifions aucune playlist non créée par Synqit, à l’exception de celles que vous désignez explicitement comme cibles de synchronisation.',
          },
          {
            kind: 'p',
            text: 'Les jetons d’accès et de rafraîchissement sont chiffrés avant d’être écrits en base. Vous pouvez déconnecter une plateforme à tout moment depuis vos réglages, ce qui supprime les jetons stockés ; vous pouvez également révoquer l’accès de Synqit depuis votre compte Spotify ou Apple.',
          },
        ],
      },
      {
        id: 'sharing',
        heading: 'Qui d’autre voit vos données',
        blocks: [
          {
            kind: 'p',
            text: 'Nous ne vendons aucune donnée personnelle et n’en partageons aucune à des fins publicitaires. Un petit nombre de prestataires les traitent pour notre compte, sous contrat et sur nos seules instructions :',
          },
          {
            kind: 'table',
            head: ['Prestataire', 'Ce qu’il traite', 'Où'],
            rows: [
              [
                'Spotify AB / Apple Inc.',
                'Les données de playlist et de bibliothèque nécessaires à la synchronisation que vous avez demandée.',
                'Selon leurs propres politiques de confidentialité — voir ci-dessous.',
              ],
              [
                'Resend',
                'Votre adresse e-mail et le contenu des e-mails transactionnels que nous vous envoyons.',
                'États-Unis, sous encadrement d’un mécanisme de transfert conforme au RGPD.',
              ],
              [
                ENTITY.host.name,
                'Hébergement des serveurs applicatifs et de la base de données.',
                ENTITY.host.address,
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Lorsque vous connectez une plateforme musicale, celle-ci traite également vos données en tant que responsable de traitement autonome, selon ses propres conditions. Consultez les politiques de confidentialité de Spotify et d’Apple pour cette partie, sur laquelle nous n’avons aucun contrôle.',
          },
          {
            kind: 'p',
            text: 'Nous pouvons également communiquer des données lorsque la loi l’impose, ou pour constater, exercer ou défendre un droit en justice.',
          },
        ],
      },
      {
        id: 'guests',
        heading: 'Si vous êtes invité à un événement',
        blocks: [
          {
            kind: 'p',
            text: 'Les invités qui ajoutent des morceaux via un lien d’événement sont visibles de l’organisateur : celui-ci voit quels morceaux ont été ajoutés et par qui, la modération de cette liste étant l’objet même de la fonctionnalité. L’organisateur choisit de conserver ou non un récapitulatif après l’événement.',
          },
          {
            kind: 'p',
            text: `Pour les morceaux que vous ajoutez à l’événement d’un tiers, c’est l’organisateur qui décide du déroulé de l’événement et de la durée de vie du récapitulatif. Vous pouvez nous demander la suppression de vos contributions à ${ENTITY.email.privacy}.`,
          },
        ],
      },
      {
        id: 'retention',
        heading: 'Durées de conservation',
        blocks: [
          {
            kind: 'table',
            head: ['Donnée', 'Conservée'],
            rows: [
              ['Compte, profil, préférences', 'Tant que votre compte existe.'],
              [
                'Jetons des plateformes musicales',
                'Jusqu’à la déconnexion de la plateforme ou la suppression du compte.',
              ],
              [
                'Jetons de session (rafraîchissement)',
                'Jusqu’à 30 jours, ou jusqu’à votre déconnexion.',
              ],
              ['Jetons de réinitialisation de mot de passe', '30 minutes.'],
              [
                'Récapitulatifs d’événement en offre gratuite',
                'Purgés environ 30 jours après l’événement. Les offres payantes les conservent jusqu’à suppression par vos soins.',
              ],
              [
                'Mesure d’audience',
                'Conservée sous forme agrégée pour suivre les tendances produit ; l’identifiant de session a déjà disparu à la fermeture de l’onglet.',
              ],
              ['Factures et pièces comptables', 'Dix ans, conformément au code de commerce.'],
            ],
          },
          {
            kind: 'p',
            text: 'Lorsque vous demandez la suppression de votre compte, nous la programmons puis effaçons vos données personnelles ; les pièces que la loi nous oblige à conserver, comme les factures, le sont pour la durée légale et pas davantage.',
          },
        ],
      },
      {
        id: 'security',
        heading: 'Comment nous les protégeons',
        blocks: [
          {
            kind: 'list',
            items: [
              'Les mots de passe sont hachés, jamais stockés en clair.',
              'Les jetons des plateformes musicales sont chiffrés au repos, avec une clé conservée hors de la base de données.',
              'Les sessions reposent sur des cookies HTTP-only, Secure et SameSite, complétés d’un jeton CSRF : une session ne peut être lue par un script ni rejouée depuis un autre site.',
              'Le trafic est servi en HTTPS de bout en bout.',
              'Les actions administratives sur les comptes sont journalisées avec leur auteur et leur motif.',
            ],
          },
          {
            kind: 'p',
            text: 'Aucun système n’est parfaitement sûr. Si une violation devait affecter vos droits, nous en informerions la CNIL sous 72 heures et vous préviendrions directement lorsque la loi l’impose.',
          },
        ],
      },
      {
        id: 'rights',
        heading: 'Vos droits',
        blocks: [
          {
            kind: 'p',
            text: 'En vertu du RGPD, vous pouvez à tout moment :',
          },
          {
            kind: 'list',
            items: [
              'Accéder aux données personnelles que nous détenons sur vous et en obtenir copie.',
              'Rectifier toute donnée inexacte ou incomplète.',
              'Effacer vos données, lorsqu’aucune obligation légale ne nous impose de les conserver.',
              'Limiter le traitement pendant l’examen d’une contestation.',
              'Récupérer vos données dans un format portable et lisible par machine.',
              'Vous opposer aux traitements fondés sur notre intérêt légitime, y compris la mesure d’audience.',
              'Retirer votre consentement lorsque vous l’avez donné, sans remettre en cause ce qui a précédé.',
              'Définir des directives sur le sort de vos données après votre décès (art. 85 de la loi Informatique et Libertés).',
            ],
          },
          {
            kind: 'p',
            text: `Écrivez à ${ENTITY.email.privacy} : nous répondons sous un mois. Si notre réponse ne vous satisfait pas, vous pouvez saisir la CNIL — 3 place de Fontenoy, 75007 Paris, cnil.fr.`,
          },
        ],
      },
      {
        id: 'children',
        heading: 'Âge',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit n’est pas destiné aux enfants de moins de 15 ans, âge du consentement numérique en France. Si vous pensez qu’un enfant a créé un compte, signalez-le nous et nous le supprimerons.',
          },
        ],
      },
      {
        id: 'changes',
        heading: 'Modifications de cette politique',
        blocks: [
          {
            kind: 'p',
            text: 'Toute modification met à jour la date figurant en haut de cette page. Si un changement affecte substantiellement l’usage de vos données, nous vous en informerons par e-mail ou dans l’application avant son entrée en vigueur.',
          },
        ],
      },
    ],
  },

  es: {
    title: 'Política de privacidad',
    subtitle: `Cómo ${ENTITY.brand} recopila, usa y protege tus datos personales.`,
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'En esta página',
    sections: [
      {
        id: 'controller',
        heading: 'Quién es responsable de tus datos',
        blocks: [
          {
            kind: 'p',
            text: `${ENTITY.brand} está operado por ${ENTITY.publisher}, micro-entreprise francesa inscrita con el SIREN ${ENTITY.siren}, con domicilio en ${ENTITY.address}. Conforme al Reglamento General de Protección de Datos (RGPD), somos el responsable del tratamiento de los datos personales que se describen en esta página.`,
          },
          {
            kind: 'p',
            text: `Para cualquier cuestión relativa a tus datos, escribe a ${ENTITY.email.privacy}. Respondemos en el plazo de un mes, tal y como exige el RGPD.`,
          },
        ],
      },
      {
        id: 'what-we-collect',
        heading: 'Qué recopilamos',
        blocks: [
          {
            kind: 'p',
            text: 'Solo recopilamos lo que el servicio necesita para funcionar. En Synqit no hay ningún intermediario de datos, ninguna red publicitaria ni ningún rastreador de terceros.',
          },
          {
            kind: 'table',
            head: ['Categoría', 'Qué contiene', 'De dónde procede'],
            rows: [
              [
                'Cuenta',
                'Dirección de correo, contraseña cifrada mediante hash, estado de la cuenta, fecha de registro y avatar opcional.',
                'De ti, al registrarte.',
              ],
              [
                'Perfil',
                'Nombre público, nombre y apellidos, fecha de nacimiento y país, todos opcionales.',
                'De ti, si decides rellenarlos.',
              ],
              [
                'Preferencias',
                'Tema e idioma de la interfaz.',
                'De ti, desde los ajustes de la aplicación.',
              ],
              [
                'Conexiones con plataformas de música',
                'Tokens de acceso y de renovación cifrados, los permisos concedidos y su fecha de caducidad. Nunca vemos ni almacenamos tu contraseña de Spotify o de Apple Music.',
                'De Spotify o de Apple, después de que autorices la conexión.',
              ],
              [
                'Playlists y eventos',
                'Títulos y ajustes de los eventos, las canciones añadidas, quién las añadió, los seguimientos y las visitas a la página de un evento.',
                'De ti y, en el caso de un evento, de tus invitados.',
              ],
              [
                'Actividad de sincronización',
                'Qué playlists sincronizas, con quién, y un registro por canción de lo que se añadió, se encontró o se omitió.',
                'Se genera al ejecutarse las sincronizaciones.',
              ],
              [
                'Analítica de uso',
                'Ruta de la página, nombre del evento, referente, idioma y un identificador de sesión aleatorio que solo existe hasta que cierras la pestaña.',
                'De tu navegador, mientras usas el sitio y la aplicación.',
              ],
              [
                'Registros de seguridad',
                'Tokens de sesión y de restablecimiento de contraseña cifrados mediante hash y, en las cuentas sobre las que actúa un administrador, un registro de auditoría de la acción y su motivo.',
                'Se generan automáticamente.',
              ],
            ],
          },
          {
            kind: 'note',
            text: 'No registramos direcciones IP, no aplicamos ninguna huella digital a tu dispositivo y nuestra analítica no instala ninguna cookie. El identificador de sesión es aleatorio, se guarda en sessionStorage y desaparece al cerrar la pestaña: no puede seguirte de una visita a otra ni de un sitio a otro.',
          },
        ],
      },
      {
        id: 'why',
        heading: 'Para qué los usamos y con qué base jurídica',
        blocks: [
          {
            kind: 'table',
            head: ['Finalidad', 'Base jurídica (art. 6 del RGPD)'],
            rows: [
              [
                'Crear y gestionar tu cuenta, sincronizar playlists y alojar tus eventos.',
                'Ejecución de nuestro contrato contigo (art. 6.1.b).',
              ],
              [
                'Conectarnos a Spotify o Apple Music en tu nombre.',
                'Ejecución del contrato: la conexión es el servicio que has solicitado (art. 6.1.b).',
              ],
              [
                'Correos transaccionales: restablecimiento de contraseña, notificaciones de eventos y resultados de sincronización.',
                'Ejecución del contrato (art. 6.1.b).',
              ],
              [
                'Medir qué páginas y funciones se usan, para poder mejorarlas.',
                'Nuestro interés legítimo en conocer y mejorar el producto, equilibrado con tu privacidad al mantener la medición anónima y sin cookies (art. 6.1.f).',
              ],
              [
                'Mantener las cuentas seguras, prevenir abusos y conservar una pista de auditoría de administración.',
                'Nuestro interés legítimo en la seguridad del servicio (art. 6.1.f).',
              ],
              [
                'Cumplir las obligaciones contables y fiscales de los planes de pago.',
                'Cumplimiento de una obligación legal (art. 6.1.c).',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Puedes oponerte en cualquier momento a los tratamientos basados en el interés legítimo: consulta «Tus derechos» más abajo.',
          },
        ],
      },
      {
        id: 'music-platforms',
        heading: 'Qué le pedimos a tu plataforma de música',
        blocks: [
          {
            kind: 'p',
            text: 'La conexión con una plataforma usa OAuth. Autorizas a Synqit en la propia pantalla de Spotify o de Apple; tu contraseña nunca se nos envía. Solicitamos los permisos mínimos que permiten que el producto funcione:',
          },
          {
            kind: 'table',
            head: ['Plataforma', 'Permisos solicitados', 'Qué permiten'],
            rows: [
              [
                'Spotify',
                'playlist-read-private, playlist-read-collaborative, playlist-modify-private, playlist-modify-public',
                'Leer las playlists que decidas sincronizar y crear o actualizar las playlists que Synqit mantiene para ti.',
              ],
              [
                'Apple Music',
                'music-library-read, music-library-modify',
                'Leer tu biblioteca para encontrar las canciones y escribir las playlists que Synqit mantiene para ti.',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'No solicitamos acceso a tu historial de escucha, a tus canciones guardadas, a tus seguidores ni a tus datos de pago. No reproducimos música en tu nombre y no modificamos playlists que Synqit no haya creado, salvo aquellas que selecciones expresamente como destino de una sincronización.',
          },
          {
            kind: 'p',
            text: 'Los tokens de acceso y de renovación se cifran antes de escribirse en nuestra base de datos. Puedes desconectar una plataforma en cualquier momento desde los ajustes de tu cuenta, lo que elimina los tokens almacenados; también puedes revocar el acceso de Synqit desde los ajustes de tu cuenta de Spotify o de Apple.',
          },
        ],
      },
      {
        id: 'sharing',
        heading: 'Quién más ve tus datos',
        blocks: [
          {
            kind: 'p',
            text: 'No vendemos datos personales ni los compartimos con fines publicitarios. Un número reducido de proveedores trata datos por cuenta nuestra, bajo contrato y siguiendo únicamente nuestras instrucciones:',
          },
          {
            kind: 'table',
            head: ['Proveedor', 'Qué trata', 'Dónde'],
            rows: [
              [
                'Spotify AB / Apple Inc.',
                'Los datos de playlists y de biblioteca necesarios para ejecutar una sincronización que hayas solicitado.',
                'Conforme a sus propias políticas de privacidad, ver más abajo.',
              ],
              [
                'Resend',
                'Tu dirección de correo y el contenido de los correos transaccionales que te enviamos.',
                'Estados Unidos, con un mecanismo de transferencia de datos de la UE.',
              ],
              [
                ENTITY.host.name,
                'Alojamiento de los servidores de la aplicación y de la base de datos.',
                ENTITY.host.address,
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Cuando conectas una plataforma de música, esa plataforma también trata tus datos como responsable propio, con arreglo a sus propias condiciones. Consulta las políticas de privacidad de Spotify y de Apple para saber qué hacen con ellos: esa parte queda fuera de nuestro control.',
          },
          {
            kind: 'p',
            text: 'También podemos comunicar datos cuando la ley lo exija, o para formular o defender una reclamación legal.',
          },
        ],
      },
      {
        id: 'guests',
        heading: 'Si eres invitado en el evento de otra persona',
        blocks: [
          {
            kind: 'p',
            text: 'Los invitados que añaden canciones a través del enlace de un evento son visibles para el anfitrión: el anfitrión ve qué canciones se han añadido y quién las ha añadido, porque moderar esa lista es justamente el sentido de la función. El anfitrión decide si conserva después un resumen del evento.',
          },
          {
            kind: 'p',
            text: `En cuanto a las canciones que aportas al evento de otra persona, el anfitrión decide cómo se gestiona el evento y cuánto tiempo se conserva el resumen. Puedes pedirnos que eliminemos tus aportaciones escribiendo a ${ENTITY.email.privacy}.`,
          },
        ],
      },
      {
        id: 'retention',
        heading: 'Cuánto tiempo los conservamos',
        blocks: [
          {
            kind: 'table',
            head: ['Datos', 'Se conservan'],
            rows: [
              ['Cuenta, perfil y preferencias', 'Mientras exista tu cuenta.'],
              [
                'Tokens de las plataformas de música',
                'Hasta que desconectes la plataforma o elimines tu cuenta.',
              ],
              ['Tokens de sesión (renovación)', 'Hasta 30 días, o hasta que cierres sesión.'],
              ['Tokens de restablecimiento de contraseña', '30 minutos.'],
              [
                'Resúmenes de eventos en el nivel gratuito',
                'Se eliminan unos 30 días después del evento. Los planes de pago los conservan hasta que los elimines.',
              ],
              [
                'Analítica de uso',
                'Se conserva de forma agregada para seguir la evolución del producto; el identificador de sesión ya ha desaparecido cuando cierras la pestaña.',
              ],
              [
                'Facturas y registros contables',
                'Diez años, como exige el derecho mercantil francés.',
              ],
            ],
          },
          {
            kind: 'p',
            text: 'Cuando nos pides que eliminemos tu cuenta, la programamos para su eliminación y después borramos tus datos personales; los registros que estamos legalmente obligados a conservar, como las facturas, se guardan durante el plazo que fija la ley y nada más.',
          },
        ],
      },
      {
        id: 'security',
        heading: 'Cómo los protegemos',
        blocks: [
          {
            kind: 'list',
            items: [
              'Las contraseñas se cifran mediante hash y nunca se almacenan en un formato legible.',
              'Los tokens de las plataformas de música se cifran en reposo con una clave guardada fuera de la base de datos.',
              'Las sesiones usan cookies HTTP-only, Secure y SameSite, además de un token CSRF, de modo que una sesión no puede ser leída por scripts ni reutilizada desde otro sitio.',
              'El tráfico se sirve mediante HTTPS de extremo a extremo.',
              'Las acciones administrativas sobre las cuentas de usuario se registran junto con su autor y su motivo.',
            ],
          },
          {
            kind: 'p',
            text: 'Ningún sistema es perfectamente seguro. Si alguna vez una brecha afectara a tus derechos, lo notificaremos a la CNIL en un plazo de 72 horas y te lo comunicaremos directamente cuando la ley así lo exija.',
          },
        ],
      },
      {
        id: 'rights',
        heading: 'Tus derechos',
        blocks: [
          {
            kind: 'p',
            text: 'Conforme al RGPD, en cualquier momento puedes:',
          },
          {
            kind: 'list',
            items: [
              'Acceder a los datos personales que tenemos sobre ti y obtener una copia.',
              'Rectificar cualquier dato inexacto o incompleto.',
              'Suprimir tus datos, cuando ninguna obligación legal nos exija conservarlos.',
              'Limitar el tratamiento mientras se resuelve una controversia.',
              'Recibir tus datos en un formato portátil y legible por máquina.',
              'Oponerte a los tratamientos basados en nuestro interés legítimo, incluida la analítica.',
              'Retirar tu consentimiento cuando lo hayas prestado, sin que ello afecte a lo anterior.',
              'Dar instrucciones sobre qué debe ocurrir con tus datos tras tu fallecimiento (Ley de Protección de Datos francesa, art. 85).',
            ],
          },
          {
            kind: 'p',
            text: `Escribe a ${ENTITY.email.privacy} y te responderemos en el plazo de un mes. Si no te satisface nuestra respuesta, puedes presentar una reclamación ante la CNIL, la autoridad francesa de protección de datos: 3 place de Fontenoy, 75007 París, cnil.fr.`,
          },
        ],
      },
      {
        id: 'children',
        heading: 'Edad',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit no está dirigido a menores de 15 años, la edad del consentimiento digital en Francia. Si crees que un menor ha creado una cuenta, avísanos y la eliminaremos.',
          },
        ],
      },
      {
        id: 'changes',
        heading: 'Cambios en esta política',
        blocks: [
          {
            kind: 'p',
            text: 'Cuando modificamos esta política actualizamos la fecha que aparece en la parte superior de la página. Si un cambio afecta de forma sustancial al uso que hacemos de tus datos, te lo comunicaremos por correo o en la aplicación antes de que entre en vigor.',
          },
        ],
      },
    ],
  },
};
