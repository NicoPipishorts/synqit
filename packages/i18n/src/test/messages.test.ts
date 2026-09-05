import { interpolate, lookupMessage, resolvePath, translate } from '../messages';

const en = {
  auth: { title: 'Welcome back', hello: 'Hello {{name}}' },
  tracks_one: '{{count}} track',
  tracks_other: '{{count}} tracks',
  onlyEnglish: 'English only',
};
const fr = { auth: { title: 'Bon retour' } };

describe('messages', () => {
  it('resolves dotted paths and ignores non-strings', () => {
    expect(resolvePath(en, 'auth.title')).toBe('Welcome back');
    expect(resolvePath(en, 'auth')).toBeNull();
    expect(resolvePath(en, 'missing.key')).toBeNull();
  });

  it('interpolates placeholders and leaves unknown ones alone', () => {
    expect(interpolate('Hi {{name}}, {{other}}', { name: 'Ada' })).toBe('Hi Ada, {{other}}');
  });

  it('prefers plural forms when count is provided', () => {
    expect(lookupMessage(en, 'tracks', { count: 1 })).toBe('{{count}} track');
    expect(lookupMessage(en, 'tracks', { count: 3 })).toBe('{{count}} tracks');
    expect(lookupMessage(en, 'tracks')).toBeNull();
  });

  it('falls back to the fallback dictionary and then to the key', () => {
    expect(translate(fr, en, 'auth.title')).toBe('Bon retour');
    expect(translate(fr, en, 'onlyEnglish')).toBe('English only');
    expect(translate(fr, en, 'nope.nothing')).toBe('nope.nothing');
    expect(translate(fr, en, 'tracks', { count: 2 })).toBe('2 tracks');
  });
});
