/* 北京徒步指南 · 界面逻辑 */
(function () {
  'use strict';

  var Data = window.HIKING_DATA;
  var Engine = window.HikingEngine;
  if (!Data || !Engine) return;

  var city = Data.cities[0];

  var state = {
    group: 'all',
    currentRouteId: null,
    listScroll: 0,
    shareBusy: false
  };

  var els = {
    listView: document.getElementById('list-view'),
    detailView: document.getElementById('route-detail'),
    groupChips: document.getElementById('group-chips'),
    routeCount: document.getElementById('route-count'),
    routeList: document.getElementById('route-list'),
    empty: document.getElementById('route-empty'),
    disclaimer: document.getElementById('disclaimer'),
    detailBack: document.getElementById('detail-back'),
    detailLevel: document.getElementById('detail-level'),
    detailStats: document.getElementById('detail-stats'),
    detailName: document.getElementById('detail-name'),
    detailSummary: document.getElementById('detail-summary'),
    detailTags: document.getElementById('detail-tags'),
    detailStart: document.getElementById('detail-start'),
    detailHighlights: document.getElementById('detail-highlights'),
    detailTips: document.getElementById('detail-tips'),
    saveCard: document.getElementById('save-card'),
    shareCard: document.getElementById('share-card'),
    postNote: document.getElementById('post-note'),
    shareStatus: document.getElementById('share-status')
  };

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stars(level) {
    var out = '';
    for (var i = 0; i < 5; i += 1) out += i < level ? '★' : '☆';
    return out;
  }

  /* ---------- 平台分享 ---------- */

  function miniTool() {
    return window.xhs && window.xhs.miniTool;
  }

  function hasApi(name) {
    var mt = miniTool();
    return !!(mt && typeof mt[name] === 'function');
  }

  function apiCall(name, options) {
    var mt = miniTool();
    if (!mt || typeof mt[name] !== 'function') {
      return Promise.reject(new Error('unsupported'));
    }
    return new Promise(function (resolve, reject) {
      var settled = false;
      var opts = {};
      var key;
      for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) opts[key] = options[key];
      }
      opts.success = function (res) {
        if (!settled) { settled = true; resolve(res); }
      };
      opts.fail = function (error) {
        if (!settled) { settled = true; reject(error || new Error('failed')); }
      };
      try {
        mt[name](opts);
      } catch (error) {
        if (!settled) { settled = true; reject(error); }
      }
    });
  }

  function currentRoute() {
    return state.currentRouteId
      ? Engine.findRoute(Data.cities, state.currentRouteId)
      : null;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function wrapText(g, text, x, y, maxWidth, lineHeight) {
    var line = '';
    for (var i = 0; i < text.length; i += 1) {
      var test = line + text.charAt(i);
      if (g.measureText(test).width > maxWidth && line) {
        g.fillText(line, x, y);
        y += lineHeight;
        line = text.charAt(i);
      } else {
        line = test;
      }
    }
    if (line) {
      g.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  function generateCard(route) {
    var canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    var g = canvas.getContext('2d');
    var font = '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';

    var bg = g.createLinearGradient(0, 0, 0, 1200);
    bg.addColorStop(0, '#faf6ec');
    bg.addColorStop(1, '#e9dfc9');
    g.fillStyle = bg;
    g.fillRect(0, 0, 900, 1200);

    g.fillStyle = '#f2dfc4';
    g.beginPath();
    g.arc(760, 150, 120, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = 'rgba(63, 107, 79, 0.10)';
    g.beginPath();
    g.moveTo(0, 1010);
    g.lineTo(150, 790);
    g.lineTo(300, 930);
    g.lineTo(450, 720);
    g.lineTo(620, 980);
    g.lineTo(900, 840);
    g.lineTo(900, 1200);
    g.lineTo(0, 1200);
    g.closePath();
    g.fill();

    g.fillStyle = '#3f6b4f';
    g.font = '700 26px ' + font;
    g.fillText('北京徒步指南', 64, 94);
    g.fillStyle = '#c47b4a';
    g.font = '600 16px ' + font;
    g.fillText('BEIJING HIKING GUIDE', 64, 126);

    g.strokeStyle = 'rgba(55, 65, 50, 0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(64, 154);
    g.lineTo(836, 154);
    g.stroke();

    g.fillStyle = '#26302a';
    g.font = '800 58px ' + font;
    var y = wrapText(g, route.name, 64, 250, 772, 74);

    var colors = { 1: '#4f7a5a', 2: '#7a8a4a', 3: '#b58a3f', 4: '#c06a3a', 5: '#a8443a' };
    var badge = stars(route.level) + ' ' + Engine.levelName(route.level);
    g.font = '700 22px ' + font;
    var bw = g.measureText(badge).width + 36;
    g.fillStyle = colors[route.level] || '#3f6b4f';
    roundRect(g, 64, y + 12, bw, 44, 8);
    g.fill();
    g.fillStyle = '#fffdf8';
    g.fillText(badge, 82, y + 42);

    g.fillStyle = '#566256';
    g.font = '500 24px ' + font;
    g.fillText(route.distance + ' · ' + route.ascent + ' · ' + route.time, 64, y + 94);

    var boxY = y + 126;
    g.fillStyle = '#fffdf8';
    roundRect(g, 64, boxY, 772, 150, 12);
    g.fill();
    g.strokeStyle = 'rgba(55, 65, 50, 0.12)';
    roundRect(g, 64, boxY, 772, 150, 12);
    g.stroke();

    g.fillStyle = '#8a8b7c';
    g.font = '600 18px ' + font;
    g.fillText('核心亮点', 88, boxY + 38);

    g.fillStyle = '#26302a';
    g.font = '700 32px ' + font;
    wrapText(g, route.highlight, 88, boxY + 88, 700, 42);

    g.fillStyle = '#3f6b4f';
    g.font = '700 20px ' + font;
    g.fillText('路线亮点', 64, boxY + 202);

    var listY = boxY + 244;
    g.font = '500 22px ' + font;
    for (var i = 0; i < route.highlights.length; i += 1) {
      g.fillStyle = '#c47b4a';
      g.beginPath();
      g.arc(72, listY - 8, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#566256';
      var nextY = wrapText(g, route.highlights[i], 96, listY, 680, 32);
      listY = nextY + 14;
    }

    g.strokeStyle = 'rgba(55, 65, 50, 0.18)';
    g.beginPath();
    g.moveTo(64, 1060);
    g.lineTo(836, 1060);
    g.stroke();
    g.fillStyle = '#8a8b7c';
    g.font = '500 18px ' + font;
    g.fillText('路线信息为常见走法，出发前确认开放与天气', 64, 1104);
    g.fillStyle = '#3f6b4f';
    g.font = '700 22px ' + font;
    g.fillText('北京徒步指南', 64, 1150);

    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      return '';
    }
  }

  function setShareStatus(text, kind) {
    els.shareStatus.textContent = text;
    els.shareStatus.className = 'share-status' + (kind ? ' is-' + kind : '');
  }

  function setShareBusy(busy) {
    state.shareBusy = busy;
    els.saveCard.disabled = busy;
    els.shareCard.disabled = busy;
    els.postNote.disabled = busy;
  }

  function updateShareButtons() {
    var canSave = hasApi('saveImageToPhotosAlbum');
    var canShare = hasApi('share');
    var canPost = hasApi('postNote');
    els.saveCard.hidden = !canSave;
    els.shareCard.hidden = !canShare;
    els.postNote.hidden = !canPost;
    if (!canSave && !canShare && !canPost) {
      setShareStatus('当前环境不支持直接分享，可截图保存。', '');
    }
  }

  function shareError(error) {
    var code = error && error.errCode;
    if (code === 15503) return '今天的分享次数已用完，可保存图片后手动分享。';
    if (code === 15502) return '分享面板未打开，请在小工具全屏中重试，或保存图片。';
    return '分享失败，可先保存图片后手动分享。';
  }

  function saveShareCard() {
    if (state.shareBusy) return;
    var route = currentRoute();
    if (!route) return;
    var dataUrl = generateCard(route);
    if (!dataUrl) {
      setShareStatus('当前环境无法生成分享图。', 'error');
      return;
    }
    if (!hasApi('saveImageToPhotosAlbum')) {
      setShareStatus('当前版本不支持保存到相册，可截图保存。', 'error');
      return;
    }
    setShareBusy(true);
    setShareStatus('正在保存…');
    apiCall('saveImageToPhotosAlbum', { filePath: dataUrl }).then(function () {
      setShareBusy(false);
      setShareStatus('已保存到相册。', 'ok');
    }).catch(function (error) {
      setShareBusy(false);
      setShareStatus('保存失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可截图保存。', 'error');
    });
  }

  function shareCardImage() {
    if (state.shareBusy) return;
    var route = currentRoute();
    if (!route) return;
    var dataUrl = generateCard(route);
    if (!dataUrl) {
      setShareStatus('当前环境无法生成分享图。', 'error');
      return;
    }
    if (!hasApi('share')) {
      setShareStatus('当前版本不支持直接分享，可先保存图片。', 'error');
      return;
    }
    setShareBusy(true);
    setShareStatus('正在打开分享…');
    apiCall('share', { type: 'image', image_resource: dataUrl }).then(function () {
      setShareBusy(false);
      setShareStatus('已打开分享面板，成功仅表示流程已启动。', 'ok');
    }).catch(function (error) {
      setShareBusy(false);
      setShareStatus(shareError(error), 'error');
    });
  }

  function postShareNote() {
    if (state.shareBusy) return;
    var route = currentRoute();
    if (!route) return;
    var dataUrl = generateCard(route);
    if (!dataUrl) {
      setShareStatus('当前环境无法生成分享图。', 'error');
      return;
    }
    if (!hasApi('postNote')) {
      setShareStatus('当前版本不支持发布笔记，可先保存图片。', 'error');
      return;
    }
    setShareBusy(true);
    setShareStatus('正在打开笔记发布页…');
    apiCall('postNote', {
      title: '北京徒步路线｜' + route.name,
      content: route.highlight + '。' + route.distance + ' · ' + route.ascent + ' · ' +
        route.time + '。路线信息仅供参考，出发前确认开放与天气。',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: dataUrl }] }
    }).then(function () {
      setShareBusy(false);
      setShareStatus('已打开笔记发布页，发布结果以平台为准。', 'ok');
    }).catch(function (error) {
      setShareBusy(false);
      setShareStatus('打开笔记发布页失败' + (error && error.errCode ? '（' + error.errCode + '）' : '') + '，可先保存图片。', 'error');
    });
  }

  function renderGroupChips() {
    clear(els.groupChips);
    var options = [
      { id: 'all', label: '全部' },
      { id: 'family', label: '亲子' },
      { id: 'easy', label: '轻松' },
      { id: 'moderate', label: '进阶' },
      { id: 'hard', label: '挑战' }
    ];
    for (var i = 0; i < options.length; i += 1) {
      var opt = options[i];
      var active = state.group === opt.id;
      var btn = make('button', 'group-chip' + (active ? ' is-active' : ''), opt.label);
      btn.type = 'button';
      btn.setAttribute('data-group', opt.id);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      els.groupChips.appendChild(btn);
    }
  }

  function routeRow(route) {
    var btn = make('button', 'route-row level-' + route.level);
    btn.type = 'button';
    btn.setAttribute('data-route-id', route.id);

    var body = make('span', 'row-body');
    var top = make('span', 'row-top');
    top.appendChild(make('span', 'row-name', route.name));
    top.appendChild(make('span', 'row-level', stars(route.level) + ' ' + Engine.levelName(route.level)));
    body.appendChild(top);
    body.appendChild(make('span', 'row-stats',
      route.distance + ' · ' + route.ascent + ' · ' + route.time));
    body.appendChild(make('span', 'row-highlight', route.highlight));
    btn.appendChild(body);
    btn.appendChild(make('span', 'row-chevron', '›'));
    return btn;
  }

  function renderRoutes() {
    var routes = Engine.filterRoutes(city.routes, { group: state.group });
    clear(els.routeList);
    els.routeCount.textContent = routes.length + ' 条路线';
    els.empty.hidden = routes.length > 0;
    for (var i = 0; i < routes.length; i += 1) {
      els.routeList.appendChild(routeRow(routes[i]));
    }
  }

  function fillDetail(route) {
    els.detailLevel.textContent = stars(route.level) + ' ' + Engine.levelName(route.level);
    els.detailLevel.className = 'detail-level level-' + route.level;
    els.detailStats.textContent = route.distance + ' · ' + route.ascent + ' · ' + route.time;
    els.detailName.textContent = route.name;
    els.detailSummary.textContent = route.summary;
    clear(els.detailTags);
    for (var i = 0; i < route.tags.length; i += 1) {
      els.detailTags.appendChild(make('span', 'detail-tag', route.tags[i]));
    }
    els.detailStart.textContent = route.start;
    clear(els.detailHighlights);
    for (var j = 0; j < route.highlights.length; j += 1) {
      els.detailHighlights.appendChild(make('li', null, route.highlights[j]));
    }
    els.detailTips.textContent = route.tips;
  }

  function openRoute(id) {
    var route = Engine.findRoute(Data.cities, id);
    if (!route) return;
    state.currentRouteId = id;
    state.listScroll = window.pageYOffset || 0;
    fillDetail(route);
    setShareBusy(false);
    setShareStatus('', '');
    updateShareButtons();
    els.listView.hidden = true;
    els.detailView.hidden = false;
    window.scrollTo(0, 0);
  }

  function closeRoute() {
    state.currentRouteId = null;
    setShareStatus('', '');
    els.detailView.hidden = true;
    els.listView.hidden = false;
    window.scrollTo(0, state.listScroll || 0);
  }

  function bind() {
    els.groupChips.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-group]');
      if (!btn) return;
      state.group = btn.getAttribute('data-group');
      renderGroupChips();
      renderRoutes();
    });

    els.routeList.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-route-id]');
      if (!btn) return;
      openRoute(btn.getAttribute('data-route-id'));
    });

    els.detailBack.addEventListener('click', closeRoute);
    els.saveCard.addEventListener('click', saveShareCard);
    els.shareCard.addEventListener('click', shareCardImage);
    els.postNote.addEventListener('click', postShareNote);
  }

  function boot() {
    bind();
    renderGroupChips();
    renderRoutes();
    els.disclaimer.textContent = Data.meta.disclaimer;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
