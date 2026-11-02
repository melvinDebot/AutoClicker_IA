import { TEXT } from '../rules';
import { levenshtein, normalizeText, parseCount, textMatches, textStartsLike, usernameMatches, usernamePrefixMatches } from '../text';

describe('OCR-tolerant text matching (misreads seen on the screenshots)', () => {
  it('normalizes accents, dotless i and quotes', () => {
    expect(normalizeText('  À la UNE ')).toBe('a la une');
    expect(normalizeText('sa.ına775z')).toBe('sa.ina775z');
    expect(normalizeText('“Bless”')).toBe('"bless"');
  });

  it('accepts names whose underscores OCR dropped (seen: "son | of | 90d")', () => {
    expect(usernameMatches('sonof90d', 'son____of_____god')).toBe(true);
    expect(usernameMatches('sonofman', 'son____of_____god')).toBe(false);
  });

  it('confirms a truncated profile header by its start (seen: "< | son | _of_")', () => {
    expect(usernamePrefixMatches('<son_of_', 'son____of_____god')).toBe(true);
    expect(usernamePrefixMatches('so', 'son____of_____god')).toBe(false);
    expect(usernamePrefixMatches('sonofman', 'son____of_____god')).toBe(false);
  });

  it('accepts double underscores merged by OCR (seen on the simulator)', () => {
    expect(usernameMatches('talk_to_me_l_god_talk_to_me', 'talk_to_me__l__god_talk_to_me')).toBe(true);
    expect(usernameMatches('user_00', 'user__01')).toBe(false);
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
