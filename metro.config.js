const { execSync } = require('child_process');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

// An Intel-only watchman (old /usr/local Homebrew) crashes on Apple Silicon without Rosetta:
// fall back to Metro's own file crawler when it cannot run.
try {
  execSync('watchman --version', { stdio: 'ignore', timeout: 5000 });
} catch {
  config.resolver.useWatchman = false;
}

module.exports = config;
