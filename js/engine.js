/**
 * engine.js — 五维权重推荐引擎（浏览器版）
 * 从小程序云函数移植，100% 复用核心逻辑
 * 仅将 module.exports 改为全局对象挂载
 */
(function() {
  const CATEGORY_MAP = {
    '火锅': ['火锅', '涮肉', '串串', '麻辣烫', '冒菜'],
    '川菜': ['川菜', '麻辣', '水煮', '回锅肉', '干锅'],
    '面馆': ['面', '拉面', '刀削面', '拌面', '汤面', '粉'],
    '快餐': ['快餐', '盒饭', '盖饭', '自选', '便当'],
    '日料': ['日料', '寿司', '刺身', '鳗鱼饭', '定食'],
    '茶饮': ['奶茶', '咖啡', '果茶', '柠檬茶', '冰沙'],
    '烧烤': ['烧烤', '烤肉', '烤串', 'BBQ', '烤鱼'],
    '小吃': ['小吃', '炸鸡', '臭豆腐', '煎饼', '肉夹馍'],
    '粤菜': ['粤菜', '早茶', '烧腊', '煲仔饭', '茶餐厅'],
    '轻食': ['沙拉', '轻食', '三明治', '健康餐', '素食'],
    '甜品': ['甜品', '蛋糕', '冰淇淋', '糖水', '冰粉'],
    '煲汤': ['煲汤', '炖品', '砂锅', '药膳', '汤'],
    '粥': ['粥', '稀饭', '白粥', '皮蛋瘦肉粥'],
  };

  const WEATHER_SCORES = {
    rain: { '火锅': 10, '面馆': 8, '煲汤': 6, '粥': 6 },
    hot:  { '轻食': 9, '茶饮': 8, '日料': 6 },
    cold: { '火锅': 10, '煲汤': 9, '烤肉': 8, '粥': 7 },
    humid: { '粥': 8, '煲汤': 7, '茶饮': 6 },
    dry: { '煲汤': 8, '甜品': 7, '粤菜': 6, '茶饮': 6 },
  };

  const SEASONAL_SCORES = {
    spring: { '轻食': 8, '粤菜': 5, '面馆': 4 },
    summer: { '茶饮': 9, '轻食': 7, '甜品': 7 },
    autumn: { '煲汤': 8, '粤菜': 6, '粥': 6 },
    winter: { '火锅': 8, '烤肉': 7, '煲汤': 7 },
  };

  const TIME_SCORES = {
    breakfast: { '面馆': 9, '粥': 9, '小吃': 7 },
    lunch:     { '快餐': 8, '面馆': 7, '川菜': 6 },
    afternoon: { '茶饮': 8, '甜品': 8, '小吃': 6 },
    dinner:    { '川菜': 7, '火锅': 6, '日料': 6 },
    latenight: { '烧烤': 9, '小吃': 8, '火锅': 5, '面馆': 4 },
  };

  function getTimeContext(date) {
    date = date || new Date();
    const hour = date.getHours();
    const day = date.getDay();
    const isWeekend = (day === 0 || day === 6);
    let timeSlot = 'lunch';
    if (hour >= 6 && hour < 9)      timeSlot = 'breakfast';
    else if (hour >= 9 && hour < 11) timeSlot = 'morning';
    else if (hour >= 11 && hour < 13) timeSlot = 'lunch';
    else if (hour >= 13 && hour < 17) timeSlot = 'afternoon';
    else if (hour >= 17 && hour < 20) timeSlot = 'dinner';
    else                             timeSlot = 'latenight';
    return {
      hour, day, isWeekend, timeSlot,
      dateStr: (date.getMonth() + 1) + '月' + date.getDate() + '日',
      weekday: ['日', '一', '二', '三', '四', '五', '六'][day]
    };
  }

  function classifyWeather(weather) {
    if (!weather) return { type: 'normal', isRain: false, isHot: false, isCold: false, isHumid: false, isDry: false };
    const temp = weather.temperature;
    const humidity = weather.humidity;
    const desc = weather.weather || '';
    return {
      type: 'normal',
      isRain: /雨|雪|雷|暴/.test(desc),
      isHot: temp > 30,
      isCold: temp < 10,
      isHumid: humidity > 80,
      isDry: humidity < 30,
      temperature: temp,
      humidity: humidity,
      description: desc,
      feelsLike: weather.feelsLike
    };
  }

  function haversineDistance(loc1, loc2) {
    const R = 6371000;
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(loc1.lat * Math.PI / 180)
      * Math.cos(loc2.lat * Math.PI / 180)
      * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function matchCategory(restaurant) {
    const name = (restaurant.name || '') + (restaurant.category || '');
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
      if (keywords.some(function(kw) { return name.indexOf(kw) !== -1; })) return cat;
    }
    return restaurant.category || '其他';
  }

  function getNestedScore(obj, keys) {
    var val = obj;
    for (var i = 0; i < keys.length; i++) {
      if (val == null || typeof val !== 'object') return null;
      val = val[keys[i]];
    }
    return typeof val === 'number' ? val : null;
  }

  function getPenalty(categories, currentCategory) {
    return categories.indexOf(currentCategory) !== -1 ? 5 : 0;
  }

  function scoreWeather(restaurant, weatherType) {
    var score = 5;
    var category = matchCategory(restaurant);
    if (weatherType.isRain) {
      score += getNestedScore(WEATHER_SCORES, ['rain', category]) || 0;
      score -= getPenalty(['沙拉', '冰淇淋', '冷饮'], category);
    }
    if (weatherType.isHot) {
      score += getNestedScore(WEATHER_SCORES, ['hot', category]) || 0;
      score -= getPenalty(['火锅', '烤肉', '麻辣烫'], category);
    }
    if (weatherType.isCold) {
      score += getNestedScore(WEATHER_SCORES, ['cold', category]) || 0;
      score -= getPenalty(['沙拉', '冰淇淋', '冷饮'], category);
    }
    if (weatherType.isHumid) {
      score += getNestedScore(WEATHER_SCORES, ['humid', category]) || 0;
    }
    if (weatherType.isDry) {
      score += getNestedScore(WEATHER_SCORES, ['dry', category]) || 0;
    }
    return Math.max(0, Math.min(10, score));
  }

  function scoreSeasonal(restaurant, season) {
    var score = 5;
    var category = matchCategory(restaurant);
    score += getNestedScore(SEASONAL_SCORES, [season, category]) || 0;
    if ((restaurant.tags || []).some(function(t) { return /时令|应季|当季/.test(t); })) {
      score += 3;
    }
    return Math.max(0, Math.min(10, score));
  }

  function scoreDateType(restaurant, timeContext) {
    var score = 5;
    var category = matchCategory(restaurant);
    if (timeContext.isWeekend) {
      if (restaurant.rating >= 4.5) score += 3;
      if ((restaurant.tags || []).some(function(t) { return /网红|人气|推荐|招牌/.test(t); })) score += 3;
    } else {
      if (['快餐', '面馆', '小吃'].indexOf(category) !== -1) score += 3;
    }
    if (timeContext.timeSlot === 'lunch') {
      if (['快餐', '面馆'].indexOf(category) !== -1) score += 2;
    }
    return Math.max(0, Math.min(10, score));
  }

  function scoreDistance(restaurant, userLocation, weatherType) {
    var dist = restaurant.distance || haversineDistance(userLocation, restaurant.location || restaurant);
    var score = 0;
    if (dist <= 200) score = 10;
    else if (dist <= 500) score = 8;
    else if (dist <= 800) score = 5;
    else if (dist <= 1000) score = 3;
    else if (dist <= 2000) score = 1;
    else score = 0;
    if (weatherType.isRain) {
      if (dist <= 300) score = Math.min(10, score + 2);
      if (dist > 800) score = Math.max(0, score - 2);
    }
    if (restaurant.rating >= 4.5 && dist > 500) score += 1;
    if (restaurant.rating >= 4.8 && dist > 800) score += 2;
    return Math.max(0, Math.min(10, score));
  }

  function scoreTimeOfDay(restaurant, timeContext) {
    var score = 5;
    var category = matchCategory(restaurant);
    score += getNestedScore(TIME_SCORES, [timeContext.timeSlot, category]) || 0;
    return Math.max(0, Math.min(10, score));
  }

  function isInRecentHistory(restaurant, history) {
    if (!history || history.length === 0) return false;
    var category = matchCategory(restaurant);
    return history.some(function(h) { return h.category === category; });
  }

  function matchesPreferences(restaurant, preferences) {
    if (!preferences) return true;
    var category = matchCategory(restaurant);
    if (preferences.budget && restaurant.estimated_price) {
      if (restaurant.estimated_price < preferences.budget.min) return false;
      if (restaurant.estimated_price > preferences.budget.max) return false;
    }
    if (preferences.disliked_restaurants && preferences.disliked_restaurants.indexOf(restaurant.poi_id) !== -1) {
      return false;
    }
    return true;
  }

  function run(restaurants, context, config) {
    var weatherType = context.weatherType;
    var timeContext = context.timeContext;
    var history = context.history;
    var preferences = context.preferences;
    var userLocation = context.userLocation;
    var weights = config.WEIGHTS;
    var minRating = config.MIN_RATING;
    var topK = config.TOP_K;

    var candidates = restaurants
      .filter(function(r) { return (r.rating || 3) >= minRating; })
      .filter(function(r) { return !r.has_bad_reviews; })
      .filter(function(r) { return !isInRecentHistory(r, history); })
      .filter(function(r) { return matchesPreferences(r, preferences); });

    var scored = candidates.map(function(restaurant) {
      var scores = {
        weather: scoreWeather(restaurant, weatherType),
        seasonal: scoreSeasonal(restaurant, timeContext.season || 'summer'),
        dateType: scoreDateType(restaurant, timeContext),
        distance: scoreDistance(restaurant, userLocation, weatherType),
        timeOfDay: scoreTimeOfDay(restaurant, timeContext)
      };
      var total = 0;
      var keys = Object.keys(weights);
      for (var i = 0; i < keys.length; i++) {
        total += scores[keys[i]] * weights[keys[i]];
      }
      return {
        restaurant: Object.assign({}, restaurant, {
          category: matchCategory(restaurant),
          distance: restaurant.distance || Math.round(haversineDistance(userLocation, restaurant.location || restaurant))
        }),
        scores: scores,
        total: parseFloat(total.toFixed(2))
      };
    });

    scored.sort(function(a, b) { return b.total - a.total; });
    var topBatch = scored.slice(0, topK);

    if (topBatch.length === 0) {
      return { chosen: null, alternatives: [], context: { weatherType: weatherType, timeContext: timeContext, season: timeContext.season || 'summer' } };
    }

    // 如果 topBatch 只有1个，直接返回；否则随机选
var chosenIndex = topBatch.length === 1 ? 0 : Math.floor(Math.random() * topBatch.length);
// 再加一个随机偏移，避免始终推荐同一个
if (topBatch.length >= 3) {
  var hour = new Date().getHours();
  var offset = hour % topBatch.length;
  chosenIndex = (chosenIndex + offset) % topBatch.length;
}

    var chosen = topBatch[chosenIndex];
    var alternatives = [];
    for (var i = 0; i < topBatch.length; i++) {
      if (i !== chosenIndex) alternatives.push(topBatch[i].restaurant);
    }

    return {
      chosen: chosen,
      alternatives: alternatives,
      context: {
        weatherType: weatherType,
        timeContext: timeContext,
        season: timeContext.season || 'summer'
      },
      generatedAt: new Date().toISOString()
    };
  }

  window.FoodEngine = {
    run: run,
    getTimeContext: getTimeContext,
    classifyWeather: classifyWeather,
    matchCategory: matchCategory,
    WEATHER_SCORES: WEATHER_SCORES,
    SEASONAL_SCORES: SEASONAL_SCORES,
    TIME_SCORES: TIME_SCORES
  };
})();
