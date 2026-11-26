/* 西方神话与圣史 · 界面逻辑 */
(function () {
  'use strict';

  var Data = window.SACRED_HISTORY_DATA;
  var Engine = window.SacredHistoryEngine;
  if (!Data || !Engine) return;

  var state = {
    view: 'scroll',
    era: 'all',
    kind: 'all',
    query: '',
    currentId: null,
    listScroll: 0
  };

  var els = {
    tabs: document.querySelectorAll('.view-tab'),
    scrollView: document.getElementById('scroll-view'),
    detailView: document.getElementById('detail-view'),
    aboutView: document.getElementById('about-view'),
    eraChips: document.getElementById('era-chips'),
    kindChips: document.getElementById('kind-chips'),
    search: document.getElementById('event-search'),
    count: document.getElementById('event-count'),
    list: document.getElementById('event-list'),
    empty: document.getElementById('event-empty'),
    back: document.getElementById('detail-back'),
    dEra: document.getElementById('detail-era'),
    dKind: document.getElementById('detail-kind'),
    dTradition: document.getElementById('detail-tradition'),
    dDate: document.getElementById('detail-date'),
    dTitle: document.getElementById('detail-title'),
    dSubtitle: document.getElementById('detail-subtitle'),
    dSummary: document.getElementById('detail-summary'),
    dBody: document.getElementById('detail-body'),
    dPoints: document.getElementById('detail-points'),
    dSources: document.getElementById('detail-sources'),
    dCaution: document.getElementById('detail-caution'),
    dCautionWrap: document.getElementById('detail-caution-wrap'),
    dPrev: document.getElementById('detail-prev'),
    dNext: document.getElementById('detail-next'),
    dPosition: document.getElementById('detail-position'),
    aboutCounts: document.getElementById('about-counts')
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

  function kindClass(kind) {
    if (kind === '神话') return 'myth';
    if (kind === '圣经') return 'scripture';
    return 'history';
  }

  function setView(view) {
    state.view = view;
    for (var i = 0; i < els.tabs.length; i += 1) {
      var tab = els.tabs[i];
      var active = tab.getAttribute('data-view') === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    els.scrollView.hidden = view !== 'scroll';
    els.detailView.hidden = true;
    els.aboutView.hidden = view !== 'about';
    state.currentId = null;
    window.scrollTo(0, 0);
  }

  function renderEraChips() {
    clear(els.eraChips);
    var all = make('button', 'chip' + (state.era === 'all' ? ' is-active' : ''), '全部');
    all.type = 'button';
    all.setAttribute('data-era', 'all');
    all.setAttribute('aria-pressed', state.era === 'all' ? 'true' : 'false');
    els.eraChips.appendChild(all);
    for (var i = 0; i < Data.eras.length; i += 1) {
      var era = Data.eras[i];
      var btn = make('button', 'chip' + (state.era === era.id ? ' is-active' : ''), era.name);
      btn.type = 'button';
      btn.setAttribute('data-era', era.id);
      btn.setAttribute('aria-pressed', state.era === era.id ? 'true' : 'false');
      els.eraChips.appendChild(btn);
    }
  }

  function renderKindChips() {
    clear(els.kindChips);
    var options = [
      { id: 'all', label: '全部' },
      { id: '神话', label: '神话' },
      { id: '圣经', label: '圣经' },
      { id: '历史', label: '宗教史' }
    ];
    for (var i = 0; i < options.length; i += 1) {
      var opt = options[i];
      var btn = make('button', 'chip chip-kind' + (state.kind === opt.id ? ' is-active' : ''), opt.label);
      btn.type = 'button';
      btn.setAttribute('data-kind', opt.id);
      btn.setAttribute('aria-pressed', state.kind === opt.id ? 'true' : 'false');
      els.kindChips.appendChild(btn);
    }
  }

  function renderCard(event) {
    var card = make('button', 'event-card');
    card.type = 'button';
    card.setAttribute('data-event-id', event.id);

    var date = make('span', 'event-date');
    date.appendChild(make('span', 'event-date-text', event.dateLabel));
    card.appendChild(date);

    var body = make('span', 'event-body');
    var badges = make('span', 'event-badges');
    var kind = make('span', 'event-kind is-' + kindClass(event.kind), event.kind);
    badges.appendChild(kind);
    badges.appendChild(make('span', 'event-tradition', event.tradition));
    body.appendChild(badges);
    body.appendChild(make('span', 'event-title', event.title));
    body.appendChild(make('span', 'event-subtitle', event.subtitle));
    body.appendChild(make('span', 'event-summary', event.summary));
    body.appendChild(make('span', 'event-open', '展开这件大事 →'));
    card.appendChild(body);

    return card;
  }

  function renderList() {
    var events = Engine.filterEvents(Data.events, {
      era: state.era,
      kind: state.kind,
      query: state.query
    });
    clear(els.list);
    els.count.textContent = '共 ' + events.length + ' 件大事';
    els.empty.hidden = events.length > 0;

    var groups = Engine.groupByEra(events, Data.eras);
    for (var i = 0; i < groups.length; i += 1) {
      var group = groups[i];
      var section = make('section', 'era-section');
      var head = make('header', 'era-head');
      head.appendChild(make('p', 'era-kicker', group.era.range));
      head.appendChild(make('h2', 'era-title', group.era.name));
      head.appendChild(make('p', 'era-summary', group.era.summary));
      section.appendChild(head);
      var grid = make('div', 'event-grid');
      for (var j = 0; j < group.events.length; j += 1) {
        grid.appendChild(renderCard(group.events[j]));
      }
      section.appendChild(grid);
      els.list.appendChild(section);
    }
  }

  function fillDetail(event) {
    var era = Engine.eraById(Data.eras, event.era);
    els.dEra.textContent = era ? era.name : '';
    els.dKind.textContent = event.kind;
    els.dKind.className = 'detail-kind is-' + kindClass(event.kind);
    els.dTradition.textContent = event.tradition;
    els.dDate.textContent = event.dateLabel;
    els.dTitle.textContent = event.title;
    els.dSubtitle.textContent = event.subtitle;
    els.dSummary.textContent = event.summary;
    clear(els.dBody);
    for (var i = 0; i < event.paragraphs.length; i += 1) {
      els.dBody.appendChild(make('p', 'detail-paragraph', event.paragraphs[i]));
    }
    clear(els.dPoints);
    for (var j = 0; j < event.keyPoints.length; j += 1) {
      els.dPoints.appendChild(make('li', null, event.keyPoints[j]));
    }
    els.dSources.textContent = event.sources;
    if (event.caution) {
      els.dCautionWrap.hidden = false;
      els.dCaution.textContent = event.caution;
    } else {
      els.dCautionWrap.hidden = true;
      els.dCaution.textContent = '';
    }

    var near = Engine.neighbors(Data.events, event.id);
    els.dPosition.textContent = (near.index + 1) + ' / ' + near.total;
    if (near.prev) {
      els.dPrev.hidden = false;
      els.dPrev.setAttribute('data-event-id', near.prev.id);
      els.dPrev.textContent = '‹ ' + near.prev.title;
    } else {
      els.dPrev.hidden = true;
      els.dPrev.textContent = '';
    }
    if (near.next) {
      els.dNext.hidden = false;
      els.dNext.setAttribute('data-event-id', near.next.id);
      els.dNext.textContent = near.next.title + ' ›';
    } else {
      els.dNext.hidden = true;
      els.dNext.textContent = '';
    }
  }

  function openEvent(id) {
    var event = Engine.findEvent(Data.events, id);
    if (!event) return;
    if (state.currentId == null) state.listScroll = window.pageYOffset || 0;
    state.currentId = event.id;
    fillDetail(event);
    els.scrollView.hidden = true;
    els.aboutView.hidden = true;
    els.detailView.hidden = false;
    window.scrollTo(0, 0);
  }

  function closeDetail() {
    state.currentId = null;
    els.detailView.hidden = true;
    els.scrollView.hidden = false;
    window.scrollTo(0, state.listScroll || 0);
  }

  function renderAbout() {
    var counts = Engine.countByEra(Data.events, Data.eras);
    els.aboutCounts.textContent = Data.events.length + ' 件大事 · ' +
      Data.eras.length + ' 个时代 · 神话时代 ' + counts.myth + ' 件 · 旧约时代 ' + counts.old +
      ' 件 · 新约与早期教会 ' + counts.new + ' 件 · 中世纪与改革 ' + counts.church + ' 件';
  }

  function bind() {
    for (var i = 0; i < els.tabs.length; i += 1) {
      els.tabs[i].addEventListener('click', function () {
        setView(this.getAttribute('data-view'));
      });
    }

    els.eraChips.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-era]');
      if (!btn) return;
      state.era = btn.getAttribute('data-era');
      renderEraChips();
      renderList();
    });

    els.kindChips.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-kind]');
      if (!btn) return;
      state.kind = btn.getAttribute('data-kind');
      renderKindChips();
      renderList();
    });

    els.search.addEventListener('input', function () {
      state.query = this.value;
      renderList();
    });

    els.list.addEventListener('click', function (event) {
      var card = event.target.closest('[data-event-id]');
      if (!card) return;
      openEvent(card.getAttribute('data-event-id'));
    });

    els.back.addEventListener('click', closeDetail);

    els.dPrev.addEventListener('click', function () {
      if (this.getAttribute('data-event-id')) openEvent(this.getAttribute('data-event-id'));
    });

    els.dNext.addEventListener('click', function () {
      if (this.getAttribute('data-event-id')) openEvent(this.getAttribute('data-event-id'));
    });
  }

  function boot() {
    bind();
    renderEraChips();
    renderKindChips();
    renderList();
    renderAbout();
    setView('scroll');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
