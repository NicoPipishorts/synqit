import { ENTITY, LEGAL_UPDATED_AT } from './entity';
import { type LegalDocumentSet } from './types';

export const termsDocument: LegalDocumentSet = {
  en: {
    title: 'Terms of Service',
    subtitle: `The agreement between you and ${ENTITY.brand} when you use the service.`,
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'On this page',
    sections: [
      {
        id: 'parties',
        heading: 'Who these terms are with',
        blocks: [
          {
            kind: 'p',
            text: `${ENTITY.brand} is operated by ${ENTITY.publisher}, a French micro-entreprise registered under SIREN ${ENTITY.siren}, at ${ENTITY.address} (“we”, “us”). These terms govern your use of ${ENTITY.siteUrl} and the Synqit application.`,
          },
          {
            kind: 'p',
            text: `By creating an account or using the service you accept these terms. If you do not accept them, do not use Synqit. Questions go to ${ENTITY.email.legal}.`,
          },
        ],
      },
      {
        id: 'service',
        heading: 'What Synqit does',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit does two things. It syncs playlists between music platforms, so a playlist you follow on one service stays up to date on another. And it hosts collaborative event playlists, where guests add tracks through a link and the host moderates the result.',
          },
          {
            kind: 'p',
            text: 'Synqit is a tool that acts on the music accounts you connect. It is not a music service: it does not host, stream, or supply any recording. Playback happens entirely inside Spotify or Apple Music, under your subscription with them.',
          },
        ],
      },
      {
        id: 'account',
        heading: 'Your account',
        blocks: [
          {
            kind: 'list',
            items: [
              'You must be at least 15 years old to create an account.',
              'The information you give us must be accurate, and you must keep your email address current so we can reach you.',
              'You are responsible for keeping your password confidential and for what happens under your account.',
              'One account is for one person. Do not share credentials.',
              'Tell us promptly if you believe your account has been compromised.',
            ],
          },
        ],
      },
      {
        id: 'platforms',
        heading: 'Connecting music platforms',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit is not affiliated with, endorsed by, or sponsored by Spotify or Apple. Spotify and Apple Music are trademarks of their respective owners, used here only to identify the services Synqit connects to.',
          },
          {
            kind: 'p',
            text: 'Using Synqit with a platform does not exempt you from that platform’s own terms. You need your own valid account there, and some features may require a paid subscription on their side. If a platform changes or withdraws its API, restricts our access, or suspends your account, features that depend on it may stop working — that is outside our control, and we cannot be held liable for it.',
          },
          {
            kind: 'p',
            text: 'You authorise us to act on your connected accounts strictly within the permissions you granted, and only to carry out the syncs and events you set up.',
          },
        ],
      },
      {
        id: 'matching',
        heading: 'What we can and cannot promise about syncing',
        blocks: [
          {
            kind: 'p',
            text: 'Catalogues differ between platforms. A track available on one may be missing from another, published under a different version, or regionally restricted. Synqit matches tracks as accurately as it can and reports what it could not match, but we cannot guarantee that every playlist transfers completely or that a match is always the exact recording you intended.',
          },
          {
            kind: 'p',
            text: 'Syncs run periodically rather than instantly, and a sync can fail if a platform is unavailable or a connection has expired. Synqit is provided as a convenience, not as a backup service: keep your own copy of anything you cannot afford to lose.',
          },
        ],
      },
      {
        id: 'content',
        heading: 'Your content and your events',
        blocks: [
          {
            kind: 'p',
            text: 'You keep all rights in the content you create — event names, descriptions, the playlists you assemble. You grant us only the permission we need to host and display that content in order to run the service for you and, for an event, for the guests you invite.',
          },
          {
            kind: 'p',
            text: 'If you host an event, you are responsible for the link you distribute and for moderating what guests add. You must have the right to invite the people you invite, and you must respect their privacy — including telling them, if they ask, how the event and its recap will be used.',
          },
        ],
      },
      {
        id: 'acceptable-use',
        heading: 'Acceptable use',
        blocks: [
          {
            kind: 'p',
            text: 'You agree not to:',
          },
          {
            kind: 'list',
            items: [
              'Use Synqit to infringe copyright, or to download, rip, or redistribute recordings.',
              'Circumvent a platform’s rate limits, terms, or technical protections through Synqit.',
              'Automate access to the service outside the interfaces we provide, or scrape it at scale.',
              'Upload or share content that is unlawful, harassing, hateful, or infringes someone else’s rights.',
              'Attempt to access another user’s account or data, or probe the service for vulnerabilities without our written permission.',
              'Resell or white-label the service without a written agreement with us.',
            ],
          },
          {
            kind: 'p',
            text:
              'If you find a security vulnerability, tell us at ' +
              ENTITY.email.legal +
              ' before disclosing it publicly. We will not pursue researchers who report in good faith and give us reasonable time to fix the issue.',
          },
        ],
      },
      {
        id: 'plans',
        heading: 'Plans, prices and payment',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit has a free tier and paid options. Event plans are bought once, for one event. Sharing plans unlock features on your account. The features in each plan, and their prices, are the ones shown on our pricing page at the moment you buy.',
          },
          {
            kind: 'p',
            text: 'Prices are in euros and include VAT where applicable. As a micro-entreprise under the French VAT franchise, we may invoice without VAT — the mention “TVA non applicable, art. 293 B du CGI” then appears on the invoice.',
          },
          {
            kind: 'p',
            text: 'We may change prices for the future. A change never affects an event plan you have already paid for. If we change the price of a recurring plan, we will tell you in advance and you may cancel before it takes effect.',
          },
        ],
      },
      {
        id: 'withdrawal',
        heading: 'Right of withdrawal',
        blocks: [
          {
            kind: 'p',
            text: 'If you are a consumer in the European Union, you normally have fourteen days from your purchase to withdraw from it, without giving a reason (French Consumer Code, art. L221-18).',
          },
          {
            kind: 'note',
            text: 'Because Synqit is digital content supplied immediately, we ask you to confirm at checkout that you want access straight away and that you acknowledge losing your right of withdrawal once the service has been fully provided (art. L221-28, 13°). If you do not give that confirmation, your fourteen days run as normal and the paid features begin after that period.',
          },
          {
            kind: 'p',
            text: `To withdraw, write to ${ENTITY.email.legal} within the period. We refund using the same payment method, within fourteen days of receiving your request.`,
          },
        ],
      },
      {
        id: 'availability',
        heading: 'Availability and changes',
        blocks: [
          {
            kind: 'p',
            text: 'We work to keep Synqit available, but we do not promise uninterrupted service. We may take it down for maintenance, and we may add, change or remove features as the product develops. If we remove a feature that is material to a plan you paid for, we will offer a fair remedy — a replacement or a proportionate refund.',
          },
        ],
      },
      {
        id: 'termination',
        heading: 'Suspension and closing your account',
        blocks: [
          {
            kind: 'p',
            text: 'You can close your account at any time from your settings. Closing it removes your personal data as described in our Privacy Policy.',
          },
          {
            kind: 'p',
            text: 'We may suspend or close an account that breaches these terms, that is being used unlawfully, or that puts the service or its other users at risk. Except where the breach is serious or the law requires immediate action, we will warn you first and give you a chance to put it right. If we close a paid account without cause, we refund the unused portion.',
          },
        ],
      },
      {
        id: 'liability',
        heading: 'Liability',
        blocks: [
          {
            kind: 'p',
            text: 'Nothing in these terms excludes our liability for death or personal injury caused by our negligence, for fraud, for hidden defects, or for anything else that French law does not allow us to exclude. Consumers keep the full benefit of the legal guarantee of conformity (art. L217-3 et seq. of the Consumer Code).',
          },
          {
            kind: 'p',
            text: 'Beyond that, we are not liable for indirect or unforeseeable loss, for loss of data you could have kept a copy of, or for a failure caused by a music platform, your internet access, or another event outside our reasonable control. Where our liability can be limited, it is limited to the amount you paid us in the twelve months before the event giving rise to the claim.',
          },
        ],
      },
      {
        id: 'ip',
        heading: 'Our intellectual property',
        blocks: [
          {
            kind: 'p',
            text: 'The Synqit name, logo, interface, and the software behind them belong to us. These terms give you a personal, non-exclusive, non-transferable right to use the service — nothing more. You may not copy, decompile, or create derivative works from it, except where the law expressly allows.',
          },
        ],
      },
      {
        id: 'law',
        heading: 'Governing law and disputes',
        blocks: [
          {
            kind: 'p',
            text: 'These terms are governed by French law. If you are a consumer, this does not deprive you of the protection of the mandatory rules of the country where you live.',
          },
          {
            kind: 'p',
            text: `If something goes wrong, write to ${ENTITY.email.legal} first — most things are settled that way. If we cannot resolve it, a consumer may refer the dispute free of charge to a consumer mediator, or use the European Commission's online dispute resolution platform at ec.europa.eu/consumers/odr. Failing agreement, the dispute goes to the competent French courts.`,
          },
          {
            kind: 'note',
            text: 'TODO(legal): French law requires a trader selling to consumers to name a registered consumer mediator (Consumer Code, art. L612-1). Add your mediator’s name, address and website here once you have subscribed to one.',
          },
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to these terms',
        blocks: [
          {
            kind: 'p',
            text: 'We may update these terms as the service evolves. The date at the top of the page shows the current version. For a material change we will notify you at least thirty days in advance; if you do not accept it, you may close your account before it takes effect.',
          },
        ],
      },
    ],
  },

  fr: {
    title: 'Conditions générales',
    subtitle: `L’accord entre vous et ${ENTITY.brand} lorsque vous utilisez le service.`,
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'Sur cette page',
    sections: [
      {
        id: 'parties',
        heading: 'Avec qui vous contractez',
        blocks: [
          {
            kind: 'p',
            text: `${ENTITY.brand} est édité par ${ENTITY.publisher}, micro-entreprise immatriculée sous le SIREN ${ENTITY.siren}, dont l’adresse est ${ENTITY.address} (« nous »). Les présentes conditions régissent votre utilisation de ${ENTITY.siteUrl} et de l’application Synqit.`,
          },
          {
            kind: 'p',
            text: `La création d’un compte ou l’utilisation du service vaut acceptation des présentes conditions. Si vous ne les acceptez pas, n’utilisez pas Synqit. Vos questions : ${ENTITY.email.legal}.`,
          },
        ],
      },
      {
        id: 'service',
        heading: 'Ce que fait Synqit',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit fait deux choses. Il synchronise des playlists entre plateformes musicales, afin qu’une playlist suivie sur un service reste à jour sur un autre. Et il héberge des playlists d’événement collaboratives, où les invités ajoutent des morceaux via un lien que l’organisateur modère.',
          },
          {
            kind: 'p',
            text: 'Synqit est un outil qui agit sur les comptes musicaux que vous connectez. Ce n’est pas un service de musique : il n’héberge, ne diffuse et ne fournit aucun enregistrement. La lecture a lieu entièrement dans Spotify ou Apple Music, dans le cadre de votre abonnement auprès d’eux.',
          },
        ],
      },
      {
        id: 'account',
        heading: 'Votre compte',
        blocks: [
          {
            kind: 'list',
            items: [
              'Vous devez avoir au moins 15 ans pour créer un compte.',
              'Les informations que vous nous communiquez doivent être exactes, et votre adresse e-mail doit rester valide pour que nous puissions vous joindre.',
              'Vous êtes responsable de la confidentialité de votre mot de passe et de ce qui se produit sous votre compte.',
              'Un compte correspond à une personne. Ne partagez pas vos identifiants.',
              'Prévenez-nous sans délai si vous pensez que votre compte a été compromis.',
            ],
          },
        ],
      },
      {
        id: 'platforms',
        heading: 'Connexion aux plateformes musicales',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit n’est ni affilié, ni approuvé, ni sponsorisé par Spotify ou Apple. Spotify et Apple Music sont des marques de leurs titulaires respectifs, citées ici uniquement pour identifier les services auxquels Synqit se connecte.',
          },
          {
            kind: 'p',
            text: 'Utiliser Synqit avec une plateforme ne vous dispense pas des conditions de celle-ci. Vous devez y disposer d’un compte valide, et certaines fonctionnalités peuvent exiger un abonnement payant de leur côté. Si une plateforme modifie ou retire son API, restreint notre accès ou suspend votre compte, les fonctionnalités qui en dépendent peuvent cesser de fonctionner : cela échappe à notre contrôle et n’engage pas notre responsabilité.',
          },
          {
            kind: 'p',
            text: 'Vous nous autorisez à agir sur vos comptes connectés strictement dans la limite des permissions accordées, et uniquement pour exécuter les synchronisations et les événements que vous avez configurés.',
          },
        ],
      },
      {
        id: 'matching',
        heading: 'Ce que nous pouvons — et ne pouvons pas — garantir',
        blocks: [
          {
            kind: 'p',
            text: 'Les catalogues diffèrent d’une plateforme à l’autre. Un morceau disponible sur l’une peut manquer sur l’autre, y figurer dans une version différente, ou être géo-restreint. Synqit apparie les morceaux avec le plus de justesse possible et signale ce qu’il n’a pas pu apparier, mais nous ne pouvons garantir ni le transfert intégral d’une playlist, ni que l’appariement corresponde toujours exactement à l’enregistrement voulu.',
          },
          {
            kind: 'p',
            text: 'Les synchronisations s’exécutent périodiquement et non instantanément, et peuvent échouer si une plateforme est indisponible ou si une connexion a expiré. Synqit est fourni comme un service de confort, non comme une solution de sauvegarde : conservez votre propre copie de ce que vous ne pouvez pas perdre.',
          },
        ],
      },
      {
        id: 'content',
        heading: 'Vos contenus et vos événements',
        blocks: [
          {
            kind: 'p',
            text: 'Vous conservez tous vos droits sur les contenus que vous créez — noms et descriptions d’événements, playlists que vous composez. Vous ne nous accordez que l’autorisation nécessaire pour héberger et afficher ces contenus afin d’exécuter le service pour vous et, pour un événement, pour les invités que vous conviez.',
          },
          {
            kind: 'p',
            text: 'Si vous organisez un événement, vous êtes responsable du lien que vous diffusez et de la modération des ajouts des invités. Vous devez avoir le droit d’inviter les personnes que vous invitez et respecter leur vie privée, y compris en leur indiquant, s’ils le demandent, l’usage fait de l’événement et de son récapitulatif.',
          },
        ],
      },
      {
        id: 'acceptable-use',
        heading: 'Usage acceptable',
        blocks: [
          {
            kind: 'p',
            text: 'Vous vous engagez à ne pas :',
          },
          {
            kind: 'list',
            items: [
              'Utiliser Synqit pour porter atteinte au droit d’auteur, ni pour télécharger, extraire ou redistribuer des enregistrements.',
              'Contourner via Synqit les quotas, les conditions ou les protections techniques d’une plateforme.',
              'Automatiser l’accès au service en dehors des interfaces que nous fournissons, ni le moissonner à grande échelle.',
              'Publier ou partager des contenus illicites, harcelants, haineux ou portant atteinte aux droits d’autrui.',
              'Tenter d’accéder au compte ou aux données d’un autre utilisateur, ni sonder le service à la recherche de vulnérabilités sans notre autorisation écrite.',
              'Revendre ou proposer le service en marque blanche sans accord écrit de notre part.',
            ],
          },
          {
            kind: 'p',
            text:
              'Si vous découvrez une faille de sécurité, signalez-la à ' +
              ENTITY.email.legal +
              ' avant toute divulgation publique. Nous n’engagerons aucune action contre un chercheur de bonne foi qui nous laisse un délai raisonnable pour corriger.',
          },
        ],
      },
      {
        id: 'plans',
        heading: 'Offres, prix et paiement',
        blocks: [
          {
            kind: 'p',
            text: 'Synqit propose une offre gratuite et des options payantes. Les offres événement s’achètent une fois, pour un événement. Les offres de partage débloquent des fonctionnalités sur votre compte. Les fonctionnalités de chaque offre et leurs prix sont ceux affichés sur notre page tarifs au moment de l’achat.',
          },
          {
            kind: 'p',
            text: 'Les prix sont en euros et incluent la TVA le cas échéant. En tant que micro-entreprise relevant de la franchise en base, nous pouvons facturer sans TVA — la mention « TVA non applicable, art. 293 B du CGI » figure alors sur la facture.',
          },
          {
            kind: 'p',
            text: 'Nous pouvons faire évoluer nos prix pour l’avenir. Une évolution n’affecte jamais une offre événement déjà payée. Si le prix d’une offre récurrente change, nous vous en informons à l’avance et vous pouvez résilier avant son entrée en vigueur.',
          },
        ],
      },
      {
        id: 'withdrawal',
        heading: 'Droit de rétractation',
        blocks: [
          {
            kind: 'p',
            text: 'Si vous êtes consommateur dans l’Union européenne, vous disposez en principe de quatorze jours à compter de votre achat pour vous rétracter, sans avoir à vous justifier (art. L221-18 du code de la consommation).',
          },
          {
            kind: 'note',
            text: 'Synqit étant un contenu numérique fourni immédiatement, nous vous demandons de confirmer au moment du paiement que vous souhaitez un accès immédiat et que vous reconnaissez perdre votre droit de rétractation une fois le service pleinement exécuté (art. L221-28, 13°). À défaut de cette confirmation, vos quatorze jours courent normalement et les fonctionnalités payantes démarrent à l’issue de ce délai.',
          },
          {
            kind: 'p',
            text: `Pour vous rétracter, écrivez à ${ENTITY.email.legal} dans le délai. Le remboursement intervient par le même moyen de paiement, dans les quatorze jours suivant la réception de votre demande.`,
          },
        ],
      },
      {
        id: 'availability',
        heading: 'Disponibilité et évolutions',
        blocks: [
          {
            kind: 'p',
            text: 'Nous mettons tout en œuvre pour maintenir Synqit disponible, sans garantir un service ininterrompu. Nous pouvons l’interrompre pour maintenance, et ajouter, modifier ou retirer des fonctionnalités au fil du développement. Si nous retirons une fonctionnalité essentielle d’une offre que vous avez payée, nous vous proposerons une solution équitable : un remplacement ou un remboursement proportionnel.',
          },
        ],
      },
      {
        id: 'termination',
        heading: 'Suspension et fermeture du compte',
        blocks: [
          {
            kind: 'p',
            text: 'Vous pouvez fermer votre compte à tout moment depuis vos réglages. Cette fermeture entraîne la suppression de vos données personnelles dans les conditions décrites par notre politique de confidentialité.',
          },
          {
            kind: 'p',
            text: 'Nous pouvons suspendre ou fermer un compte qui enfreint les présentes conditions, fait l’objet d’un usage illicite, ou met en risque le service ou ses autres utilisateurs. Sauf manquement grave ou obligation légale d’agir immédiatement, nous vous adressons d’abord un avertissement et la possibilité de régulariser. Si nous fermons un compte payant sans motif, nous remboursons la part non utilisée.',
          },
        ],
      },
      {
        id: 'liability',
        heading: 'Responsabilité',
        blocks: [
          {
            kind: 'p',
            text: 'Rien dans les présentes n’exclut notre responsabilité en cas de dommage corporel causé par notre négligence, de dol, de vice caché, ni pour tout autre cas que le droit français ne permet pas d’exclure. Les consommateurs conservent le plein bénéfice de la garantie légale de conformité (art. L217-3 et suivants du code de la consommation).',
          },
          {
            kind: 'p',
            text: 'Au-delà, nous ne répondons pas des dommages indirects ou imprévisibles, de la perte de données dont vous pouviez conserver une copie, ni d’une défaillance imputable à une plateforme musicale, à votre accès internet ou à tout autre événement échappant à notre contrôle raisonnable. Lorsque notre responsabilité peut être plafonnée, elle l’est à hauteur des sommes que vous nous avez versées au cours des douze mois précédant le fait générateur.',
          },
        ],
      },
      {
        id: 'ip',
        heading: 'Notre propriété intellectuelle',
        blocks: [
          {
            kind: 'p',
            text: 'Le nom Synqit, le logo, l’interface et le logiciel qui les sous-tend nous appartiennent. Les présentes conditions vous confèrent un droit d’usage personnel, non exclusif et non cessible sur le service, et rien de plus. Vous ne pouvez ni le copier, ni le décompiler, ni en tirer des œuvres dérivées, hors des cas expressément permis par la loi.',
          },
        ],
      },
      {
        id: 'law',
        heading: 'Droit applicable et litiges',
        blocks: [
          {
            kind: 'p',
            text: 'Les présentes conditions sont régies par le droit français. Si vous êtes consommateur, cela ne vous prive pas de la protection des dispositions impératives du pays où vous résidez.',
          },
          {
            kind: 'p',
            text: `En cas de difficulté, écrivez d’abord à ${ENTITY.email.legal} : la plupart des situations se règlent ainsi. À défaut de solution, le consommateur peut recourir gratuitement à un médiateur de la consommation, ou à la plateforme européenne de règlement en ligne des litiges : ec.europa.eu/consumers/odr. Faute d’accord, le litige relève des juridictions françaises compétentes.`,
          },
          {
            kind: 'note',
            text: 'TODO(legal) : le droit français impose au professionnel vendant à des consommateurs de désigner un médiateur de la consommation référencé (art. L612-1 du code de la consommation). Indiquez ici le nom, l’adresse et le site de votre médiateur une fois l’adhésion souscrite.',
          },
        ],
      },
      {
        id: 'changes',
        heading: 'Modification des conditions',
        blocks: [
          {
            kind: 'p',
            text: 'Nous pouvons faire évoluer les présentes conditions au fil du service. La date en haut de page indique la version en vigueur. Pour toute modification substantielle, nous vous prévenons au moins trente jours à l’avance ; si vous ne l’acceptez pas, vous pouvez fermer votre compte avant son entrée en vigueur.',
          },
        ],
      },
    ],
  },
};
