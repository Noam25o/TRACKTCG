const { test } = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { expo } = require('../app.json');
const eas = require('../eas.json');

test('Expo Go remains the default test workflow; native device commands are separate', () => {
  assert.equal(pkg.scripts.start, 'expo start --go');
  assert.equal(pkg.scripts['start:dev'], 'expo start --dev-client');
  assert.equal(pkg.scripts['ios:device'], 'expo run:ios --device');
  assert.ok(pkg.dependencies['expo-dev-client']);
  assert.ok(expo.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-dev-client'));
});

test('iPhone development profile is not a simulator or App Store release', () => {
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.distribution, 'internal');
  assert.equal(eas.build.development.ios.simulator, false);
  assert.equal(eas.build['development-simulator'].ios.simulator, true);
  assert.equal(eas.submit, undefined);
  assert.equal(expo.extra?.eas?.projectId, undefined); // No remote project created yet.
});
