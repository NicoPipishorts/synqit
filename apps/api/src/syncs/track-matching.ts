/**
 * Deciding whether a search result is the same recording as the source track.
 *
 * Services do not spell titles the same way. Apple ships "Ego Death (feat.
 * Aesop Rock & Danny Brown)" where Spotify has "Ego Death", and it sends curly
 * apostrophes where Spotify sends straight ones. Comparing the raw strings —
 * or asking one to contain the other — throws away most of a rap playlist,
 * which is exactly what it did.
 */

export type MatchCandidate = {
  providerTrackId: string;
  name: string;
  artist: string;
  durationMs?: number;
};

const FEATURE_BLOCK = /\s*[([]\s*(feat|ft|featuring|with)\.?\s[^)\]]*[)\]]/g;
const TRAILING_FEATURE = /\s+-\s+(feat|ft|featuring)\.?\s.*$/;

/** Folds away the differences that are spelling rather than identity. */
export const normalizeTitleForMatch = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(FEATURE_BLOCK, ' ')
    .replace(TRAILING_FEATURE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** First credited artist, normalised: services differ on who else they list. */
export const normalizeArtistForMatch = (value: string): string =>
  normalizeTitleForMatch(value.split(/,|&|feat\.|ft\./i)[0] ?? value);

const titlesAgree = (a: string, b: string): boolean =>
  a.length > 0 && b.length > 0 && (a === b || a.includes(b) || b.includes(a));

/**
 * Best candidate for a source track, or null when none is close enough.
 *
 * A title agreement alone is not enough — "Sniper" is a hundred different
 * songs — so a candidate needs its artist to agree too, unless the source has
 * no artist to compare. Ordering is by the service's own relevance, so the
 * first candidate that clears the bar wins.
 */
export const pickBestTrackMatch = <T extends MatchCandidate>(
  source: { name: string; artist: string },
  candidates: readonly T[],
): T | null => {
  const sourceTitle = normalizeTitleForMatch(source.name);
  const sourceArtist = normalizeArtistForMatch(source.artist);
  if (sourceTitle.length === 0) {
    return null;
  }

  const scored = candidates
    .map((candidate) => {
      const title = normalizeTitleForMatch(candidate.name);
      if (!titlesAgree(sourceTitle, title)) {
        return null;
      }
      const artist = normalizeArtistForMatch(candidate.artist);
      const artistAgrees = titlesAgree(sourceArtist, artist);
      if (sourceArtist.length > 0 && !artistAgrees) {
        return null;
      }
      // An exact title beats one that merely contains the other, so a remix or
      // a live version cannot outrank the recording itself.
      return { candidate, exact: title === sourceTitle };
    })
    .filter((entry): entry is { candidate: T; exact: boolean } => entry !== null);

  return (scored.find((entry) => entry.exact) ?? scored[0])?.candidate ?? null;
};

/**
 * Query for the text search. The feature credits are noise to a search engine
 * that already has the artist, and a long one pushes the recording itself off
 * the top of the results.
 */
export const buildSearchQuery = (track: { name: string; artist: string }): string =>
  `${track.name.replace(FEATURE_BLOCK, ' ').replace(TRAILING_FEATURE, ' ').trim()} ${track.artist}`.trim();
