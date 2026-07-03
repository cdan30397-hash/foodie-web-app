/**
 * solar-term.js — 24节气离线计算（浏览器版）
 * 基于公历日期查表，无需外部 API
 */
(function() {
  var SOLAR_TERMS = [
    { name: '小寒', month: 1,  day: 5  },
    { name: '大寒', month: 1,  day: 20 },
    { name: '立春', month: 2,  day: 4  },
    { name: '雨水', month: 2,  day: 19 },
    { name: '惊蛰', month: 3,  day: 6  },
    { name: '春分', month: 3,  day: 21 },
    { name: '清明', month: 4,  day: 5  },
    { name: '谷雨', month: 4,  day: 20 },
    { name: '立夏', month: 5,  day: 6  },
    { name: '小满', month: 5,  day: 21 },
    { name: '芒种', month: 6,  day: 6  },
    { name: '夏至', month: 6,  day: 21 },
    { name: '小暑', month: 7,  day: 7  },
    { name: '大暑', month: 7,  day: 23 },
    { name: '立秋', month: 8,  day: 7  },
    { name: '处暑', month: 8,  day: 23 },
    { name: '白露', month: 9,  day: 8  },
    { name: '秋分', month: 9,  day: 23 },
    { name: '寒露', month: 10, day: 8  },
    { name: '霜降', month: 10, day: 23 },
    { name: '立冬', month: 11, day: 7  },
    { name: '小雪', month: 11, day: 22 },
    { name: '大雪', month: 12, day: 7  },
    { name: '冬至', month: 12, day: 22 }
  ];

  var SPRING_TERMS = ['立春', '雨水', '惊蛰', '春分', '清明', '谷雨'];
  var SUMMER_TERMS = ['立夏', '小满', '芒种', '夏至', '小暑', '大暑'];
  var AUTUMN_TERMS = ['立秋', '处暑', '白露', '秋分', '寒露', '霜降'];
  var WINTER_TERMS = ['立冬', '小雪', '大雪', '冬至', '小寒', '大寒'];

  var TERM_INFO = {
    '小暑': { season: 'summer', tip: '清热解暑，宜食绿豆、西瓜、苦瓜', emoji: '☀️' },
    '大暑': { season: 'summer', tip: '防暑降温，多饮凉茶、酸梅汤', emoji: '🔥' },
    '立秋': { season: 'autumn', tip: '润肺养阴，宜食梨、百合、莲藕', emoji: '🍂' },
    '冬至': { season: 'winter', tip: '温补养身，宜食羊肉、红枣、桂圆', emoji: '❄️' },
    '立春': { season: 'spring', tip: '养肝护肝，宜食青菜、豆芽、韭菜', emoji: '🌱' },
    '立夏': { season: 'summer', tip: '养心清热，宜食苦瓜、莲子、绿豆', emoji: '🌸' },
  };

  function getSeasonForTerm(termName) {
    if (SPRING_TERMS.indexOf(termName) !== -1) return 'spring';
    if (SUMMER_TERMS.indexOf(termName) !== -1) return 'summer';
    if (AUTUMN_TERMS.indexOf(termName) !== -1) return 'autumn';
    return 'winter';
  }

  function getCurrentSolarTerm(date) {
    date = date || new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    for (var i = SOLAR_TERMS.length - 1; i >= 0; i--) {
      var term = SOLAR_TERMS[i];
      if (month > term.month || (month === term.month && day >= term.day)) {
        var info = TERM_INFO[term.name] || {};
        var season = info.season || getSeasonForTerm(term.name);
        return {
          name: term.name,
          season: season,
          tip: info.tip || '',
          emoji: info.emoji || ({ spring: '🌱', summer: '☀️', autumn: '🍂', winter: '❄️' }[season] || '🌿')
        };
      }
    }
    return { name: '冬至', season: 'winter', tip: '温补养身，宜食羊肉', emoji: '❄️' };
  }

  window.SolarTerm = { getCurrentSolarTerm: getCurrentSolarTerm };
})();
