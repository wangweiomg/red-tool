/*
 * 双线编年史 · 检索与排序引擎
 * 纯逻辑，不依赖 DOM，可在 Node 中测试。
 */
(function (global) {
  'use strict';

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase();
  }

  function entryHaystack(entry) {
    return normalize([
      entry.yearLabel,
      entry.china && entry.china.title,
      entry.china && entry.china.text,
      entry.west && entry.west.title,
      entry.west && entry.west.text
    ].join(' '));
  }

  function storyHaystack(story) {
    return normalize([
      story.title,
      story.subtitle,
      story.period,
      story.summary,
      (story.paragraphs || []).join(' '),
      (story.keyPoints || []).join(' ')
    ].join(' '));
  }

  function compareEntries(a, b) {
    if (a.sortYear !== b.sortYear) return a.sortYear - b.sortYear;
    return String(a.id).localeCompare(String(b.id));
  }

  function sortEntries(entries) {
    return entries.slice().sort(compareEntries);
  }

  function filterEntries(entries, options) {
    var opts = options || {};
    var era = opts.era || 'all';
    var query = normalize(opts.query).trim();
    var includeLegend = opts.includeLegend !== false;
    return sortEntries(entries.filter(function (entry) {
      if (era !== 'all' && entry.era !== era) return false;
      if (!includeLegend && entry.legend) return false;
      if (query && entryHaystack(entry).indexOf(query) === -1) return false;
      return true;
    }));
  }

  function filterStories(stories, options) {
    var opts = options || {};
    var region = opts.region || 'all';
    var query = normalize(opts.query).trim();
    return stories.filter(function (story) {
      if (region !== 'all' && story.region !== region) return false;
      if (query && storyHaystack(story).indexOf(query) === -1) return false;
      return true;
    });
  }

  function findStory(stories, id) {
    for (var i = 0; i < stories.length; i += 1) {
      if (stories[i].id === id) return stories[i];
    }
    return null;
  }

  function entriesForStory(entries, id) {
    return sortEntries(entries.filter(function (entry) {
      return (entry.storyIds || []).indexOf(id) !== -1;
    }));
  }

  function storyIndex(stories) {
    var map = {};
    for (var i = 0; i < stories.length; i += 1) {
      map[stories[i].id] = stories[i];
    }
    return map;
  }

  function countByEra(entries, eras) {
    var counts = {};
    for (var i = 0; i < eras.length; i += 1) counts[eras[i].id] = 0;
    for (var j = 0; j < entries.length; j += 1) {
      if (counts[entries[j].era] != null) counts[entries[j].era] += 1;
    }
    return counts;
  }

  function eraById(eras, id) {
    for (var i = 0; i < eras.length; i += 1) {
      if (eras[i].id === id) return eras[i];
    }
    return null;
  }

  global.ChronicleEngine = {
    normalize: normalize,
    compareEntries: compareEntries,
    sortEntries: sortEntries,
    filterEntries: filterEntries,
    filterStories: filterStories,
    findStory: findStory,
    entriesForStory: entriesForStory,
    storyIndex: storyIndex,
    countByEra: countByEra,
    eraById: eraById
  };
}(typeof window !== 'undefined' ? window : this));
