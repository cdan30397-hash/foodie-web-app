/**
 * app.js — 美食推荐 Web App 主控制器
 * 整合定位、天气、搜索、食堂数据库、推荐引擎、文案生成、UI 渲染
 */

(function() {
  'use strict';

  // ===== 配置 =====
  var CONFIG = {
    MIN_RATING: 3.5,
    TOP_K: 3,
    WEIGHTS: {
      weather: 0.30,
      seasonal: 0.25,
      dateType: 0.20,
      distance: 0.15,
      timeOfDay: 0.10
    },
    SEARCH_RADIUS: 1000,
    CACHE_TTL: 30 * 60 * 1000, // 30分钟
    SEARCH_KEYWORDS: ['美食', '餐厅', '快餐', '火锅', '面馆', '麻辣烫', '奶茶', '烧烤', '日料', '小吃', '粤菜', '轻食', '甜品']
  };

  // ===== 状态 =====
  var state = {
    location: null,
    weather: null,
    termInfo: null,
    result: null,
    loading: false,
    error: null,
    city: '定位中...'
  };

  // ===== 食堂编辑状态 =====
  var editingId = null;

  // ===== 工具函数 =====
  function $(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  function show(el) { if (typeof el === 'string') el = $(el); if (el) el.classList.remove('hidden'); }
  function hide(el) { if (typeof el === 'string') el = $(el); if (el) el.classList.add('hidden'); }

  function setCache(key, data) {
    var item = { data: data, ts: Date.now() };
    try { localStorage.setItem('foodie_' + key, JSON.stringify(item)); } catch(e) {}
  }

  function getCache(key) {
    try {
      var raw = localStorage.getItem('foodie_' + key);
      if (!raw) return null;
      var item = JSON.parse(raw);
      if (Date.now() - item.ts < CONFIG.CACHE_TTL) return item.data;
    } catch(e) {}
    return null;
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('foodie_history') || '[]'); } catch(e) { return []; }
  }

  function saveHistory(item) {
    var history = getHistory();
    history.unshift({ name: item.name, category: item.category, ts: Date.now() });
    if (history.length > 20) history = history.slice(0, 20);
    try { localStorage.setItem('foodie_history', JSON.stringify(history)); } catch(e) {}
  }

  // ===== 定位 =====
  function getLocation() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) {
        return reject(new Error('浏览器不支持定位'));
      }
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        function(err) {
          var msg = '定位失败: ';
          if (err.code === 1) msg += '请在浏览器设置中允许位置访问';
          else if (err.code === 2) msg += '无法获取位置信息';
          else msg += '定位超时，请重试';
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  // ===== 核心流程 =====
  async function loadRecommendation(forceRefresh) {
    if (state.loading) return;
    state.loading = true;
    state.error = null;

    // 检查缓存
    if (!forceRefresh) {
      var cached = getCache('recommend');
      if (cached) {
        state.result = cached;
        state.loading = false;
        renderResult();
        return;
      }
    }

    renderLoading();

    try {
      // Step 1: 定位
      var location = await getLocation();
      state.location = location;
      setCache('location', location);

      // Step 2: 并行获取天气 + 地址
      var [weather, geoInfo] = await Promise.all([
        TMAP.getWeather(location).catch(function() { return null; }),
        TMAP.reverseGeocoder(location).catch(function() { return null; })
      ]);

      if (weather) {
        state.weather = weather;
        setCache('weather', weather);
      }

      if (geoInfo) {
        state.city = geoInfo.city || geoInfo.district || '附近';
      }

      // Step 3: 计算节气
      state.termInfo = SolarTerm.getCurrentSolarTerm();

      // Step 4: 搜索周边餐厅（腾讯地图 POI）
      var allRestaurants = [];
      var keywords = [CONFIG.SEARCH_KEYWORDS[0], CONFIG.SEARCH_KEYWORDS[1], CONFIG.SEARCH_KEYWORDS[2]];

      for (var i = 0; i < keywords.length; i++) {
        try {
          var results = await TMAP.searchNearby({
            keyword: keywords[i],
            location: location,
            radius: CONFIG.SEARCH_RADIUS
          });
          allRestaurants = allRestaurants.concat(results);
        } catch(e) {}
      }

      // Step 5: ★ 合并自建食堂数据 ★
      var canteenData = CanteenDB.toEngineFormat();
      allRestaurants = allRestaurants.concat(canteenData);

      // 去重
      var seen = {};
      allRestaurants = allRestaurants.filter(function(r) {
        if (seen[r.poi_id]) return false;
        seen[r.poi_id] = true;
        return true;
      });

      // Step 6: 构建推荐上下文
      var weatherType = state.weather ? FoodEngine.classifyWeather(state.weather) : { type: 'normal', isRain: false, isHot: false, isCold: false, isHumid: false, isDry: false, description: '舒适' };
      var timeContext = FoodEngine.getTimeContext();
      timeContext.season = (state.termInfo && state.termInfo.season) || 'summer';
      timeContext.termName = (state.termInfo && state.termInfo.name) || '';

      var context = {
        weatherType: weatherType,
        timeContext: timeContext,
        userLocation: location,
        history: getHistory(),
        preferences: null
      };

      // Step 7: 运行推荐引擎
      if (allRestaurants.length === 0) {
        state.error = '附近暂时没有找到餐厅，试试扩大搜索范围';
        state.loading = false;
        renderError();
        return;
      }

      var engineResult = FoodEngine.run(allRestaurants, context, CONFIG);

      if (!engineResult.chosen) {
        state.error = '没有符合条件的推荐，请稍后再试';
        state.loading = false;
        renderError();
        return;
      }

      // Step 8: 生成文案
      var fullResult = FoodCopywriter.generate(engineResult, {
        weatherType: weatherType,
        timeContext: timeContext
      });

      // 保存历史
      saveHistory(fullResult.recommended_restaurant);

      // 缓存结果
      state.result = fullResult;
      setCache('recommend', fullResult);

      state.loading = false;
      renderResult();

    } catch (err) {
      state.error = err.message || '加载失败，请重试';
      state.loading = false;
      renderError();
    }
  }

  // ===== 初始化 =====
  function init() {
    renderLoading();

    // 加载缓存的天气
    var cachedWeather = getCache('weather');
    if (cachedWeather) state.weather = cachedWeather;

    // 计算节气
    state.termInfo = SolarTerm.getCurrentSolarTerm();

    // 检查缓存
    var cached = getCache('recommend');
    if (cached) {
      state.result = cached;
      state.loading = false;
      // 异步获取当前天气更新
      getLocation().then(function(loc) {
        state.location = loc;
        TMAP.getWeather(loc).then(function(w) {
          state.weather = w;
          setCache('weather', w);
          renderWeatherBar();
        }).catch(function(){});
      }).catch(function(){});
      renderResult();
      return;
    }

    // 正常加载
    loadRecommendation();
  }

  // ===== UI 渲染 =====
  function renderLoading() {
    $('skeleton').classList.remove('hidden');
    $('error-panel').classList.add('hidden');
    $('result-panel').classList.add('hidden');
    $('retry-btn').classList.add('hidden');
    renderWeatherBar();
  }

  function renderError() {
    $('skeleton').classList.add('hidden');
    $('error-panel').classList.remove('hidden');
    $('result-panel').classList.add('hidden');
    $('retry-btn').classList.remove('hidden');
    $('error-msg').textContent = state.error || '加载失败';
  }

  function renderWeatherBar() {
    var temp = state.weather ? state.weather.temperature : '--';
    var desc = state.weather ? state.weather.weather : '';
    var term = state.termInfo;
    $('weather-temp').textContent = temp + '°';
    $('weather-desc').textContent = desc;
    $('weather-city').textContent = state.city;
    if (term) {
      $('term-name').textContent = (term.emoji || '') + ' ' + term.name;
      $('term-tip').textContent = term.tip || '';
    }
  }

  function renderResult() {
    if (!state.result) return;

    $('skeleton').classList.add('hidden');
    $('error-panel').classList.add('hidden');
    $('result-panel').classList.remove('hidden');

    var r = state.result.recommended_restaurant;
    var reason = state.result.recommendation_reason;
    var tips = state.result.special_tips;
    var mood = state.result.mood_emoji;

    // 餐厅卡片 — 添加来源标记
    var sourceBadge = r.source === 'canteen'
      ? '<span class="source-badge-canteen">校内</span>'
      : '<span class="source-badge-tmap">周边</span>';
    $('restaurant-name').innerHTML = mood + ' ' + r.name + sourceBadge;
    $('restaurant-category').textContent = r.category;
    $('restaurant-rating').textContent = '⭐ ' + r.rating;
    $('restaurant-price').textContent = '¥' + r.estimated_price;
    $('restaurant-distance').textContent = (r.distance < 1000 ? r.distance + 'm' : (r.distance / 1000).toFixed(1) + 'km');

    // 标签
    var tagsHtml = '';
    var tags = (r.tags || []).slice();
    if (r.distance < 200) tags.unshift('超近');
    if (r.rating >= 4.5) tags.unshift('高评分');
    for (var i = 0; i < Math.min(tags.length, 5); i++) {
      tagsHtml += '<span class="tag">' + tags[i] + '</span>';
    }
    $('restaurant-tags').innerHTML = tagsHtml;

    // 推荐理由
    $('reason-weather').textContent = reason.weather_factor;
    $('reason-seasonal').textContent = reason.seasonal_factor;
    $('reason-time').textContent = reason.time_factor;
    $('reason-overall').textContent = reason.overall;

    // 小贴士 — 如果是食堂窗口，加上必点菜提示
    if (tips.eating_tip && r.mustTry) {
      tips.eating_tip = '必点：' + r.mustTry + '。' + tips.eating_tip;
    } else if (!tips.eating_tip && r.mustTry) {
      tips.eating_tip = '必点：' + r.mustTry;
    }
    if (tips.health_tip) {
      $('tip-health').textContent = tips.health_tip;
      $('tip-health-row').classList.remove('hidden');
    } else {
      $('tip-health-row').classList.add('hidden');
    }
    if (tips.eating_tip) {
      $('tip-eating').textContent = tips.eating_tip;
      $('tip-eating-row').classList.remove('hidden');
    } else {
      $('tip-eating-row').classList.add('hidden');
    }
    if (tips.weather_tip) {
      $('tip-weather').textContent = tips.weather_tip;
      $('tip-weather-row').classList.remove('hidden');
    } else {
      $('tip-weather-row').classList.add('hidden');
    }

    // 备选方案
    var alts = state.result.alternative_options || [];
    var altsHtml = '';
    for (var i = 0; i < alts.length; i++) {
      altsHtml += '<div class="alt-item">' + alts[i] + '</div>';
    }
    if (altsHtml) {
      $('alternatives-list').innerHTML = altsHtml;
      $('alternatives-section').classList.remove('hidden');
    } else {
      $('alternatives-section').classList.add('hidden');
    }

    // 话题标签
    var hashtags = state.result.hashtag || [];
    var htHtml = '';
    for (var i = 0; i < hashtags.length; i++) {
      htHtml += '<span class="hashtag-item">' + hashtags[i] + '</span>';
    }
    $('hashtags-row').innerHTML = htHtml;

    renderWeatherBar();
  }

  // ===== 食堂管理 =====
  function openCanteenModal() {
    $('canteen-modal').classList.remove('hidden');
    hideCanteenForm();
    renderCanteenList();
  }

  function closeCanteenModal() {
    $('canteen-modal').classList.add('hidden');
  }

  function renderCanteenList() {
    var list = CanteenDB.getAll();
    var html = '';
    if (list.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:var(--c-text-muted);">还没有食堂数据<br>点击「添加窗口」开始录入</div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        html += '<div class="canteen-item">' +
          '<div class="canteen-item-info">' +
            '<div class="canteen-item-name">' + escapeHtml(item.name) + '</div>' +
            '<div class="canteen-item-meta">' +
              '<span>📍 ' + escapeHtml(item.canteen || '') + (item.floor ? ' ' + escapeHtml(item.floor) : '') + '</span>' +
              '<span>🏷 ' + escapeHtml(item.category || '其他') + '</span>' +
              '<span>📏 ' + (item.distance || 200) + 'm</span>' +
              '<span>💰 ¥' + (item.price || 20) + '</span>' +
              '<span>⭐ ' + (item.rating || 4.0) + '</span>' +
            '</div>' +
            (item.mustTry ? '<div class="canteen-item-musttry">必点：' + escapeHtml(item.mustTry) + '</div>' : '') +
          '</div>' +
          '<div class="canteen-item-actions">' +
            '<button onclick="FoodieApp.editCanteen(\'' + item.id + '\')">编辑</button>' +
            '<button class="del-btn" onclick="FoodieApp.deleteCanteen(\'' + item.id + '\')">删除</button>' +
          '</div>' +
        '</div>';
      }
    }
    $('canteen-list').innerHTML = html;
  }

  function showCanteenForm(item) {
    editingId = item ? item.id : null;
    $('canteen-form').classList.remove('hidden');
    $('f-name').value = item ? (item.name || '') : '';
    $('f-canteen').value = item ? (item.canteen || '') : '';
    $('f-floor').value = item ? (item.floor || '') : '';
    $('f-category').value = item ? (item.category || '快餐') : '快餐';
    $('f-distance').value = item ? (item.distance || 200) : 200;
    $('f-price').value = item ? (item.price || 20) : 20;
    $('f-rating').value = item ? (item.rating || 4.0) : 4.0;
    $('f-musttry').value = item ? (item.mustTry || '') : '';
    $('f-tags').value = item ? (item.tags || ['校内']).join(', ') : '校内';
    $('f-name').focus();
  }

  function hideCanteenForm() {
    $('canteen-form').classList.add('hidden');
    editingId = null;
  }

  function saveCanteenForm() {
    var name = $('f-name').value.trim();
    if (!name) {
      alert('请填写窗口名称');
      return;
    }
    var tags = $('f-tags').value.split(/[,，]/).map(function(t) { return t.trim(); }).filter(function(t) { return t; });
    if (tags.indexOf('校内') === -1) tags.unshift('校内');

    var data = {
      name: name,
      canteen: $('f-canteen').value.trim(),
      floor: $('f-floor').value.trim(),
      category: $('f-category').value,
      distance: parseInt($('f-distance').value) || 200,
      price: parseInt($('f-price').value) || 20,
      rating: parseFloat($('f-rating').value) || 4.0,
      mustTry: $('f-musttry').value.trim(),
      tags: tags
    };

    if (editingId) {
      CanteenDB.update(editingId, data);
    } else {
      CanteenDB.add(data);
    }

    hideCanteenForm();
    renderCanteenList();
    // 清除推荐缓存，下次刷新用新数据
    clearRecommendCache();
  }

  function deleteCanteen(id) {
    if (confirm('确定删除这个窗口吗？')) {
      CanteenDB.remove(id);
      renderCanteenList();
      clearRecommendCache();
    }
  }

  function editCanteen(id) {
    var list = CanteenDB.getAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        showCanteenForm(list[i]);
        return;
      }
    }
  }

  function clearRecommendCache() {
    try { localStorage.removeItem('foodie_recommend'); } catch(e) {}
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== 小红书搜索 =====
  function searchXiaohongshu() {
    if (!state.result) return;
    var r = state.result.recommended_restaurant;
    var keyword = r.name;
    // 加上品类和地点提升搜索精度
    if (r.category) keyword += ' ' + r.category;
    if (state.city) keyword += ' ' + state.city;

    var panel = $('xhs-results-panel');
    var loading = $('xhs-loading');
    var list = $('xhs-results-list');
    var openBtn = $('xhs-open-app-btn');

    // 显示面板和加载状态
    panel.classList.remove('hidden');
    loading.classList.remove('hidden');
    list.innerHTML = '';
    openBtn.style.display = 'none';

    // 调用服务器搜索端点
    fetch('/api/xhs-search?q=' + encodeURIComponent(keyword))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        loading.classList.add('hidden');
        renderXhsResults(data.results || []);
        // 显示"在小红书App中查看更多"按钮
        openBtn.style.display = 'block';
        openBtn.onclick = function() {
          window.open('https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(keyword), '_blank');
        };
      })
      .catch(function() {
        loading.classList.add('hidden');
        // 搜索失败，给回退链接
        renderXhsResults([{
          title: '在小红书搜索「' + keyword + '」',
          url: 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(keyword),
          desc: '点击直接在小红书 App/网页中搜索',
          noteId: null,
        }]);
        openBtn.style.display = 'block';
        openBtn.onclick = function() {
          window.open('https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(keyword), '_blank');
        };
      });
  }

  function renderXhsResults(results) {
    var list = $('xhs-results-list');
    if (!results || results.length === 0) {
      list.innerHTML = '<div class="xhs-results-empty">暂无相关笔记，试试在小红书 App 中搜索</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      html += '<a class="xhs-result-item" href="' + item.url + '" target="_blank" rel="noopener">' +
        '<div class="xhs-result-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="xhs-result-desc">' + escapeHtml(item.desc) + '</div>' +
        '<div class="xhs-result-source">📕 来自小红书</div>' +
      '</a>';
    }
    list.innerHTML = html;
  }

  function closeXhsResults() {
    $('xhs-results-panel').classList.add('hidden');
  }

  // ===== 事件绑定 =====

  // 小红书搜索
  $('xhs-search-btn').addEventListener('click', function() {
    searchXiaohongshu();
  });
  $('xhs-close-btn').addEventListener('click', function() {
    closeXhsResults();
  });
  $('refresh-btn').addEventListener('click', function() {
    clearRecommendCache();
    loadRecommendation(true);
  });

  $('retry-btn').addEventListener('click', function() {
    loadRecommendation(true);
  });

  $('toggle-alt-btn').addEventListener('click', function() {
    var panel = $('alternatives-section');
    var btn = $('toggle-alt-btn');
    if (panel.classList.contains('collapsed')) {
      panel.classList.remove('collapsed');
      btn.textContent = '收起备选';
    } else {
      panel.classList.add('collapsed');
      btn.textContent = '查看备选';
    }
  });

  // 食堂管理事件
  $('canteen-btn').addEventListener('click', openCanteenModal);
  $('canteen-close').addEventListener('click', closeCanteenModal);
  $('canteen-modal').addEventListener('click', function(e) {
    if (e.target === $('canteen-modal')) closeCanteenModal();
  });

  $('canteen-add-btn').addEventListener('click', function() {
    showCanteenForm(null);
  });

  $('f-cancel').addEventListener('click', hideCanteenForm);
  $('f-save').addEventListener('click', saveCanteenForm);

  $('canteen-export-btn').addEventListener('click', function() {
    CanteenDB.exportJSON();
  });

  $('canteen-import-btn').addEventListener('click', function() {
    $('canteen-import-file').click();
  });

  $('canteen-import-file').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        CanteenDB.importJSON(ev.target.result);
        renderCanteenList();
        clearRecommendCache();
        alert('导入成功！');
      } catch(err) {
        alert('导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('canteen-reset-btn').addEventListener('click', function() {
    if (confirm('确定重置为默认食堂数据？当前自定义数据将丢失。')) {
      CanteenDB.resetToDefault();
      renderCanteenList();
      clearRecommendCache();
    }
  });

  // ===== 启动 =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ===== 暴露 API =====
  window.FoodieApp = {
    refresh: function() { clearRecommendCache(); loadRecommendation(true); },
    getState: function() { return state; },
    editCanteen: editCanteen,
    deleteCanteen: deleteCanteen
  };

})();
