import { TEXT } from '../rules';
import { levenshtein, normalizeText, parseCount, textMatches, textStartsLike, usernameMatches } from '../text';

describe('OCR-tolerant text matching (misreads seen on the screenshots)', () => {
  it('normalizes accents, dotless i and quotes', () => {
    expect(normalizeText('  À la UNE ')).toBe('a la une');
    expect(normalizeText('sa.ına775z')).toBe('sa.ina775z');
    expect(normalizeText('“Bless”')).toBe('"bless"');
  });

  it('splits ligatures read by OCR ("ﬁ.nouvelleviebsm")', () => {
    expect(usernameMatches('ﬁ.nouvelleviebsm', 'fi.nouvelleviebsm')).toBe(true);
  });

  it('accepts "tollowers" for followers', () => {
    expect(textMatches('tollowers', TEXT.followersWord)).toBe(true);
    expect(textMatches('tollowing', TEXT.followingWord)).toBe(true);
  });

  it('does not confuse close but different words', () => {
    expect(textMatches('following', TEXT.followersWord)).toBe(false);
    expect(textMatches('Follow', TEXT.privateNotice)).toBe(false);
    expect(textMatches('Message', TEXT.followButton)).toBe(false);
  });

  it('recognizes the private notice in English and French', () => {
    expect(textMatches('This profile is private', TEXT.privateNotice)).toBe(true);
    expect(textMatches('Ce compte est privé', TEXT.privateNotice)).toBe(true);
    expect(textStartsLike('Follow this profile to see their photos', TEXT.privateHint)).toBe(true);
  });

  it('confirms usernames despite i/l/I confusions', () => {
    expect(usernameMatches('Iyor.ouzana', 'lyor.ouzana')).toBe(true);
    expect(usernameMatches('hsicdd', 'hslcdd')).toBe(true);
    expect(usernameMatches('sa.ına775z', 'sa.ina775z')).toBe(true);
    expect(usernameMatches('gad_nathan', 'dorcia4621')).toBe(false);
  });

  it('parses Instagram counts', () => {
    expect(parseCount('12,1K')).toBe(12_100);
    expect(parseCount('1634')).toBe(1634);
    expect(parseCount('1 634')).toBe(1634);
    expect(parseCount('1,2 M')).toBe(1_200_000);
    expect(parseCount('abc')).toBeNull();
  });

  it('computes edit distance', () => {
    expect(levenshtein('followers', 'tollowers')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});
