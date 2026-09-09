import type { ExternalSourceTrack } from '@synqit/shared';
import { createHash } from 'node:crypto';

/**
 * Turns a file a listener already has into a track list the import funnel can
 * match: a CSV export (Spotify's Exportify, Soundiiz, TuneMyMusic, a spreadsheet),
 * an M3U/M3U8 playlist, or a plain pasted tracklist. No service is involved on
 * the source side, so this covers every app Synqit will never connect to.
 *
 * Detection is by content, with the file name as a hint. Anything that is not
 * recognisably CSV or M3U is read line by line as "Artist - Title".
 */

export type ParsedTracklist = {
  format: 'csv' | 'm3u' | 'text';
  name: string;
  tracks: ExternalSourceTrack[];
  /** Total rows that looked like tracks, before `maxTracks` was applied. */
  trackCount: number;
  truncated: boolean;
  /** Stable id for the content, so the same file re-imported is recognisable. */
  contentId: string;
};

const DEFAULT_NAME = 'Imported playlist';

/** Column names seen in the wild, lower-cased, per field. First match wins. */
const COLUMN_ALIASES: Record<keyof TrackColumns, readonly string[]> = {
  name: ['track name', 'track', 'title', 'name', 'song', 'song name', 'titre', 'track title'],
  artist: [
    'artist name(s)',
    'artist name',
    'artist names',
    'artists',
    'artist',
    'artiste',
    'artistes',
    'performer',
  ],
  album: ['album name', 'album', 'release'],
  isrc: ['isrc'],
  durationMs: ['duration (ms)', 'duration_ms', 'duration ms', 'length (ms)'],
  durationSeconds: ['duration (s)', 'duration', 'length', 'time', 'durée'],
};

type TrackColumns = {
  name: number | null;
  artist: number | null;
  album: number | null;
  isrc: number | null;
  durationMs: number | null;
  durationSeconds: number | null;
};

const SEPARATORS = [' - ', ' – ', ' — ', ' | ', ' / '];

const stripExtension = (fileName: string): string => fileName.replace(/\.[a-z0-9]+$/i, '').trim();

