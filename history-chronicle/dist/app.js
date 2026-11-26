/* 双线编年史 · 界面逻辑 */
(function () {
  'use strict';

  var Data = window.CHRONICLE_DATA;
  var Engine = window.ChronicleEngine;
  if (!Data || !Engine) return;

  var state = {
    view: 'timeline',
    era: 'all',
    region: 'all',
    queryTimeline: '',
    queryStories: '',
    includeLegend: true,
    currentStory: null
  };

  var els = {
    tabs: document.querySelectorAll('.view-tab'),
    timelineView: document.getElementById('timeline-view'),
    storiesView: document.getElementById('stories-view'),
    storyDetail: document.getElementById('story-detail'),
    aboutView: document.getElementById('about-view'),
    eraChips: document.getElementById('era-chips'),
    regionChips: document.getElementById('region-chips'),
    timelineSearch: document.getElementById('timeline-search'),
    storySearch: document.getElementById('story-search'),
    includeLegend: document.getElementById('include-legend'),
    timelineList: document.getElementById('timeline-list'),
    timelineCount: document.getElementById('timeline-count'),
    timelineEmpty: document.getElementById('timeline-empty'),
    storiesList: document.getElementById('stories-list'),
    storiesCount: document.getElementById('stories-count'),
    storiesEmpty: document.getElementById('stories-empty'),
    detailBack: document.getElementById('detail-back'),
    detailRegion: document.getElementById('detail-region'),
    detailKind: document.getElementById('detail-kind'),
    detailTitle: document.getElementById('detail-title'),
    detailSubtitle: document.getElementById('detail-subtitle'),
    detailPeriod: document.getElementById('detail-period'),
    detailSummary: document.getElementById('detail-summary'),
    detailBody: document.getElementById('detail-body'),
    detailPoints: document.getElementById('detail-points'),
    detailSources: document.getElementById('detail-sources'),
    detailEntries: document.getElementById('detail-entries'),
    aboutCounts: document.getElementById('about-counts')
  };

  var storyMap = Engine.storyIndex(Data.stories);

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setView(view) {
    state.view = view;
    for (var i = 0; i < els.tabs.length; i += 1) {
      var tab = els.tabs[i];
      var active = tab.getAttribute('data-view') === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    els.timelineView.hidden = view !== 'timeline';
    els.storiesView.hidden = view !== 'stories';
    els.aboutView.hidden = view !== 'about';
    els.storyDetail.hidden = true;
    state.currentStory = null;
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

  function renderRegionChips() {
    clear(els.regionChips);
    var options = [
      { id: 'all', label: '全部' },
      { id: 'cn', label: '中国' },
      { id: 'west', label: '西方' }
    ];
    for (var i = 0; i < options.length; i += 1) {
      var opt = options[i];
      var btn = make('button', 'chip chip-region' + (state.region === opt.id ? ' is-active' : ''), opt.label);
      btn.type = 'button';
      btn.setAttribute('data-region', opt.id);
      btn.setAttribute('aria-pressed', state.region === opt.id ? 'true' : 'false');
      els.regionChips.appendChild(btn);
    }
  }

  function storyChip(storyId) {
    var story = storyMap[storyId];
    if (!story) return null;
    var btn = make('button', 'story-link ' + (story.region === 'cn' ? 'is-cn' : 'is-west'));
    btn.type = 'button';
    btn.setAttribute('data-story-id', story.id);
    btn.appendChild(make('span', 'story-link-label', '纪传'));
    btn.appendChild(make('span', 'story-link-title', story.title));
    return btn;
  }

  function renderSide(entry, side) {
    var data = entry[side === 'cn' ? 'china' : 'west'];
    var box = make('section', 'entry-side ' + side);
    var head = make('div', 'entry-side-head');
    head.appendChild(make('span', 'region-dot'));
    head.appendChild(make('span', 'region-name', side === 'cn' ? '中国' : '西方'));
    box.appendChild(head);
    box.appendChild(make('h3', 'entry-title', data.title));
    box.appendChild(make('p', 'entry-text', data.text));
    var links = make('div', 'story-links');
    var ids = entry.storyIds || [];
    for (var i = 0; i < ids.length; i += 1) {
      var story = storyMap[ids[i]];
      if (!story || story.region !== side) continue;
      var chip = storyChip(ids[i]);
      if (chip) links.appendChild(chip);
    }
    if (links.firstChild) box.appendChild(links);
    return box;
  }

  function renderTimeline() {
    var entries = Engine.filterEntries(Data.entries, {
      era: state.era,
      query: state.queryTimeline,
      includeLegend: state.includeLegend
    });
    clear(els.timelineList);
    els.timelineCount.textContent = '共 ' + entries.length + ' 个时间节点';
    els.timelineEmpty.hidden = entries.length > 0;
    for (var i = 0; i < entries.length; i += 1) {
      var entry = entries[i];
      var article = make('article', 'entry');
      article.setAttribute('data-entry-id', entry.id);
      article.appendChild(renderSide(entry, 'cn'));
      var year = make('div', 'entry-year');
      year.appendChild(make('span', 'year-dot'));
      year.appendChild(make('span', 'year-label', entry.yearLabel));
      if (entry.legend) year.appendChild(make('span', 'year-tag', '神话/传说'));
      else if (entry.approx) year.appendChild(make('span', 'year-tag is-approx', '约'));
      article.appendChild(year);
      article.appendChild(renderSide(entry, 'west'));
      els.timelineList.appendChild(article);
    }
  }

  function renderStories() {
    var stories = Engine.filterStories(Data.stories, {
      region: state.region,
      query: state.queryStories
    });
    clear(els.storiesList);
    els.storiesCount.textContent = '共 ' + stories.length + ' 则';
    els.storiesEmpty.hidden = stories.length > 0;
    for (var i = 0; i < stories.length; i += 1) {
      var story = stories[i];
      var card = make('button', 'story-card');
      card.type = 'button';
      card.setAttribute('data-story-id', story.id);
      var top = make('span', 'story-card-top');
      top.appendChild(make('span', 'story-region ' + (story.region === 'cn' ? 'is-cn' : 'is-west'),
        story.region === 'cn' ? '中国' : '西方'));
      top.appendChild(make('span', 'story-kind', story.kind));
      card.appendChild(top);
      card.appendChild(make('span', 'story-card-title', story.title));
      card.appendChild(make('span', 'story-card-subtitle', story.subtitle));
      card.appendChild(make('span', 'story-card-summary', story.summary));
      card.appendChild(make('span', 'story-card-meta', story.period + ' · 阅读全文 →'));
      els.storiesList.appendChild(card);
    }
  }

  function fillDetail(story) {
    els.detailRegion.textContent = story.region === 'cn' ? '中国' : '西方';
    els.detailRegion.className = 'story-region ' + (story.region === 'cn' ? 'is-cn' : 'is-west');
    els.detailKind.textContent = story.kind;
    els.detailTitle.textContent = story.title;
    els.detailSubtitle.textContent = story.subtitle;
    els.detailPeriod.textContent = story.period;
    els.detailSummary.textContent = story.summary;
    clear(els.detailBody);
    for (var i = 0; i < story.paragraphs.length; i += 1) {
      els.detailBody.appendChild(make('p', 'detail-paragraph', story.paragraphs[i]));
    }
    clear(els.detailPoints);
    for (var j = 0; j < story.keyPoints.length; j += 1) {
      els.detailPoints.appendChild(make('li', null, story.keyPoints[j]));
    }
    els.detailSources.textContent = story.sources;
    clear(els.detailEntries);
    var entries = Engine.entriesForStory(Data.entries, story.id);
    for (var k = 0; k < entries.length; k += 1) {
      var entry = entries[k];
      var btn = make('button', 'related-entry');
      btn.type = 'button';
      btn.setAttribute('data-entry-id', entry.id);
      btn.appendChild(make('span', 'related-year', entry.yearLabel));
      btn.appendChild(make('span', 'related-title', entry.china.title + ' / ' + entry.west.title));
      els.detailEntries.appendChild(btn);
    }
  }

  function openStory(id) {
    var story = Engine.findStory(Data.stories, id);
    if (!story) return;
    state.currentStory = story.id;
    fillDetail(story);
    els.storiesView.hidden = true;
    els.storyDetail.hidden = false;
    window.scrollTo(0, 0);
  }

  function closeStory() {
    state.currentStory = null;
    els.storyDetail.hidden = true;
    els.storiesView.hidden = false;
    window.scrollTo(0, 0);
  }

  function focusEntry(id) {
    state.era = 'all';
    state.queryTimeline = '';
    state.includeLegend = true;
    els.timelineSearch.value = '';
    els.includeLegend.checked = true;
    renderEraChips();
    setView('timeline');
    renderTimeline();
    var node = els.timelineList.querySelector('[data-entry-id="' + id + '"]');
    if (node) {
      node.classList.add('is-highlight');
      node.scrollIntoView({ block: 'center' });
      setTimeout(function () {
        node.classList.remove('is-highlight');
      }, 1800);
    }
  }

  function renderAbout() {
    els.aboutCounts.textContent = Data.entries.length + ' 个时间节点 · ' +
      Data.stories.length + ' 则纪传故事 · ' + Data.eras.length + ' 个时代';
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
      renderTimeline();
    });

    els.regionChips.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-region]');
      if (!btn) return;
      state.region = btn.getAttribute('data-region');
      renderRegionChips();
      renderStories();
    });

    els.timelineSearch.addEventListener('input', function () {
      state.queryTimeline = this.value;
      renderTimeline();
    });

    els.storySearch.addEventListener('input', function () {
      state.queryStories = this.value;
      renderStories();
    });

    els.includeLegend.addEventListener('change', function () {
      state.includeLegend = this.checked;
      renderTimeline();
    });

    els.timelineList.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-story-id]');
      if (!btn) return;
      setView('stories');
      openStory(btn.getAttribute('data-story-id'));
    });

    els.storiesList.addEventListener('click', function (event) {
      var card = event.target.closest('[data-story-id]');
      if (!card) return;
      openStory(card.getAttribute('data-story-id'));
    });

    els.detailBack.addEventListener('click', closeStory);

    els.detailEntries.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-entry-id]');
      if (!btn) return;
      focusEntry(btn.getAttribute('data-entry-id'));
    });
  }

  function boot() {
    bind();
    renderEraChips();
    renderRegionChips();
    renderTimeline();
    renderStories();
    renderAbout();
    setView('timeline');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
