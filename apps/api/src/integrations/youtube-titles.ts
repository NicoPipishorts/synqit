/**
 * YouTube has no structured track metadata: a playlist item is a video whose
 * title is free text ("Artist - Song (Official Video)") and whose channel is
 * usually the artist ("Artist - Topic" for the auto-generated music catalogue).
 * Both the anonymous link import and the connected provider read through here
 * so the two agree on what a video is called.
 */

const YOUTUBE_JUNK = [
  /\((official|lyric|lyrics|audio|video|visualizer|hd|hq|4k|remaster(ed)?( \d{4})?|clip officiel|official video|official audio|official music video)[^)]*\)/gi,
  /\[(official|lyric|lyrics|audio|video|visualizer|hd|hq|4k|remaster(ed)?( \d{4})?)[^\]]*\]/gi,
  /\b(official\s+(music\s+)?video|official\s+audio|lyric\s+video|lyrics|visuali[sz]er|clip officiel)\b/gi,
  /\bft\.?\s+[^-|(]+$/i,
  /\bfeat\.?\s+[^-|(]+$/i,
];

const cleanYoutubeText = (value: string): string =>
  YOUTUBE_JUNK.reduce((text, pattern) => text.replace(pattern, ' '), value)
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, '')
    .trim();

const cleanChannelTitle = (value: string): string =>
  value
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .trim();

/** "Artist - Title (Official Video)" -> { artist, name }; falls back to the channel as artist. */
export const parseYoutubeTitle = (
  title: string,
  channelTitle: string | null,
): { name: string; artist: string } => {
  const cleaned = cleanYoutubeText(title);
  const separators = [' - ', ' – ', ' — ', ' | ', ': '];
  for (const separator of separators) {
    const index = cleaned.indexOf(separator);
    if (index > 0) {
      const artist = cleaned.slice(0, index).trim();
      const name = cleaned.slice(index + separator.length).trim();
      if (artist && name) {
        return { artist, name };
      }
    }
  }
  const fallbackArtist = channelTitle ? cleanChannelTitle(channelTitle) : '';
  return { name: cleaned || title, artist: fallbackArtist };
};

/** Placeholder rows YouTube leaves in a playlist for videos it can no longer show. */
export const isYoutubePlaceholderTitle = (title: string): boolean =>
  title === 'Private video' || title === 'Deleted video';