const cleanIsrc = (value: string | undefined): string | null => {
  const compact = (value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(compact) ? compact : null;
};

/** "3:45", "225", "225000" (ms) or "PT3M45S" to milliseconds; 0 when unreadable. */
const parseDurationMs = (value: string | undefined, unit: 'ms' | 's' | 'auto'): number => {
  const raw = (value ?? '').trim();
  if (!raw) {
    return 0;
  }
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(raw);
  if (clock) {
    const [, a, b, c] = clock;
    const seconds = c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
    return seconds * 1000;
  }
  const number = Number(raw.replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  if (unit === 'ms') {
    return Math.round(number);
  }
  if (unit === 's') {
    return Math.round(number * 1000);
  }
  // Auto: anything over an hour expressed in "seconds" is really milliseconds.
  return number > 36_000 ? Math.round(number) : Math.round(number * 1000);
};

const track = (params: {
  name: string;
  artist: string;
  album?: string;
  durationMs?: number;
  isrc?: string | null;
}): ExternalSourceTrack => ({
  name: params.name.trim(),
  artist: params.artist.trim(),
  album: (params.album ?? '').trim(),
  durationMs: Math.max(0, params.durationMs ?? 0),
  artworkUrl: null,
  isrc: params.isrc ?? null,
});

/** "Artist - Title", "Title by Artist", "01. Artist - Title", "Artist<tab>Title". */
export const parseTrackLine = (line: string): { name: string; artist: string } | null => {
  const cleaned = line
    .replace(/^\s*(\d{1,4}[.)]|\d{1,4}\s*[-–—]|[-*•])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.startsWith('#')) {
    return null;
  }

  const tabbed = line
    .split('\t')
    .map((part) => part.trim())
    .filter(Boolean);
  if (tabbed.length >= 2) {
    return { artist: tabbed[0]!, name: tabbed[1]! };
  }

  for (const separator of SEPARATORS) {
    const index = cleaned.indexOf(separator);
    if (index > 0) {
      const artist = cleaned.slice(0, index).trim();
      const name = cleaned.slice(index + separator.length).trim();
      if (artist && name) {
        return { artist, name };
      }
    }
  }

  const by = /^(.+?)\s+by\s+(.+)$/i.exec(cleaned);
  if (by) {
    return { name: by[1]!.trim(), artist: by[2]!.trim() };
  }

  return { name: cleaned, artist: '' };
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180 rows, with `;` and tab accepted as delimiters since spreadsheets export them. */
const parseCsvRows = (content: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
};

const detectDelimiter = (headerLine: string): string => {
  const counts = [',', ';', '\t'].map((delimiter) => ({
    delimiter,
    count: headerLine.split(delimiter).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0]!.count > 0
    ? counts.sort((a, b) => b.count - a.count)[0]!.delimiter
    : ',';
};

const mapColumns = (header: string[]): TrackColumns => {
  const normalized = header.map((cell) => cell.trim().toLowerCase().replace(/^﻿/, ''));
  const find = (aliases: readonly string[]): number | null => {
    for (const alias of aliases) {
      const index = normalized.indexOf(alias);
      if (index !== -1) {
        return index;
      }
    }
    return null;
  };
  return {
    name: find(COLUMN_ALIASES.name),
    artist: find(COLUMN_ALIASES.artist),
    album: find(COLUMN_ALIASES.album),
    isrc: find(COLUMN_ALIASES.isrc),
    durationMs: find(COLUMN_ALIASES.durationMs),
    durationSeconds: find(COLUMN_ALIASES.durationSeconds),
  };
};

const parseCsv = (content: string): ExternalSourceTrack[] | null => {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsvRows(content, delimiter);
  if (rows.length < 2) {
    return null;
  }
  const columns = mapColumns(rows[0]!);
  if (columns.name === null) {
    return null;
  }

  return rows.slice(1).flatMap((row) => {
    const name = row[columns.name!]?.trim() ?? '';
    if (!name) {
      return [];
    }
    const durationMs =
      columns.durationMs !== null
        ? parseDurationMs(row[columns.durationMs], 'ms')
        : columns.durationSeconds !== null
          ? parseDurationMs(row[columns.durationSeconds], 'auto')
          : 0;
    return [
      track({
        name,
        artist: columns.artist !== null ? (row[columns.artist] ?? '') : '',
        album: columns.album !== null ? row[columns.album] : undefined,
        durationMs,
        isrc: columns.isrc !== null ? cleanIsrc(row[columns.isrc]) : null,
      }),
    ];
  });
};

// ---------------------------------------------------------------------------
// M3U / M3U8
// ---------------------------------------------------------------------------

const parseM3u = (content: string): { name: string | null; tracks: ExternalSourceTrack[] } => {
  const tracks: ExternalSourceTrack[] = [];
  let name: string | null = null;
  let pending: { durationMs: number; label: string } | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('#PLAYLIST:')) {
      name = line.slice('#PLAYLIST:'.length).trim() || null;
      continue;
    }
    if (line.startsWith('#EXTINF:')) {
      const body = line.slice('#EXTINF:'.length);
      const comma = body.indexOf(',');
      const seconds = Number.parseFloat(comma === -1 ? body : body.slice(0, comma));
      pending = {
        durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0,
        label: comma === -1 ? '' : body.slice(comma + 1).trim(),
      };
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    // A path or URL line closes the pending entry. Without an EXTINF, the file
    // name is all there is.
    const label =
      pending?.label || stripExtension(line.split(/[\\/]/).pop() ?? line).replace(/_/g, ' ');
    const parsed = parseTrackLine(label);
    if (parsed) {
      tracks.push(track({ ...parsed, durationMs: pending?.durationMs ?? 0 }));
    }
    pending = null;
  }
  if (pending?.label) {
    const parsed = parseTrackLine(pending.label);
    if (parsed) {
      tracks.push(track({ ...parsed, durationMs: pending.durationMs }));
    }
  }
  return { name, tracks };
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const parseText = (content: string): ExternalSourceTrack[] =>
  content
    .split(/\r?\n/)
    .map(parseTrackLine)
    .filter((entry): entry is { name: string; artist: string } => entry !== null)
    .map((entry) => track(entry));

const looksLikeCsv = (content: string, fileName: string | null): boolean => {
  if (fileName && /\.(csv|tsv)$/i.test(fileName)) {
    return true;
  }
  const firstLine = (content.split(/\r?\n/, 1)[0] ?? '').toLowerCase();
  return (
    (firstLine.includes(',') || firstLine.includes(';') || firstLine.includes('\t')) &&
    /\b(title|track|name|song|artist|isrc)\b/.test(firstLine)
  );
};

export const parseTracklist = (params: {
  fileName?: string | null;
  content: string;
  maxTracks: number;
}): ParsedTracklist => {
  const content = params.content.replace(/^﻿/, '');
  const fileName = params.fileName?.trim() || null;
  const fallbackName = fileName ? stripExtension(fileName) || DEFAULT_NAME : DEFAULT_NAME;

  let format: ParsedTracklist['format'] = 'text';
  let name = fallbackName;
  let tracks: ExternalSourceTrack[];

  if (/^\s*#EXTM3U/i.test(content) || (fileName && /\.m3u8?$/i.test(fileName))) {
    format = 'm3u';
    const parsed = parseM3u(content);
    name = parsed.name ?? fallbackName;
    tracks = parsed.tracks;
  } else if (looksLikeCsv(content, fileName)) {
    const parsed = parseCsv(content);
    if (parsed) {
      format = 'csv';
      tracks = parsed;
    } else {
      tracks = parseText(content);
    }
  } else {
    tracks = parseText(content);
  }

  const contentId = createHash('sha256').update(content).digest('hex').slice(0, 24);
  return {
    format,
    name,
    tracks: tracks.slice(0, params.maxTracks),
    trackCount: tracks.length,
    truncated: tracks.length > params.maxTracks,
    contentId,
  };
};
