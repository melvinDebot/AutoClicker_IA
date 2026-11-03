import { canInject, displayUrl, parseInstagramUrl, shouldLoadInWebView } from '../url';

describe('parseInstagramUrl', () => {
  it.each([
    ['https://www.instagram.com/', { kind: 'home' }],
    ['https://www.instagram.com/accounts/login/?next=%2F', { kind: 'login' }],
    ['https://www.instagram.com/accounts/onetap/?next=%2F', { kind: 'account_check' }],
    ['https://www.instagram.com/challenge/action/AXG/', { kind: 'account_check' }],
    ['https://www.instagram.com/two_factor/?next=%2F', { kind: 'account_check' }],
    ['https://www.instagram.com/atelier.lumen/', { kind: 'profile', username: 'atelier.lumen' }],
    ['https://www.instagram.com/atelier.lumen/followers/', { kind: 'followers', username: 'atelier.lumen' }],
    ['https://www.instagram.com/atelier.lumen/following/', { kind: 'following', username: 'atelier.lumen' }],
    ['https://www.instagram.com/stories/lea.vrt/3412345/', { kind: 'story', username: 'lea.vrt' }],
    ['https://www.instagram.com/p/C1abcDEF/', { kind: 'post' }],
    ['https://www.instagram.com/reel/C1abcDEF/', { kind: 'post' }],
    ['https://www.instagram.com/lea.vrt/p/C1abcDEF/', { kind: 'post', username: 'lea.vrt' }],
    ['https://www.instagram.com/explore/', { kind: 'other' }],
    ['https://www.facebook.com/login.php', { kind: 'external' }],
    ['http://www.instagram.com/atelier.lumen/', { kind: 'external' }],
    // Development builds only: the local fake Instagram on this exact origin, nothing else on localhost.
    ['http://localhost:8099/ac.fixture/followers/', { kind: 'followers', username: 'ac.fixture' }],
    ['http://localhost:8098/ac.fixture/followers/', { kind: 'external' }],
    ['not a url', { kind: 'external' }],
  ])('%s', (url, expected) => {
    expect(parseInstagramUrl(url)).toEqual(expected);
  });
});

describe('canInject (guardrail: never on sign-in or account pages)', () => {
  it.each([
    'https://www.instagram.com/accounts/login/',
    'https://www.instagram.com/accounts/login/?next=%2Fatelier.lumen%2Ffollowers%2F',
    'https://www.instagram.com/accounts/password/reset/',
    'https://www.instagram.com/accounts/emailsignup/',
    'https://www.instagram.com/accounts/edit/',
    'https://www.instagram.com/challenge/',
    'https://www.instagram.com/two_factor/',
    'https://www.instagram.com/auth_platform/codeentry/',
    'https://www.facebook.com/login.php',
    'https://accounts.google.com/',
    'about:blank',
  ])('refuses %s', (url) => {
    expect(canInject(url)).toBe(false);
  });

  it.each([
    'https://www.instagram.com/',
    'https://www.instagram.com/atelier.lumen/followers/',
    'https://www.instagram.com/stories/lea.vrt/3412345/',
    'https://www.instagram.com/p/C1abcDEF/',
  ])('allows %s', (url) => {
    expect(canInject(url)).toBe(true);
  });
});

describe('shouldLoadInWebView', () => {
  it('keeps web pages in the WebView', () => {
    expect(shouldLoadInWebView('https://www.instagram.com/')).toBe(true);
    expect(shouldLoadInWebView('about:blank')).toBe(true);
  });
  it('blocks app deep links', () => {
    expect(shouldLoadInWebView('instagram://user?username=x')).toBe(false);
    expect(shouldLoadInWebView('itms-apps://apps.apple.com/app/id389801252')).toBe(false);
  });
});

describe('displayUrl', () => {
  it('drops the scheme and www', () => {
    expect(displayUrl('https://www.instagram.com/atelier.lumen/followers/')).toBe('instagram.com/atelier.lumen/followers/');
    expect(displayUrl('https://www.instagram.com/')).toBe('instagram.com');
  });
});
