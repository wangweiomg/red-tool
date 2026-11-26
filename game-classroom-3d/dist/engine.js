/*
 * 课堂偷吃大作战 3D · 规则引擎
 * 老师写字 / 停笔 / 转身 / 面向的状态机，偷吃进度、咀嚼、假动作、被抓与胜负。
 * 纯逻辑，可在 Node 中测试；随机数通过 rng 注入；关卡参数由 levels 传入。
 */
(function (root) {
  'use strict';

  var EAT_TIME = 1.1;
  var CHEW_TIME = 0.9;
  var TURN_TIME = 0.55;
  var FAKE_TIME = 0.9;

  var LEVELS = [
    {
      id: 'chinese',
      name: '语文课',
      board: '语文课',
      tag: '长窗口 · 慢节奏',
      hint: '写字时间长，可以连着吃好几口。',
      target: 6,
      lives: 3,
      writeFrom: 4.6,
      writeTo: 3.6,
      faceFrom: 0.9,
      faceTo: 1.3,
      tell: 0.9,
      fakeChance: 0,
      pauseFakeChance: 0,
      eatTime: 1.1
    },
    {
      id: 'math',
      name: '数学课',
      board: '数学课',
      tag: '短窗口 · 快节奏',
      hint: '写字时间很短，一有机会就赶紧吃。',
      target: 10,
      lives: 3,
      writeFrom: 2.3,
      writeTo: 1.7,
      faceFrom: 0.7,
      faceTo: 1.0,
      tell: 0.3,
      fakeChance: 0,
      pauseFakeChance: 0,
      eatTime: 0.85
    },
    {
      id: 'english',
      name: '英语课',
      board: '英语课',
      tag: '长时间盯人 · 假动作',
      hint: '老师盯得久，还会假装转身。',
      target: 8,
      lives: 3,
      writeFrom: 5.0,
      writeTo: 3.8,
      faceFrom: 2.4,
      faceTo: 3.2,
      tell: 0.7,
      fakeChance: 0.35,
      pauseFakeChance: 0,
      eatTime: 1.25
    },
    {
      id: 'physics',
      name: '物理课',
      board: '物理课',
      tag: '假停笔',
      hint: '老师会停笔又写起来，别急着动。',
      target: 8,
      lives: 3,
      writeFrom: 3.0,
      writeTo: 2.2,
      faceFrom: 1.0,
      faceTo: 1.6,
      tell: 0.45,
      fakeChance: 0,
      pauseFakeChance: 0.3,
      eatTime: 1.0
    },
    {
      id: 'chemistry',
      name: '化学课',
      board: '化学课',
      tag: '假停笔 + 假动作',
      hint: '停笔和转身都可能是假的。',
      target: 10,
      lives: 2,
      writeFrom: 2.8,
      writeTo: 2.0,
      faceFrom: 1.2,
      faceTo: 2.0,
      tell: 0.4,
      fakeChance: 0.3,
      pauseFakeChance: 0.3,
      eatTime: 1.05
    },
    {
      id: 'final',
      name: '期末考试',
      board: '期末考试',
      tag: '一命 · 全机制',
      hint: '只有一条命，停笔和转身都可能骗你。',
      target: 12,
      lives: 1,
      writeFrom: 2.4,
      writeTo: 1.7,
      faceFrom: 1.6,
      faceTo: 2.6,
      tell: 0.3,
      fakeChance: 0.4,
      pauseFakeChance: 0.35,
      eatTime: 1.1
    }
  ];

  var DEFAULT_LEVEL = {
    id: 'default',
    name: '课堂',
    board: '语文课',
    target: 10,
    lives: 3,
    writeFrom: 4.3,
    writeTo: 1.9,
    faceFrom: 1.4,
    faceTo: 2.6,
    tell: 0,
    fakeChance: 0,
    pauseFakeChance: 0,
    eatTime: EAT_TIME
  };

  function levelOf(level) {
    return (level && level.target) ? level : DEFAULT_LEVEL;
  }

  function ratio(level, snacks) {
    return Math.min(1, snacks / (level.target || 1));
  }

  function writingDuration(level, snacks) {
    var lv = levelOf(level);
    return lv.writeFrom - (lv.writeFrom - lv.writeTo) * ratio(lv, snacks);
  }

  function facingDuration(level, snacks) {
    var lv = levelOf(level);
    return lv.faceFrom + (lv.faceTo - lv.faceFrom) * ratio(lv, snacks);
  }

  function create(rng, level) {
    var lv = levelOf(level);
    var random = rng || Math.random;
    return {
      level: lv,
      levelId: lv.id,
      levelName: lv.name,
      phase: 'writing',
      phaseLeft: writingDuration(lv, 0) * (0.7 + random() * 0.2),
      snacks: 0,
      lives: lv.lives,
      startLives: lv.lives,
      progress: 0,
      chewing: 0,
      eating: false,
      caughtFlash: 0,
      angry: 0,
      events: [],
      caughtThisFacing: false,
      pauseFake: false,
      fakeSpan: 0,
      target: lv.target
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

  function starsFor(state) {
    if (!state || state.phase !== 'win') return 0;
    var start = state.startLives || 3;
    return Math.max(1, Math.min(3, Math.ceil(3 * state.lives / start)));
  }

  function tick(state, dt, rng) {
    if (state.phase === 'over' || state.phase === 'win') return state;
    var step = Math.max(0, Math.min(dt, 0.1));
    var random = rng || Math.random;
    var level = levelOf(state.level);
    state.events = [];
    state.caughtFlash = Math.max(0, state.caughtFlash - step);
    state.angry = Math.max(0, state.angry - step);

    var eatTime = level.eatTime || EAT_TIME;

    if (state.eating) {
      state.progress += step / eatTime;
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
      if (level.tell > 0) {
        state.phase = 'pausing';
        state.phaseLeft = level.tell;
        state.pauseFake = (level.pauseFakeChance || 0) > 0 &&
          random() < level.pauseFakeChance;
        state.events.push({ type: 'pause' });
      } else {
        state.phase = 'turning';
        state.phaseLeft = TURN_TIME;
        state.events.push({ type: 'turn' });
      }
    } else if (state.phase === 'pausing' && state.phaseLeft <= 0) {
      if (state.pauseFake) {
        state.pauseFake = false;
        state.phase = 'writing';
        state.phaseLeft = writingDuration(level, state.snacks) * (0.5 + random() * 0.3);
        state.events.push({ type: 'resume' });
      } else {
        var fake = (level.fakeChance || 0) > 0 && random() < level.fakeChance;
        state.phase = fake ? 'faking' : 'turning';
        state.phaseLeft = fake ? FAKE_TIME : TURN_TIME;
        state.fakeSpan = fake ? 0.5 + random() * 0.3 : 0;
        state.events.push({ type: fake ? 'fake' : 'turn' });
      }
    } else if (state.phase === 'faking' && state.phaseLeft <= 0) {
      state.phase = 'writing';
      state.phaseLeft = writingDuration(level, state.snacks) * (0.8 + random() * 0.4);
      state.events.push({ type: 'write' });
    } else if (state.phase === 'turning' && state.phaseLeft <= 0) {
      state.phase = 'facing';
      state.phaseLeft = Math.max(0.9, facingDuration(level, state.snacks) * (0.85 + random() * 0.3));
      state.caughtThisFacing = false;
      state.events.push({ type: 'facing' });
      if (state.eating || state.chewing > 0 || state.progress > 0.2) {
        applyCaught(state);
        if (state.phase === 'over') return state;
      }
    } else if (state.phase === 'facing' && state.phaseLeft <= 0) {
      state.phase = 'writing';
      state.phaseLeft = writingDuration(level, state.snacks) * (0.8 + random() * 0.4);
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
    EAT_TIME: EAT_TIME,
    CHEW_TIME: CHEW_TIME,
    TURN_TIME: TURN_TIME,
    FAKE_TIME: FAKE_TIME,
    LEVELS: LEVELS,
    DEFAULT_LEVEL: DEFAULT_LEVEL,
    writingDuration: writingDuration,
    facingDuration: facingDuration,
    create: create,
    setEating: setEating,
    tick: tick,
    starsFor: starsFor
  };
}(typeof window !== 'undefined' ? window : this));
