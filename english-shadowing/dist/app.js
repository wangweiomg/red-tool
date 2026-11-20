/* 英语跟读实验室 · 生产版
 * 场景对话 / 背单词两种模式；听示范 → 录音 → 回放 → 对比。
 * 录音只在本机内存处理，不上传、不保存音频。ES2017 / Chrome 61 基线。
 */
(function () {
  'use strict';

  var Data = window.ShadowingData;
  if (!Data || !Data.scenes || !Data.scenes.length) return;

  var MAX_SECONDS = 10;
  var STATS_KEY = 'shadowing.v1.stats';

  var state = {
    mode: 'scene',
    sceneId: Data.scenes[0].id,
    index: 0,
    ctx: null,
    recBuffer: null,
    recDuration: 0,
    recMime: '',
    recording: false,
    stream: null,
    streamSource: null,
    analyser: null,
    recorder: null,
    chunks: [],
    rafId: 0,
    timerId: 0,
    maxTimer: 0,
    recordStart: 0,
    playing: null,
    playToken: 0,
    recSession: 0
  };

  var stats = { total: 0, days: {} };

  var modeTabsEl = document.getElementById('mode-tabs');
  var sceneStripEl = document.getElementById('scene-strip');
  var speakerTagEl = document.getElementById('speaker-tag');
  var wordIndexEl = document.getElementById('word-index');
  var wordIpaEl = document.getElementById('word-ipa');
  var wordEl = document.getElementById('word');
  var wordTipEl = document.getElementById('word-tip');
  var wordZhEl = document.getElementById('word-zh');
  var waveEl = document.getElementById('wave');
  var waveHintEl = document.getElementById('wave-hint');
  var timerEl = document.getElementById('timer');
  var demoBtn = document.getElementById('demo-btn');
  var recordBtn = document.getElementById('record-btn');
  var playBtn = document.getElementById('play-btn');
  var compareBtn = document.getElementById('compare-btn');
  var statusEl = document.getElementById('status');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var dotsEl = document.getElementById('dots');
  var statTodayEl = document.getElementById('stat-today');
  var statTotalEl = document.getElementById('stat-total');
  var storageNoteEl = document.getElementById('storage-note');

  var waveCtx = null;
  try {
    waveCtx = waveEl.getContext && waveEl.getContext('2d');
  } catch (error) {
    waveCtx = null;
  }

  /* ---------- 平台与存储 ---------- */

  function getMiniTool() {
    return window.xhs && window.xhs.miniTool;
  }

  function canStorage() {
    var miniTool = getMiniTool();
    return !!(miniTool &&
      typeof miniTool.setStorage === 'function' &&
      typeof miniTool.getStorage === 'function');
  }

  function apiCall(name, options) {
    var miniTool = getMiniTool();
    if (!miniTool || typeof miniTool[name] !== 'function') {
      return Promise.reject(new Error('unsupported'));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      function ok(result) {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      }
      function bad(error) {
        if (!settled) {
          settled = true;
          reject(error || new Error('failed'));
        }
      }
      var opts = {};
      var key;
      for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
          opts[key] = options[key];
        }
      }
      opts.success = ok;
      opts.fail = bad;
      var ret;
      try {
        ret = miniTool[name](opts);
      } catch (error) {
        bad(error);
        return;
      }
      if (ret && typeof ret.then === 'function') {
        ret.then(ok, bad);
      }
    });
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
  }

  /* ---------- 练习数据 ---------- */

  function currentScene() {
    for (var i = 0; i < Data.scenes.length; i += 1) {
      if (Data.scenes[i].id === state.sceneId) return Data.scenes[i];
    }
    return Data.scenes[0];
  }

  function currentBank() {
    if (state.mode === 'vocab') {
      return { items: Data.words, scene: null };
    }
    var scene = currentScene();
    return { items: scene.lines, scene: scene };
  }

  function currentItem() {
    var bank = currentBank();
    return bank.items[state.index] || bank.items[0];
  }

  /* ---------- 音频上下文 ---------- */

  function ensureCtx() {
    if (state.ctx && state.ctx.state === 'closed') {
      state.ctx = null;
    }
    if (!state.ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try {
        state.ctx = new Ctor();
      } catch (error) {
        return null;
      }
    }
    if (state.ctx.state === 'suspended' && typeof state.ctx.resume === 'function') {
      try {
        var ret = state.ctx.resume();
        if (ret && typeof ret.catch === 'function') {
          ret.catch(function () {});
        }
      } catch (error) {
        /* 等下一次手势 */
      }
    }
    return state.ctx;
  }

  // iOS 的 Web Audio 会切换 AVAudioSession 类别；播放过音频后类别可能停在
  // playback，导致 getUserMedia 报 InvalidStateError: AudioSession category
  // is not compatible with audio capture。
  function prepareAudioSession() {
    try {
      if (navigator.audioSession && 'type' in navigator.audioSession) {
        navigator.audioSession.type = 'play-and-record';
      }
    } catch (error) {
      /* 旧内核没有该接口 */
    }
  }

  function resetAudioForCapture() {
    prepareAudioSession();
    if (state.ctx) {
      try {
        if (state.ctx.state !== 'closed' && typeof state.ctx.close === 'function') {
          state.ctx.close();
        }
      } catch (error) {
        /* 已关闭 */
      }
      state.ctx = null;
    }
    return delay(250);
  }

  /* ---------- 音频解码与播放 ---------- */

  function decodeAudio(ctx, arrayBuffer) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      function ok(buffer) {
        if (!settled) {
          settled = true;
          resolve(buffer);
        }
      }
      function bad(error) {
        if (!settled) {
          settled = true;
          reject(error || new Error('decode-error'));
        }
      }
      try {
        var ret = ctx.decodeAudioData(arrayBuffer, ok, bad);
        if (ret && typeof ret.then === 'function') {
          ret.then(ok, bad);
        }
      } catch (error) {
        bad(error);
      }
    });
  }

  function decodeWithRetry(arrayBuffer) {
    var ctx = ensureCtx();
    if (!ctx) {
      var error = new Error('audio-context-unavailable');
      error.name = 'AudioContextUnavailable';
      return Promise.reject(error);
    }
    return decodeAudio(ctx, arrayBuffer.slice(0)).catch(function (first) {
      state.ctx = null;
      var retryCtx = ensureCtx();
      if (!retryCtx) throw first;
      return decodeAudio(retryCtx, arrayBuffer.slice(0));
    });
  }

  function readBlob(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('read-error'));
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  function stopPlayback() {
    state.playToken += 1;
    if (state.playing) {
      try {
        state.playing.stop();
      } catch (error) {
        /* 已停止 */
      }
      state.playing = null;
    }
  }

  function createPlaybackSource(ctx, buffer) {
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    return source;
  }

  function playBuffer(buffer, onEnd) {
    if (!buffer) return null;
    var ctx = ensureCtx();
    if (!ctx) {
      setStatus('当前环境不支持音频播放。', 'error');
      return null;
    }
    stopPlayback();
    var source;
    try {
      source = createPlaybackSource(ctx, buffer);
    } catch (error) {
      state.ctx = null;
      ctx = ensureCtx();
      if (!ctx) {
        setStatus('音频上下文不可用，无法播放。', 'error');
        return null;
      }
      try {
        source = createPlaybackSource(ctx, buffer);
      } catch (second) {
        setStatus('播放失败（' + (second.name || 'Error') + '），请重试。', 'error');
        return null;
      }
    }
    var token = state.playToken;
    state.playing = source;
    source.onended = function () {
      if (state.playing === source) state.playing = null;
      if (token === state.playToken && onEnd) onEnd();
    };
    try {
      source.start(0);
    } catch (error) {
      state.playing = null;
      setStatus('播放启动失败（' + (error.name || 'Error') + '），请重试。', 'error');
      return null;
    }
    return source;
  }

  /* ---------- 示范朗读（系统语音） ---------- */

  function pickEnglishVoice() {
    var synth = window.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') return null;
    var voices = synth.getVoices() || [];
    for (var i = 0; i < voices.length; i += 1) {
      if (/^en([-_]|$)/i.test(voices[i].lang || '')) return voices[i];
    }
    return null;
  }

  function speakDemo(onEnd) {
    var synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('当前设备不支持示范朗读，可以直接录音后对比。', 'error');
      if (onEnd) onEnd(false);
      return;
    }
    stopPlayback();
    try {
      synth.cancel();
    } catch (error) {
      /* 忽略 */
    }
    var utterance;
    try {
      utterance = new SpeechSynthesisUtterance(currentItem().text);
    } catch (error) {
      setStatus('示范朗读不可用，可以直接录音后对比。', 'error');
      if (onEnd) onEnd(false);
      return;
    }
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    var voice = pickEnglishVoice();
    if (voice) {
      try {
        utterance.voice = voice;
      } catch (error) {
        /* 个别内核的 voice 对象不可直接赋值 */
      }
    }

    var started = false;
    var settled = false;
    function finish(ok, message, isError) {
      if (settled) return;
      settled = true;
      setStatus(message, isError ? 'error' : undefined);
      if (onEnd) onEnd(ok);
    }

    utterance.onstart = function () {
      started = true;
      setStatus('正在朗读示范…');
    };
    utterance.onend = function () {
      finish(true, '示范朗读结束。');
    };
    utterance.onerror = function (event) {
      finish(false, '示范朗读失败（' + (event && event.error || 'error') + '），可直接录音对比。', true);
    };

    setStatus('正在准备示范朗读…');
    try {
      synth.speak(utterance);
    } catch (error) {
      finish(false, '示范朗读不可用，可以直接录音对比。', true);
      return;
    }
    window.setTimeout(function () {
      if (!settled && !started && !synth.speaking && !synth.pending) {
        finish(false, '设备没有可用的英文音色，可直接录音对比。', true);
      }
    }, 1600);
  }

  /* ---------- 录音 ---------- */

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function releaseMic() {
    if (state.stream) {
      var tracks = state.stream.getTracks ? state.stream.getTracks() : [];
      for (var i = 0; i < tracks.length; i += 1) {
        try {
          tracks[i].stop();
        } catch (error) {
          /* 已停止 */
        }
      }
    }
    if (state.streamSource) {
      try {
        state.streamSource.disconnect();
      } catch (error) {
        /* 已断开 */
      }
    }
    if (state.analyser) {
      try {
        state.analyser.disconnect();
      } catch (error) {
        /* 已断开 */
      }
    }
    state.stream = null;
    state.streamSource = null;
    state.analyser = null;
    state.recorder = null;
  }

  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
    for (var i = 0; i < candidates.length; i += 1) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  function requestMic() {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  function requestMicWithRetry() {
    return requestMic().catch(function (error) {
      if (error && error.name === 'InvalidStateError') {
        return resetAudioForCapture().then(requestMic);
      }
      if (error && (error.name === 'NotReadableError' || error.name === 'AbortError')) {
        return delay(300).then(requestMic);
      }
      throw error;
    });
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        var error = new Error('mic-timeout');
        error.name = 'TimeoutError';
        reject(error);
      }, ms);
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function createRecorder(stream) {
    var attempts = [];
    var mime = pickMime();
    if (mime) attempts.push(mime);
    attempts.push('');
    var lastError = null;
    for (var i = 0; i < attempts.length; i += 1) {
      try {
        var recorder = attempts[i] ?
          new MediaRecorder(stream, { mimeType: attempts[i] }) :
          new MediaRecorder(stream);
        state.recMime = recorder.mimeType || attempts[i] || '';
        return recorder;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('recorder-create-failed');
  }

  function micErrorText(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return '麦克风权限被拒绝。请在小红书或系统设置里允许麦克风后重试。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '没有找到可用的麦克风。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '麦克风被其他应用占用，或系统无法读取。';
    }
    if (name === 'TypeError') {
      return '当前容器不允许网页申请麦克风。';
    }
    if (name === 'NotSupportedError') {
      return '当前容器的录音能力不可用，请换设备再试。';
    }
    if (name === 'TimeoutError') {
      return '麦克风申请超时，可能被其他应用占用或容器没有响应。请重试。';
    }
    if (name === 'InvalidStateError') {
      return '音频状态异常，请退出重进小工具后再试。';
    }
    if (error && error.message === 'no-audio-track') {
      return '麦克风没有返回音频轨道，当前容器可能不允许录音。';
    }
    if (error && error.message === 'no-live-track') {
      return '麦克风轨道已失效，请重新点「开始录音」。';
    }
    return '录音失败（' + (name || 'unknown') + '），请重试。';
  }

  function startRecording() {
    if (state.recording) return;
    stopPlayback();
    setStatus('正在请求麦克风…');
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setStatus('当前容器不支持录音，请换设备再试。', 'error');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setStatus('当前容器不支持录音，请换设备再试。', 'error');
      return;
    }

    prepareAudioSession();
    state.recBuffer = null;
    state.recDuration = 0;
    drawIdleWave();
    waveHintEl.textContent = '正在录音…';
    updateButtons();

    // 每次录音一个会话：先让旧回调失效，再释放上一次的麦克风
    state.recSession += 1;
    var session = state.recSession;
    releaseMic();

    withTimeout(requestMicWithRetry(), 8000).then(function (stream) {
      if (session !== state.recSession) {
        var stale = stream.getTracks ? stream.getTracks() : [];
        for (var s = 0; s < stale.length; s += 1) {
          try {
            stale[s].stop();
          } catch (staleError) {
            /* 已停止 */
          }
        }
        return;
      }
      state.stream = stream;
      try {
        var tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
        if (!tracks.length) throw new Error('no-audio-track');
        var live = false;
        for (var t = 0; t < tracks.length; t += 1) {
          if (tracks[t].readyState === 'live') live = true;
        }
        if (!live) throw new Error('no-live-track');

        var ctxNow = ensureCtx();
        if (ctxNow) {
          try {
            var source = ctxNow.createMediaStreamSource(stream);
            var analyser = ctxNow.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            state.streamSource = source;
            state.analyser = analyser;
          } catch (waveError) {
            state.streamSource = null;
            state.analyser = null;
            waveHintEl.textContent = '波形不可用，继续录音…';
          }
        }

        var recorder = createRecorder(stream);
        var chunks = [];
        state.chunks = chunks;
        state.recorder = recorder;

        recorder.ondataavailable = function (event) {
          if (session !== state.recSession) return;
          if (event.data && event.data.size) chunks.push(event.data);
        };
        recorder.onstop = function () {
          if (session !== state.recSession) return;
          finishRecording(chunks, recorder.mimeType || state.recMime || 'audio/webm');
        };
        recorder.onerror = function (event) {
          if (session !== state.recSession) return;
          setStatus('录音出错（' + (event.error && event.error.name || 'unknown') + '），请重试。', 'error');
          state.recording = false;
          stopTimer();
          stopWaveLoop();
          releaseMic();
          updateButtons();
        };

        recorder.start();
        if (recorder.state !== 'recording') {
          throw new Error('recorder-start-failed');
        }
        state.recording = true;
        startTimer();
        startWaveLoop();
        updateButtons();
        setStatus('录音中…读一遍内容，再点一次停止（最长 ' + MAX_SECONDS + ' 秒）。', 'ok');
        state.maxTimer = setTimeout(function () {
          stopRecording('已到 ' + MAX_SECONDS + ' 秒上限，自动停止。');
        }, MAX_SECONDS * 1000);
      } catch (error) {
        releaseMic();
        state.recording = false;
        stopTimer();
        stopWaveLoop();
        updateButtons();
        waveHintEl.textContent = '点「开始录音」后对着麦克风朗读';
        setStatus(micErrorText(error), 'error');
      }
    }).catch(function (error) {
      if (session !== state.recSession) return;
      releaseMic();
      state.recording = false;
      stopTimer();
      stopWaveLoop();
      updateButtons();
      waveHintEl.textContent = '点「开始录音」后对着麦克风朗读';
      setStatus(micErrorText(error), 'error');
    });
  }

  function startTimer() {
    state.recordStart = Date.now();
    timerEl.textContent = '0.0s';
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(function () {
      var seconds = (Date.now() - state.recordStart) / 1000;
      timerEl.textContent = seconds.toFixed(1) + 's';
    }, 100);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = 0;
    }
    if (state.maxTimer) {
      clearTimeout(state.maxTimer);
      state.maxTimer = 0;
    }
  }

  function stopRecording(notice) {
    if (!state.recording) return;
    state.recording = false;
    stopTimer();
    stopWaveLoop();
    updateButtons();
    waveHintEl.textContent = '正在处理录音…';
    if (notice) setStatus(notice, 'ok');

    var recorder = state.recorder;
    if (!recorder) {
      releaseMic();
      setStatus('录音器已释放，请重新点「开始录音」。', 'error');
      return;
    }
    if (recorder.state === 'inactive') {
      releaseMic();
      return;
    }
    try {
      recorder.stop();
    } catch (error) {
      releaseMic();
      updateButtons();
      setStatus('停止录音失败（' + (error && error.name || 'unknown') + '），请重试。', 'error');
    }
  }

  function finishRecording(chunks, mime) {
    releaseMic();
    updateButtons();
    if (!chunks.length) {
      waveHintEl.textContent = '点「开始录音」后对着麦克风朗读';
      setStatus('没有录到声音，请再试一次。', 'error');
      drawIdleWave();
      return;
    }
    var blob = new Blob(chunks, { type: mime });
    readBlob(blob).then(function (arrayBuffer) {
      return decodeWithRetry(arrayBuffer);
    }).then(function (buffer) {
      state.recBuffer = buffer;
      state.recDuration = buffer.duration;
      timerEl.textContent = buffer.duration.toFixed(1) + 's';
      updateButtons();
      drawBufferWave(buffer);
      waveHintEl.textContent = '';
      recordPractice();
      setStatus('录到 ' + buffer.duration.toFixed(1) + ' 秒（' + Math.round(blob.size / 1024) +
        'KB），点「听我的」回放。', 'ok');
    }).catch(function (error) {
      state.recBuffer = null;
      updateButtons();
      waveHintEl.textContent = '点「开始录音」后对着麦克风朗读';
      setStatus('录音处理失败（' + (error && (error.name || error.message) || 'decode-error') +
        '），请再录一次。', 'error');
    });
  }

  /* ---------- 波形 ---------- */

  function drawIdleWave() {
    if (!waveCtx) return;
    waveCtx.clearRect(0, 0, waveEl.width, waveEl.height);
    waveCtx.strokeStyle = 'rgba(18, 169, 122, 0.25)';
    waveCtx.lineWidth = 2;
    waveCtx.beginPath();
    waveCtx.moveTo(0, waveEl.height / 2);
    waveCtx.lineTo(waveEl.width, waveEl.height / 2);
    waveCtx.stroke();
  }

  function drawLiveWave() {
    if (!waveCtx || !state.analyser) return;
    var size = state.analyser.fftSize;
    var data = new Uint8Array(size);
    state.analyser.getByteTimeDomainData(data);
    waveCtx.clearRect(0, 0, waveEl.width, waveEl.height);
    waveCtx.lineWidth = 2;
    waveCtx.strokeStyle = '#12a97a';
    waveCtx.beginPath();
    var step = waveEl.width / size;
    for (var i = 0; i < size; i += 1) {
      var value = (data[i] - 128) / 128;
      var y = waveEl.height / 2 + value * (waveEl.height / 2 - 6);
      var x = i * step;
      if (i === 0) waveCtx.moveTo(x, y);
      else waveCtx.lineTo(x, y);
    }
    waveCtx.stroke();
  }

  function drawBufferWave(buffer) {
    if (!waveCtx) return;
    var width = waveEl.width;
    var height = waveEl.height;
    var data = buffer.getChannelData(0);
    var block = Math.max(1, Math.floor(data.length / width));
    waveCtx.clearRect(0, 0, width, height);
    waveCtx.strokeStyle = '#e8890c';
    waveCtx.lineWidth = 2;
    waveCtx.beginPath();
    for (var x = 0; x < width; x += 1) {
      var start = x * block;
      var end = Math.min(data.length, start + block);
      var peak = 0;
      for (var i = start; i < end; i += 1) {
        var value = Math.abs(data[i]);
        if (value > peak) peak = value;
      }
      var amplitude = Math.min(1, peak * 1.6) * (height / 2 - 6);
      waveCtx.moveTo(x, height / 2 - amplitude);
      waveCtx.lineTo(x, height / 2 + amplitude);
    }
    waveCtx.stroke();
  }

  function startWaveLoop() {
    function frame() {
      if (!state.recording) return;
      drawLiveWave();
      state.rafId = window.requestAnimationFrame(frame);
    }
    state.rafId = window.requestAnimationFrame(frame);
  }

  function stopWaveLoop() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  /* ---------- 练习统计 ---------- */

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function todayKey() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function renderStats() {
    statTodayEl.textContent = String(stats.days[todayKey()] || 0);
    statTotalEl.textContent = String(stats.total);
  }

  function pruneDays() {
    var keys = Object.keys(stats.days).sort();
    while (keys.length > 90) {
      delete stats.days[keys.shift()];
    }
  }

  function recordPractice() {
    var key = todayKey();
    stats.days[key] = (stats.days[key] || 0) + 1;
    stats.total += 1;
    pruneDays();
    renderStats();
    saveStats();
  }

  function sanitizeStats(raw) {
    if (!raw || typeof raw !== 'object') return;
    if (typeof raw.total === 'number' && isFinite(raw.total) && raw.total >= 0) {
      stats.total = Math.floor(raw.total);
    }
    if (raw.days && typeof raw.days === 'object') {
      var days = {};
      var keys = Object.keys(raw.days);
      for (var i = 0; i < keys.length; i += 1) {
        var value = raw.days[keys[i]];
        if (/^\d{4}-\d{2}-\d{2}$/.test(keys[i]) &&
            typeof value === 'number' && isFinite(value) && value > 0) {
          days[keys[i]] = Math.floor(value);
        }
      }
      stats.days = days;
    }
  }

  function loadStats() {
    if (!canStorage()) {
      storageNoteEl.textContent = '当前客户端不支持本地记录，本次练习不会保存。';
      return;
    }
    apiCall('getStorage', { key: STATS_KEY }).then(function (result) {
      var raw = result && result.data;
      if (typeof raw === 'string' && raw) {
        try {
          var saved = JSON.parse(raw);
          if (saved && saved.v === 1) sanitizeStats(saved);
        } catch (error) {
          /* 忽略损坏数据 */
        }
      }
      renderStats();
    }).catch(function () {
      storageNoteEl.textContent = '读取练习记录失败，本次练习可能不会保存。';
    });
  }

  function saveStats() {
    if (!canStorage()) return;
    apiCall('setStorage', {
      key: STATS_KEY,
      data: JSON.stringify({ v: 1, total: stats.total, days: stats.days })
    }).catch(function () {
      storageNoteEl.textContent = '练习记录保存失败，本次仍可正常练习。';
    });
  }

  /* ---------- 渲染 ---------- */

  function renderModeTabs() {
    var tabs = modeTabsEl.querySelectorAll('[data-mode]');
    for (var i = 0; i < tabs.length; i += 1) {
      var active = tabs[i].getAttribute('data-mode') === state.mode;
      tabs[i].className = active ? 'mode-tab is-active' : 'mode-tab';
      tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function renderSceneStrip() {
    sceneStripEl.hidden = state.mode !== 'scene';
    sceneStripEl.textContent = '';
    for (var i = 0; i < Data.scenes.length; i += 1) {
      var scene = Data.scenes[i];
      var active = scene.id === state.sceneId;
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = active ? 'scene-chip is-active' : 'scene-chip';
      chip.setAttribute('data-scene', scene.id);
      chip.setAttribute('role', 'tab');
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
      chip.textContent = scene.label;
      sceneStripEl.appendChild(chip);
    }
  }

  function updateButtons() {
    var recording = state.recording;
    recordBtn.textContent = recording ? '停止录音' : '开始录音';
    recordBtn.className = recording ? 'btn btn-record-on' : 'btn btn-primary';
    demoBtn.disabled = recording;
    playBtn.disabled = recording || !state.recBuffer;
    compareBtn.disabled = recording || !state.recBuffer;
    prevBtn.disabled = recording || state.index <= 0;
    nextBtn.disabled = recording || state.index >= currentBank().items.length - 1;
    var tabs = modeTabsEl.querySelectorAll('[data-mode]');
    for (var i = 0; i < tabs.length; i += 1) {
      tabs[i].disabled = recording;
    }
    var chips = sceneStripEl.querySelectorAll('[data-scene]');
    for (var j = 0; j < chips.length; j += 1) {
      chips[j].disabled = recording;
    }
  }

  function renderItem() {
    var bank = currentBank();
    var item = bank.items[state.index] || bank.items[0];
    wordIndexEl.textContent = (state.index + 1) + ' / ' + bank.items.length;
    wordIpaEl.textContent = item.ipa;
    wordEl.textContent = item.text;
    wordEl.className = state.mode === 'vocab' ? 'word' : 'word is-sentence';
    if (bank.scene && item.role) {
      speakerTagEl.textContent = bank.scene.roles[item.role] || '';
      speakerTagEl.className = 'speaker-tag' + (item.role === 'b' ? ' role-b' : '');
      speakerTagEl.hidden = false;
    } else {
      speakerTagEl.textContent = '';
      speakerTagEl.hidden = true;
    }
    wordTipEl.textContent = item.tip;
    wordZhEl.textContent = item.zh || '';
    wordZhEl.hidden = !item.zh;
    renderDots();
    updateButtons();
  }

  function renderDots() {
    dotsEl.textContent = '';
    var total = currentBank().items.length;
    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement('span');
      dot.className = i === state.index ? 'dot is-active' : 'dot';
      dotsEl.appendChild(dot);
    }
  }

  function resetRecordingState() {
    stopPlayback();
    state.recBuffer = null;
    state.recDuration = 0;
    drawIdleWave();
    waveHintEl.textContent = '点「开始录音」后对着麦克风朗读';
    timerEl.textContent = '0.0s';
  }

  function setMode(mode) {
    if ((mode !== 'scene' && mode !== 'vocab') || state.mode === mode || state.recording) return;
    state.mode = mode;
    state.index = 0;
    resetRecordingState();
    setStatus('准备就绪。录音只在本机处理，不会上传。');
    renderModeTabs();
    renderSceneStrip();
    renderItem();
  }

  function setScene(sceneId) {
    if (state.recording || state.sceneId === sceneId) return;
    for (var i = 0; i < Data.scenes.length; i += 1) {
      if (Data.scenes[i].id === sceneId) {
        state.sceneId = sceneId;
        state.index = 0;
        resetRecordingState();
        setStatus('准备就绪。录音只在本机处理，不会上传。');
        renderSceneStrip();
        renderItem();
        return;
      }
    }
  }

  function switchItem(delta) {
    if (state.recording) return;
    var next = state.index + delta;
    if (next < 0 || next >= currentBank().items.length) return;
    stopPlayback();
    state.index = next;
    resetRecordingState();
    setStatus('准备就绪。录音只在本机处理，不会上传。');
    renderItem();
  }

  /* ---------- 回放与对比 ---------- */

  function playRecording(fromCompare) {
    if (!state.recBuffer) return;
    if (!fromCompare) setStatus('正在回放你的录音…');
    playBuffer(state.recBuffer, function () {
      setStatus(fromCompare ?
        '对比播放结束。听听重音和结尾是否和示范接近。' :
        '回放结束。可以再录一次，或对比示范音。');
    });
  }

  function comparePlay() {
    if (!state.recBuffer) return;
    setStatus('对比播放：先示范，再你的录音…');
    speakDemo(function (ok) {
      setTimeout(function () {
        playRecording(true);
      }, ok ? 400 : 0);
    });
  }

  /* ---------- 事件 ---------- */

  function bind() {
    modeTabsEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== modeTabsEl && !target.getAttribute('data-mode')) {
        target = target.parentNode;
      }
      if (!target || target === modeTabsEl) return;
      setMode(target.getAttribute('data-mode'));
    });

    sceneStripEl.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== sceneStripEl && !target.getAttribute('data-scene')) {
        target = target.parentNode;
      }
      if (!target || target === sceneStripEl) return;
      setScene(target.getAttribute('data-scene'));
    });

    demoBtn.addEventListener('click', function () {
      speakDemo();
    });

    recordBtn.addEventListener('click', function () {
      if (state.recording) stopRecording();
      else startRecording();
    });

    playBtn.addEventListener('click', function () {
      playRecording(false);
    });
    compareBtn.addEventListener('click', comparePlay);

    prevBtn.addEventListener('click', function () {
      switchItem(-1);
    });
    nextBtn.addEventListener('click', function () {
      switchItem(1);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (state.recording) stopRecording('页面切到后台，已停止录音。');
        try {
          if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (error) {
          /* 忽略 */
        }
      }
    });
  }

  function boot() {
    renderModeTabs();
    renderSceneStrip();
    renderItem();
    renderStats();
    drawIdleWave();
    bind();
    updateButtons();
    loadStats();
    try {
      if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
        window.speechSynthesis.getVoices();
      }
    } catch (error) {
      /* 忽略 */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
