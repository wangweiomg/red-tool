/*
 * 城市徒步指南 · 筛选与排序引擎
 * 纯逻辑，不依赖 DOM，可在 Node 中测试。
 */
(function (global) {
  'use strict';

  var LEVEL_NAMES = {
    1: '轻松',
    2: '入门',
    3: '进阶',
    4: '挑战',
    5: '硬核'
  };

  function normalize(text) {
    return String(text == null ? '' : text).toLowerCase();
  }

  function levelName(level) {
    return LEVEL_NAMES[level] || '';
  }

  function levelGroup(level) {
    if (level <= 2) return 'easy';
    if (level === 3) return 'moderate';
    return 'hard';
  }

  function compareRoutes(a, b) {
    if (a.level !== b.level) return a.level - b.level;
    return String(a.name).localeCompare(String(b.name));
  }

  function sortRoutes(routes) {
    return routes.slice().sort(compareRoutes);
  }

  function routeHaystack(route) {
    return normalize([
      route.name,
      route.distance,
      route.ascent,
      route.time,
      route.summary,
      route.start,
      route.tips,
      (route.tags || []).join(' '),
      (route.highlights || []).join(' ')
    ].join(' '));
  }

  function filterRoutes(routes, options) {
    var opts = options || {};
    var group = opts.group || 'all';
    var query = normalize(opts.query).trim();
    return sortRoutes(routes.filter(function (route) {
      if (group === 'family') return !!route.family;
      if (group !== 'all' && levelGroup(route.level) !== group) return false;
      if (query && routeHaystack(route).indexOf(query) === -1) return false;
      return true;
    }));
  }

  function cityById(cities, id) {
    for (var i = 0; i < cities.length; i += 1) {
      if (cities[i].id === id) return cities[i];
    }
    return null;
  }

  function routeCount(city) {
    return city && city.routes ? city.routes.length : 0;
  }

  function totalRoutes(cities) {
    var total = 0;
    for (var i = 0; i < cities.length; i += 1) {
      total += routeCount(cities[i]);
    }
    return total;
  }

  function groupCounts(routes) {
    var counts = { easy: 0, moderate: 0, hard: 0 };
    for (var i = 0; i < routes.length; i += 1) {
      counts[levelGroup(routes[i].level)] += 1;
    }
    return counts;
  }

  function findRoute(cities, id) {
    for (var i = 0; i < cities.length; i += 1) {
      var routes = cities[i].routes || [];
      for (var j = 0; j < routes.length; j += 1) {
        if (routes[j].id === id) return routes[j];
      }
    }
    return null;
  }

  global.HikingEngine = {
    LEVEL_NAMES: LEVEL_NAMES,
    normalize: normalize,
    levelName: levelName,
    levelGroup: levelGroup,
    compareRoutes: compareRoutes,
    sortRoutes: sortRoutes,
    filterRoutes: filterRoutes,
    cityById: cityById,
    routeCount: routeCount,
    totalRoutes: totalRoutes,
    groupCounts: groupCounts,
    findRoute: findRoute
  };
}(typeof window !== 'undefined' ? window : this));
