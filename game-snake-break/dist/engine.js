/*
 * 课间十分钟 · 贪吃蛇 · 规则引擎
 * 网格移动、转向队列、零食效果、撞墙/撞自己/下课铃判定，纯逻辑可测试。
 */
(function (root) {
  'use strict';

  var COLS = 20;
  var ROWS = 26;
  var START_LEN = 4;
  var DURATION = 60;

  var FOODS = {
    spicy: { label: '辣条', score: 1, time: 0, weight: 0.55 },
    cookie: { label: '饼干', score: 2, time: 0, weight: 0.3 },
    candy: { label: '水果糖', score: 1, time: 2, weight: 0.15 }
  };

  function create(rng) {
    var random = rng || Math.random;
    var cx = Math.floor(COLS / 2);
    var cy = Math.floor(ROWS / 2);
    var snake = [];
    for (var i = 0; i < START_LEN; i += 1) {
      snake.push({ x: cx - i, y: cy });
    }
    var state = {
      cols: COLS,
      rows: ROWS,
      snake: snake,
      dir: { x: 1, y: 0 },
      queue: [],
      food: null,
      score: 0,
      eaten: 0,
      timeLeft: DURATION,
      duration: DURATION,
      stepInterval: 165,
      stepAcc: 0,
      startDelay: 1.2,
      phase: 'playing',
      events: []
    };
    placeFood(state, random);
    return state;
  }

  function occupied(state, x, y) {
    for (var i = 0; i < state.snake.length; i += 1) {
      if (state.snake[i].x === x && state.snake[i].y === y) return true;
    }
    return false;
  }

  function placeFood(state, rng) {
    var random = rng || Math.random;
    var x = 0;
    var y = 0;
    var tries = 0;
    var free = false;
    while (tries < 300) {
      x = Math.floor(random() * state.cols);
      y = Math.floor(random() * state.rows);
      if (!occupied(state, x, y)) {
        free = true;
        break;
      }
      tries += 1;
    }
    if (!free) {
      for (var yy = 0; yy < state.rows && !free; yy += 1) {
        for (var xx = 0; xx < state.cols; xx += 1) {
          if (!occupied(state, xx, yy)) {
            x = xx;
            y = yy;
            free = true;
            break;
          }
        }
      }
    }
    if (!free) {
      state.food = null;
      return null;
    }

    var roll = random();
    var type = 'spicy';
    if (roll < FOODS.spicy.weight) {
      type = 'spicy';
    } else if (roll < FOODS.spicy.weight + FOODS.cookie.weight) {
      type = 'cookie';
    } else {
      type = 'candy';
    }
    state.food = { x: x, y: y, type: type };
    return state.food;
  }

  function turn(state, dx, dy) {
    if (state.phase !== 'playing') return false;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    var last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (last.x === -dx && last.y === -dy) return false;
    if (last.x === dx && last.y === dy) return false;
    if (state.queue.length >= 2) return false;
    state.queue.push({ x: dx, y: dy });
    return true;
  }

  function step(state, rng) {
    if (state.phase !== 'playing') return state;
    var random = rng || Math.random;
    if (state.queue.length) {
      state.dir = state.queue.shift();
    }
    var head = state.snake[0];
    var nx = head.x + state.dir.x;
    var ny = head.y + state.dir.y;

    if (nx < 0 || nx >= state.cols || ny < 0 || ny >= state.rows) {
      state.phase = 'over';
      state.events.push({ type: 'caught', reason: 'wall' });
      return state;
    }

    var ate = !!(state.food && nx === state.food.x && ny === state.food.y);
    var limit = ate ? state.snake.length : state.snake.length - 1;
    for (var i = 0; i < limit; i += 1) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        state.phase = 'over';
        state.events.push({ type: 'caught', reason: 'self' });
        return state;
      }
    }

    state.snake.unshift({ x: nx, y: ny });
    if (ate) {
      var food = FOODS[state.food.type] || FOODS.spicy;
      state.score += food.score;
      state.eaten += 1;
      state.timeLeft = Math.min(state.duration, state.timeLeft + food.time);
      state.events.push({ type: 'eat', food: state.food.type, score: food.score });
      placeFood(state, random);
      state.stepInterval = Math.max(95, 165 - state.eaten * 2);
    } else {
      state.snake.pop();
    }
    return state;
  }

  function update(state, dt, rng) {
    if (state.phase !== 'playing') return state;
    state.events = [];
    if (state.startDelay > 0) {
      state.startDelay = Math.max(0, state.startDelay - dt);
      if (state.startDelay === 0) {
        state.events.push({ type: 'go' });
      }
      return state;
    }
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      state.phase = 'over';
      state.events.push({ type: 'timeup' });
      return state;
    }
    state.stepAcc += dt * 1000;
    var guard = 0;
    while (state.stepAcc >= state.stepInterval && state.phase === 'playing' && guard < 5) {
      state.stepAcc -= state.stepInterval;
      step(state, rng);
      guard += 1;
    }
    return state;
  }

  root.BreakSnakeEngine = {
    COLS: COLS,
    ROWS: ROWS,
    START_LEN: START_LEN,
    DURATION: DURATION,
    FOODS: FOODS,
    create: create,
    update: update,
    step: step,
    turn: turn,
    placeFood: placeFood
  };
}(typeof window !== 'undefined' ? window : this));
