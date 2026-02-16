import { strict as assert } from 'assert';
import test from 'node:test';
import { InputManager, DEFAULT_KEY_BINDINGS } from '../src/core/InputManager.js';

class MockTarget {
  constructor() {
    this.listeners = {};
  }
  addEventListener(type, fn) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }
  removeEventListener(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(f => f !== fn);
  }
  dispatchEvent(ev) {
    const list = this.listeners[ev.type] || [];
    for (const fn of list) {
      fn(ev);
    }
  }
}

test('initialize/dispose attach and remove listeners', () => {
  const target = new MockTarget();
  const im = new InputManager({ target });
  im.initialize();
  assert.equal(im.initialized, true);
  im.dispose();
  assert.equal(im.initialized, false);
});

test('movement keys set action states and isMoving', () => {
  const target = new MockTarget();
  const im = new InputManager({ target, shouldHandleInput: () => true });
  im.initialize();

  // simulate keydown for moveUp (default 'w')
  target.dispatchEvent({ type: 'keydown', key: 'w', repeat: false, preventDefault() {} });
  assert.equal(im.isActionPressed('moveUp'), true);
  assert.equal(im.isMoving(), true);

  // keyup
  target.dispatchEvent({ type: 'keyup', key: 'w' });
  assert.equal(im.isActionPressed('moveUp'), false);
  assert.equal(im.isMoving(), false);
});

test('interact and attack flags are set and cleared', () => {
  const target = new MockTarget();
  const im = new InputManager({ target, shouldHandleInput: () => true });
  im.initialize();

  target.dispatchEvent({ type: 'keydown', key: ' ', repeat: false, preventDefault() {} });
  assert.equal(im.getInteractPressed(), true);
  im.clearInteractPressed();
  assert.equal(im.getInteractPressed(), false);

  target.dispatchEvent({ type: 'keydown', key: 'j', repeat: false, preventDefault() {} });
  assert.equal(im.getAttackPressed(), true);
  im.clearAttackPressed();
  assert.equal(im.getAttackPressed(), false);
});

test('setPrimaryBinding enforces conflicts and updates bindings', () => {
  const im = new InputManager({ target: new MockTarget() });
  // attempt to set primary binding to same as another action's primary
  const otherAction = 'moveDown';
  const collisionKey = DEFAULT_KEY_BINDINGS[otherAction][0];
  const res = im.setPrimaryBinding('moveUp', collisionKey);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'primary-conflict');

  // set to a valid new key
  const ok = im.setPrimaryBinding('moveUp', 'z');
  assert.equal(ok.ok, true);
  assert.equal(im.getPrimaryBinding('moveUp'), 'z');
});
