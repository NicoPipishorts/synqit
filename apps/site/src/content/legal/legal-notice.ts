import { ENTITY, LEGAL_UPDATED_AT } from './entity';
import { type LegalDocumentSet } from './types';

// Mentions légales — mandatory for a site operated from France (LCEN, art. 6-III).
// The French version is the reference text; the English one is a courtesy translation.
export const legalNoticeDocument: LegalDocumentSet = {
  en: {
    title: 'Legal Notice',
    subtitle: 'Publisher, hosting and contact details for this website.',
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'On this page',
    sections: [
      {
        id: 'publisher',
        heading: 'Site publisher',
        blocks: [
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Publisher', `${ENTITY.publisher}, sole trader (micro-entreprise)`],
              ['Trading name', ENTITY.brand],
              ['SIREN', ENTITY.siren],
              ['Registered address', ENTITY.address],
              ['VAT', 'Not applicable — art. 293 B of the French General Tax Code'],
              ['Publication director', ENTITY.publicationDirector],
              ['Contact', ENTITY.email.legal],
            ],
          },
        ],
      },
      {
        id: 'host',
        heading: 'Hosting',
        blocks: [
          {
            kind: 'p',
            text: 'This site and the Synqit application are hosted by:',
          },
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Host', ENTITY.host.name],
              ['Address', ENTITY.host.address],
            ],
          },
        ],
      },
      {
        id: 'ip',
        heading: 'Intellectual property',
        blocks: [
          {
            kind: 'p',
            text: `The structure, design, text, graphics and software of ${ENTITY.domain} are protected by intellectual property law and belong to ${ENTITY.publisher}, except where stated otherwise. Any reproduction or reuse without prior written permission is prohibited.`,
          },
          {
            kind: 'p',
            text: 'Spotify and Apple Music are trademarks of their respective owners. Synqit is not affiliated with, endorsed by, or sponsored by them; their names and logos appear here only to identify the services Synqit connects to.',
          },
        ],
      },
      {
        id: 'data',
        heading: 'Personal data and cookies',
        blocks: [
          {
            kind: 'p',
            text: `Personal data processing is described in our Privacy Policy, and browser storage in our Cookie Notice. For any request concerning your data, write to ${ENTITY.email.privacy}. You may lodge a complaint with the CNIL — 3 place de Fontenoy, 75007 Paris, cnil.fr.`,
          },
        ],
      },
      {
        id: 'report',
        heading: 'Reporting unlawful content',
        blocks: [
          {
            kind: 'p',
            text: `To report content on Synqit that you believe is unlawful, write to ${ENTITY.email.legal} with a description of the content, its location, and the reason you consider it unlawful. We review every report.`,
          },
        ],
      },
    ],
  },

  fr: {
    title: 'Mentions légales',
    subtitle: 'Éditeur, hébergement et contacts de ce site.',
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'Sur cette page',
    sections: [
      {
        id: 'publisher',
        heading: 'Éditeur du site',
        blocks: [
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Éditeur', `${ENTITY.publisher}, entrepreneur individuel (micro-entreprise)`],
              ['Nom commercial', ENTITY.brand],
              ['SIREN', ENTITY.siren],
              ['Adresse', ENTITY.address],
              ['TVA', 'Non applicable — art. 293 B du CGI'],
              ['Directeur de la publication', ENTITY.publicationDirector],
              ['Contact', ENTITY.email.legal],
            ],
          },
        ],
      },
      {
        id: 'host',
        heading: 'Hébergement',
        blocks: [
          {
            kind: 'p',
            text: 'Le présent site et l’application Synqit sont hébergés par :',
          },
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Hébergeur', ENTITY.host.name],
              ['Adresse', ENTITY.host.address],
            ],
          },
        ],
      },
      {
        id: 'ip',
        heading: 'Propriété intellectuelle',
        blocks: [
          {
            kind: 'p',
            text: `La structure, le design, les textes, les éléments graphiques et le logiciel de ${ENTITY.domain} sont protégés par le droit de la propriété intellectuelle et appartiennent à ${ENTITY.publisher}, sauf mention contraire. Toute reproduction ou réutilisation sans autorisation écrite préalable est interdite.`,
          },
          {
            kind: 'p',
            text: 'Spotify et Apple Music sont des marques de leurs titulaires respectifs. Synqit n’est ni affilié, ni approuvé, ni sponsorisé par eux ; leurs noms et logos ne figurent ici que pour identifier les services auxquels Synqit se connecte.',
          },
        ],
      },
      {
        id: 'data',
        heading: 'Données personnelles et cookies',
        blocks: [
          {
            kind: 'p',
            text: `Les traitements de données personnelles sont décrits dans notre politique de confidentialité, et le stockage navigateur dans notre notice cookies. Pour toute demande relative à vos données, écrivez à ${ENTITY.email.privacy}. Vous pouvez introduire une réclamation auprès de la CNIL — 3 place de Fontenoy, 75007 Paris, cnil.fr.`,
          },
        ],
      },
      {
        id: 'report',
        heading: 'Signaler un contenu illicite',
        blocks: [
          {
            kind: 'p',
            text: `Pour signaler un contenu que vous estimez illicite sur Synqit, écrivez à ${ENTITY.email.legal} en précisant le contenu, sa localisation et le motif du signalement. Chaque signalement est examiné.`,
          },
        ],
      },
    ],
  },

  es: {
    title: 'Aviso legal',
    subtitle: 'Editor, alojamiento y datos de contacto de este sitio web.',
    updated: LEGAL_UPDATED_AT,
    tocLabel: 'En esta página',
    sections: [
      {
        id: 'publisher',
        heading: 'Editor del sitio',
        blocks: [
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Editor', `${ENTITY.publisher}, empresario individual (micro-entreprise)`],
              ['Nombre comercial', ENTITY.brand],
              ['SIREN', ENTITY.siren],
              ['Domicilio declarado', ENTITY.address],
              ['IVA', 'No aplicable — art. 293 B del Código General de Impuestos francés'],
              ['Director de la publicación', ENTITY.publicationDirector],
              ['Contacto', ENTITY.email.legal],
            ],
          },
        ],
      },
      {
        id: 'host',
        heading: 'Alojamiento',
        blocks: [
          {
            kind: 'p',
            text: 'Este sitio y la aplicación Synqit están alojados por:',
          },
          {
            kind: 'table',
            head: ['', ''],
            rows: [
              ['Proveedor de alojamiento', ENTITY.host.name],
              ['Dirección', ENTITY.host.address],
            ],
          },
        ],
      },
      {
        id: 'ip',
        heading: 'Propiedad intelectual',
        blocks: [
          {
            kind: 'p',
            text: `La estructura, el diseño, los textos, los elementos gráficos y el software de ${ENTITY.domain} están protegidos por el derecho de propiedad intelectual y pertenecen a ${ENTITY.publisher}, salvo que se indique lo contrario. Queda prohibida cualquier reproducción o reutilización sin autorización previa por escrito.`,
          },
          {
            kind: 'p',
            text: 'Spotify y Apple Music son marcas de sus respectivos titulares. Synqit no está afiliado a ellos ni cuenta con su respaldo o patrocinio; sus nombres y logotipos aparecen aquí únicamente para identificar los servicios a los que Synqit se conecta.',
          },
        ],
      },
      {
        id: 'data',
        heading: 'Datos personales y cookies',
        blocks: [
          {
            kind: 'p',
            text: `El tratamiento de datos personales se describe en nuestra política de privacidad, y el almacenamiento en el navegador, en nuestro aviso sobre cookies. Para cualquier solicitud relativa a tus datos, escribe a ${ENTITY.email.privacy}. Puedes presentar una reclamación ante la CNIL — 3 place de Fontenoy, 75007 París, cnil.fr.`,
          },
        ],
      },
      {
        id: 'report',
        heading: 'Denunciar un contenido ilícito',
        blocks: [
          {
            kind: 'p',
            text: `Para denunciar un contenido de Synqit que consideres ilícito, escribe a ${ENTITY.email.legal} indicando el contenido, dónde se encuentra y el motivo por el que lo consideras ilícito. Revisamos todas las denuncias.`,
          },
        ],
      },
    ],
  },
};
