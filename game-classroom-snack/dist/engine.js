/*
 * 课堂偷吃大作战 · 规则引擎
 * 老师写字/转身/面向的状态机、偷吃进度、咀嚼延迟、被抓与胜负。
 * 纯逻辑，可在 Node 中测试；随机数通过 rng 注入。
 */
(function (root) {
  'use strict';

  var TARGET = 10;
  var EAT_TIME = 1.1;
  var CHEW_TIME = 0.9;
  var TURN_TIME = 0.55;

  function writingDuration(snacks) {
    return Math.max(1.9, 4.3 - snacks * 0.2);
  }

  function facingDuration(snacks) {
    return Math.min(2.6, 1.4 + snacks * 0.1);
  }

  function create(rng) {
    return {
      phase: 'writing',
      phaseLeft: 2.2 + (rng ? rng() : 0.5) * 0.8,
      snacks: 0,
      lives: 3,
      progress: 0,
      chewing: 0,
      eating: false,
      caughtFlash: 0,
      angry: 0,
      events: [],
      caughtThisFacing: false,
      target: TARGET
    };
  }

  function setEating(state, eating) {
    state.eating = !!eating;
  }

  function applyCaught(state) {
    state.lives -= 1;
    state.progress = 0;
    state.chewing = 0;
    state.eating = false;
    state.caughtFlash = 1.2;
    state.angry = 1.4;
    state.caughtThisFacing = true;
    state.events.push({ type: 'caught' });
    if (state.lives <= 0) {
      state.phase = 'over';
      state.events.push({ type: 'over' });
    }
  }

  function caughtNow(state) {
    return state.phase === 'facing' && (state.eating || state.chewing > 0 || state.progress > 0.2);
  }

  function tick(state, dt, rng) {
    if (state.phase === 'over' || state.phase === 'win') return state;
    var step = Math.max(0, Math.min(dt, 0.1));
    state.events = [];
    state.caughtFlash = Math.max(0, state.caughtFlash - step);
    state.angry = Math.max(0, state.angry - step);

    if (state.eating) {
      state.progress += step / EAT_TIME;
      if (state.progress >= 1) {
        state.progress = 0;
        state.snacks += 1;
        state.chewing = CHEW_TIME;
        state.events.push({ type: 'snack' });
        if (state.snacks >= state.target) {
          state.phase = 'win';
          state.events.push({ type: 'win' });
          return state;
        }
      }
    } else if (state.progress > 0) {
      state.progress = Math.max(0, state.progress - step * 0.35);
    }

    if (state.chewing > 0) {
      state.chewing = Math.max(0, state.chewing - step);
    }

    state.phaseLeft -= step;

    if (state.phase === 'writing' && state.phaseLeft <= 0) {
      state.phase = 'turning';
      state.phaseLeft = TURN_TIME;
      state.events.push({ type: 'turn' });
    } else if (state.phase === 'turning' && state.phaseLeft <= 0) {
      state.phase = 'facing';
      state.phaseLeft = Math.max(0.9, facingDuration(state.snacks) * (0.85 + (rng ? rng() : 0.5) * 0.3));
      state.caughtThisFacing = false;
      state.events.push({ type: 'facing' });
      if (state.eating || state.chewing > 0 || state.progress > 0.2) {
        applyCaught(state);
        if (state.phase === 'over') return state;
      }
    } else if (state.phase === 'facing' && state.phaseLeft <= 0) {
      state.phase = 'writing';
      state.phaseLeft = writingDuration(state.snacks) * (0.8 + (rng ? rng() : 0.5) * 0.4);
      state.events.push({ type: 'write' });
    }

    // 面向期间继续偷吃，也会立刻被抓
    if (state.phase === 'facing' && !state.caughtThisFacing &&
        (state.eating || state.chewing > 0 || state.progress > 0.2)) {
      applyCaught(state);
    }

    return state;
  }

  root.ClassroomSnackEngine = {
    TARGET: TARGET,
    EAT_TIME: EAT_TIME,
    CHEW_TIME: CHEW_TIME,
    TURN_TIME: TURN_TIME,
    writingDuration: writingDuration,
    facingDuration: facingDuration,
    create: create,
    setEating: setEating,
    tick: tick
  };
}(typeof window !== 'undefined' ? window : this));
