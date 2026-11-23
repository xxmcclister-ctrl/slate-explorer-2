import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIMATED_THEMES,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_SPEED,
  MAX_THEME_SPEED,
  MIN_THEME_SPEED,
  STATIC_THEMES,
  THEME_LIST,
  clampThemeSpeed,
  computeThemeDurationSeconds,
  formatThemeSpeed,
  getThemeDefinition,
  normalizeThemeId,
} from './themeRegistry';

test('themeRegistry provides at least 6 distinct animated themes alongside static themes', () => {
  assert.equal(ANIMATED_THEMES.length, 6);
  assert.ok(STATIC_THEMES.length >= 2);
  const ids = new Set(THEME_LIST.map((t) => t.id));
  assert.equal(ids.size, THEME_LIST.length);
  for (const theme of ANIMATED_THEMES) {
    assert.equal(theme.animated, true);
    assert.ok(theme.backdropEffect);
    assert.equal(theme.backdropColors?.length, 3);
  }
});

test('normalizeThemeId and getThemeDefinition safely fallback to default dark theme', () => {
  assert.equal(normalizeThemeId(null), DEFAULT_THEME_ID);
  assert.equal(normalizeThemeId('unknown-theme'), DEFAULT_THEME_ID);
  assert.equal(normalizeThemeId('aurora-borealis'), 'aurora-borealis');
  assert.equal(normalizeThemeId('solar-flare'), 'midnight-starfield');
  assert.equal(getThemeDefinition('midnight-starfield').backdropEffect, 'starfield');
  assert.equal(getThemeDefinition('prism-daylight').colorScheme, 'light');
  assert.equal(getThemeDefinition('invalid').id, DEFAULT_THEME_ID);
});

test('clampThemeSpeed and computeThemeDurationSeconds scale animation speed accurately', () => {
  assert.equal(clampThemeSpeed(Number.NaN), DEFAULT_THEME_SPEED);
  assert.equal(clampThemeSpeed(0.05), MIN_THEME_SPEED);
  assert.equal(clampThemeSpeed(10), MAX_THEME_SPEED);
  assert.equal(clampThemeSpeed(1.5), 1.5);

  assert.equal(computeThemeDurationSeconds(16, 1), 16);
  assert.equal(computeThemeDurationSeconds(16, 2), 8);
  assert.equal(computeThemeDurationSeconds(16, 0.5), 32);
  assert.equal(computeThemeDurationSeconds(12, 3), 4);
  assert.equal(formatThemeSpeed(1), '1.0×');
  assert.equal(formatThemeSpeed(2.25), '2.25×');
});
