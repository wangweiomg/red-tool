/*
 * 西方神话与圣史 · 检索与排序引擎
 * 纯逻辑，不依赖 DOM，可在 Node 中测试。
 */
(function (global) {
  'use strict';

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase();
  }

  function haystack(event) {
    return normalize([
      event.dateLabel,
      event.tradition,
      event.kind,
      event.title,
      event.subtitle,
      event.summary,
      (event.paragraphs || []).join(' '),
      (event.keyPoints || []).join(' ')
    ].join(' '));
  }

  // 长卷按时代分组，组内再按年代排序
  var ERA_ORDER = { myth: 0, old: 1, new: 2, church: 3 };

  function eraRank(era) {
    return ERA_ORDER[era] != null ? ERA_ORDER[era] : 99;
  }

  function compareEvents(a, b) {
    var rankA = eraRank(a.era);
    var rankB = eraRank(b.era);
    if (rankA !== rankB) return rankA - rankB;
    if (a.sortYear !== b.sortYear) return a.sortYear - b.sortYear;
    return String(a.id).localeCompare(String(b.id));
  }

  function sortEvents(events) {
    return events.slice().sort(compareEvents);
  }

  function filterEvents(events, options) {
    var opts = options || {};
    var era = opts.era || 'all';
    var kind = opts.kind || 'all';
    var query = normalize(opts.query).trim();
    return sortEvents(events.filter(function (event) {
      if (era !== 'all' && event.era !== era) return false;
      if (kind !== 'all' && event.kind !== kind) return false;
      if (query && haystack(event).indexOf(query) === -1) return false;
      return true;
    }));
  }

  function findEvent(events, id) {
    for (var i = 0; i < events.length; i += 1) {
      if (events[i].id === id) return events[i];
    }
    return null;
  }

  function neighbors(events, id) {
    var sorted = sortEvents(events);
    for (var i = 0; i < sorted.length; i += 1) {
      if (sorted[i].id === id) {
        return {
          prev: i > 0 ? sorted[i - 1] : null,
          next: i < sorted.length - 1 ? sorted[i + 1] : null,
          index: i,
          total: sorted.length
        };
      }
    }
    return { prev: null, next: null, index: -1, total: sorted.length };
  }

  function countByEra(events, eras) {
    var counts = {};
    for (var i = 0; i < eras.length; i += 1) counts[eras[i].id] = 0;
    for (var j = 0; j < events.length; j += 1) {
      if (counts[events[j].era] != null) counts[events[j].era] += 1;
    }
    return counts;
  }

  function eraById(eras, id) {
    for (var i = 0; i < eras.length; i += 1) {
      if (eras[i].id === id) return eras[i];
    }
    return null;
  }

  function groupByEra(events, eras) {
    var sorted = sortEvents(events);
    var groups = [];
    for (var i = 0; i < eras.length; i += 1) {
      var era = eras[i];
      var items = [];
      for (var j = 0; j < sorted.length; j += 1) {
        if (sorted[j].era === era.id) items.push(sorted[j]);
      }
      if (items.length) groups.push({ era: era, events: items });
    }
    return groups;
  }

  global.SacredHistoryEngine = {
    normalize: normalize,
    compareEvents: compareEvents,
    sortEvents: sortEvents,
    filterEvents: filterEvents,
    findEvent: findEvent,
    neighbors: neighbors,
    countByEra: countByEra,
    eraById: eraById,
    groupByEra: groupByEra
  };
}(typeof window !== 'undefined' ? window : this));
