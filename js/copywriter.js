/**
 * copywriter.js — 小红书风格推荐文案生成器（浏览器版）
 * 从小程序云函数移植，100% 复用核心逻辑
 */
(function() {
  var WEATHER_EMOJI = {
    '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️', '中雨': '🌧️',
    '大雨': '⛈️', '雪': '❄️', '雾': '🌫️', '霾': '😷',
  };

  var CATEGORY_EMOJI = {
    '火锅': '🍲', '川菜': '🌶️', '面馆': '🍜', '快餐': '🍱', '日料': '🍣',
    '茶饮': '🧋', '烧烤': '🍖', '小吃': '🍢', '粤菜': '🥟', '轻食': '🥗',
    '甜品': '🍰', '煲汤': '🥘', '粥': '🥣',
  };

  var MOOD_EMOJI = ['😋', '🤤', '😍', '✨', '🔥', '💯', '🎉', '🌟', '🍽️', '💕'];

  var WEATHER_REASONS = {
    rain: [
      '下雨天和{category}最配了，一碗下肚整个人都暖起来',
      '阴雨天就要来点暖乎乎的{category}，治愈力满分',
      '听着雨声吃{category}，简直是雨天的顶级浪漫',
    ],
    hot: [
      '这么热的天，来份清爽的{category}简直救命',
      '高温预警！{category}是夏日续命神器',
      '热到融化？{category}就是你的降温解药',
    ],
    cold: [
      '天冷就要吃{category}，暖胃又暖心',
      '寒风中就缺这一口{category}，幸福感爆棚',
      '冬天和{category}是绝配，吃完浑身暖洋洋',
    ],
    humid: [
      '湿气重的日子，{category}帮你祛湿养生',
      '梅雨季就该来点{category}，整个人都清爽了',
    ],
    dry: [
      '天气干燥，{category}帮你润肺补水',
      '秋燥来袭，{category}是润燥好选择',
    ],
    normal: [
      '今天这天气，太适合来份{category}了',
      '这个天气吃{category}，刚刚好',
    ],
  };

  var SEASONAL_REASONS = {
    spring: '{term}时节，顺应节气来点养肝的{category}',
    summer: '{term}到了，清热解暑就靠这口{category}',
    autumn: '{term}啦，润肺养生的{category}安排上',
    winter: '{term}宜温补，{category}正是时候',
  };

  var TIME_REASONS = {
    breakfast: '元气满满的早晨，从一份{category}开始',
    lunch: '午餐时间到！快速美味的{category}不耽误下午搬砖',
    afternoon: '下午茶时间，{category}续命必备',
    dinner: '结束一天的忙碌，用{category}犒劳自己',
    latenight: '深夜放毒时间，{category}是最好的夜宵',
  };

  var HEALTH_TIPS = {
    rain: ['雨天湿气重，饭后记得来杯姜茶哦', '下雨天注意保暖，吃完别急着出门'],
    hot: ['天气炎热注意防暑，多喝水补充水分', '高温天小心中暑，饭后别立即暴晒'],
    cold: ['天冷注意保暖，热食吃完不要马上吹风', '冬天多喝热水，吃点红枣桂圆补气血'],
    spring: ['春季养肝正当时，少酸多甘身体好', '春困来袭？吃好才有精力'],
    summer: ['夏季宜清淡，少油腻多蔬果', '夏天出汗多，注意补充电解质'],
    autumn: ['秋燥来袭，多喝梨汤银耳羹', '秋季润肺，少吃辛辣多吃白色食物'],
    winter: ['冬天进补，来年打虎', '冬季早睡晚起，顺应自然节律'],
  };

  var ORDER_TIPS_TEMPLATES = [
    '必点{name}的招牌菜，回头客都这么点',
    '推荐试试{name}最受欢迎的{randomTag}',
    '第一次去{name}？从招牌开始准没错',
  ];

  var HASHTAG_POOL = [
    '#今天吃什么', '#美食推荐', '#探店', '#美食日记',
    '#工作日午餐', '#周末吃什么', '#天气好好吃', '#节气美食',
    '#人间烟火', '#治愈美食', '#干饭人', '#深夜食堂',
  ];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickRandomN(arr, n) {
    var shuffled = arr.slice().sort(function() { return Math.random() - 0.5; });
    return shuffled.slice(0, n);
  }

  function generateWeatherReason(weatherType, category) {
    var type = weatherType.isRain ? 'rain'
      : weatherType.isHot ? 'hot'
      : weatherType.isCold ? 'cold'
      : weatherType.isHumid ? 'humid'
      : weatherType.isDry ? 'dry'
      : 'normal';
    var templates = WEATHER_REASONS[type] || WEATHER_REASONS.normal;
    return pickRandom(templates).replace('{category}', category);
  }

  function generateSeasonalReason(timeContext, category) {
    var season = timeContext.season || 'summer';
    var term = timeContext.termName || '';
    var templates = SEASONAL_REASONS[season]
      ? [SEASONAL_REASONS[season]]
      : ['应季美食{category}，现在吃正当时'];
    return pickRandom(templates)
      .replace('{term}', term)
      .replace('{category}', category);
  }

  function generateOverallReason(restaurant, weatherType, timeContext, category) {
    var catEmoji = CATEGORY_EMOJI[category] || '🍽️';
    var name = restaurant.name;
    var rating = restaurant.rating || 4.0;
    var distance = restaurant.distance || 500;
    var price = restaurant.estimated_price || 30;
    var tag = (restaurant.tags && restaurant.tags[0]) || '好吃';
    var weatherDesc = weatherType.description || '舒适';
    var timeDesc = timeContext.timeSlot === 'lunch' ? '午餐' : '晚餐';
    var distanceDesc = distance < 300 ? '就在楼下' : '步行' + Math.ceil(distance / 100) + '分钟';
    return catEmoji + ' ' + weatherDesc + '的' + timeDesc + '，' + distanceDesc + '的「' + name + '」正等着你！'
      + ' ⭐' + rating + ' ¥' + price + ' 「' + tag + '」';
  }

  function generate(chosenResult, context) {
    if (!chosenResult || !chosenResult.chosen) {
      return {
        recommended_restaurant: { name: '附近的美食', distance: 500, category: '综合', estimated_price: 30, rating: 4.0 },
        recommendation_reason: {
          weather_factor: '今天天气不错，该吃饭了',
          seasonal_factor: '应季美食随时享用',
          time_factor: '到饭点了',
          overall: '🍽️ 暂时没有匹配的推荐，试试扩大搜索范围或手动搜索吧！'
        },
        special_tips: { health_tip: '按时吃饭', eating_tip: '试试新店', weather_tip: '' },
        alternative_options: [],
        mood_emoji: '🍽️',
        hashtag: ['#今天吃什么']
      };
    }

    var chosen = chosenResult.chosen;
    var alternatives = chosenResult.alternatives;
    var weatherType = context.weatherType;
    var timeContext = context.timeContext;
    var restaurant = chosen.restaurant;
    var category = restaurant.category;
    var weatherEmoji = WEATHER_EMOJI[weatherType.description] || '';

    var weatherReason = generateWeatherReason(weatherType, category);
    var seasonalReason = generateSeasonalReason(timeContext, category);
    var timeReason = (TIME_REASONS[timeContext.timeSlot] || '到饭点了，{category}在向你招手').replace('{category}', category);
    var overallReason = generateOverallReason(restaurant, weatherType, timeContext, category);

    var allHealthTips = [];
    if (weatherType.isRain) allHealthTips = allHealthTips.concat(HEALTH_TIPS.rain);
    if (weatherType.isHot) allHealthTips = allHealthTips.concat(HEALTH_TIPS.hot);
    if (weatherType.isCold) allHealthTips = allHealthTips.concat(HEALTH_TIPS.cold);
    allHealthTips.push('按时吃饭，细嚼慢咽');

    var orderTipTemplate = pickRandom(ORDER_TIPS_TEMPLATES);
    var tags = restaurant.tags || [];
    var randomTag = tags.length > 0 ? pickRandom(tags) : '招牌菜';
    var orderTip = orderTipTemplate.replace('{name}', restaurant.name).replace('{randomTag}', randomTag);

    var weatherTip = '';
    if (weatherType.isRain) weatherTip = '出门记得带伞 🌂';
    else if (weatherType.isHot) weatherTip = '外面超热，做好防晒 🧴';
    else if (weatherType.isCold) weatherTip = '外面很冷，穿暖和点 🧣';

    var altDescriptions = (alternatives || []).slice(0, 2).map(function(a) {
      return a.name + ' — ' + (a.tags && a.tags[0] ? a.tags[0] : '值得一试');
    });

    var hashtags = pickRandomN(HASHTAG_POOL, 3);

    return {
      recommended_restaurant: {
        id: restaurant.poi_id,
        name: restaurant.name,
        distance: restaurant.distance,
        category: category,
        estimated_price: restaurant.estimated_price || '--',
        rating: restaurant.rating || 4.0,
        image: restaurant.image_url || '',
        tags: restaurant.tags || []
      },
      recommendation_reason: {
        weather_factor: (weatherEmoji ? weatherEmoji + ' ' : '') + weatherReason,
        seasonal_factor: '🎋 ' + seasonalReason,
        time_factor: '🕐 ' + timeReason,
        overall: overallReason
      },
      special_tips: {
        health_tip: pickRandom(allHealthTips),
        eating_tip: orderTip,
        weather_tip: weatherTip
      },
      alternative_options: altDescriptions,
      mood_emoji: pickRandom(MOOD_EMOJI),
      hashtag: hashtags
    };
  }

  window.FoodCopywriter = { generate: generate };
})();
