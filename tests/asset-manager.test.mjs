import { strict as assert } from 'assert';
import test from 'node:test';
import { AssetManager } from '../src/core/AssetManager.js';

function installImageMock() {
  const original = global.Image;
  global.Image = class {
    constructor() {
      this._src = '';
    }
    set src(v) {
      this._src = v;
    }
    get src() {
      return this._src;
    }
  };
  return () => {
    global.Image = original;
  };
}

test('loadSprite stores and returns an Image-like object', () => {
  const restore = installImageMock();
  try {
    const am = new AssetManager();
    const img = am.loadSprite('test', '/path/to.png');
    assert.ok(img);
    assert.equal(am.getSprite('test'), img);
    assert.equal(am.hasSprite('test'), true);
  } finally {
    restore();
  }
});

test('loadManifest loads multiple entries', () => {
  const restore = installImageMock();
  try {
    const manifest = { a: 'a.png', b: 'b.png' };
    const am = new AssetManager();
    am.loadManifest(manifest);
    assert.equal(am.hasSprite('a'), true);
    assert.equal(am.hasSprite('b'), true);
  } finally {
    restore();
  }
});

test('getSprite returns null for missing entries', () => {
  const am = new AssetManager();
  assert.equal(am.getSprite('missing'), null);
  assert.equal(am.hasSprite('missing'), false);
});
