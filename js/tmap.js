/**
 * tmap.js — 腾讯地图 API 浏览器封装
 * 通过 Vercel Serverless Function 代理调用，API Key 不暴露给前端
 */

var TMAP = (function() {

  function apiGet(path) {
    return fetch('/api/proxy?path=' + encodeURIComponent(path))
      .then(function(res) {
        if (!res.ok) throw new Error('API 请求失败: ' + res.status);
        return res.json();
      })
      .then(function(json) {
        if (json.status === 0) return json;
        throw new Error('腾讯地图 API 错误: ' + (json.message || json.status));
      });
  }

  function getWeather(_a) {
    var lat = _a.lat, lng = _a.lng;
    return apiGet('/ws/weather/v1/?location=' + lat + ',' + lng + '&get_poi=0')
      .then(function(result) {
        // 兼容两种格式：真实 API (realtime 是数组) 和演示数据 (realtime 是对象)
        var rt = result.result && result.result.realtime;
        if (!rt) throw new Error('天气数据不可用');

        var info, updateTime;
        if (Array.isArray(rt)) {
          // 真实 API 格式: result.realtime[0].infos.{weather, temperature, humidity, ...}
          var item = rt[0];
          if (!item) throw new Error('天气数据不可用');
          info = item.infos || {};
          updateTime = item.update_time || '';
        } else {
          // 演示数据格式: result.realtime.{temp, humidity, weather_str, ...}
          info = {
            weather: rt.weather_str,
            temperature: rt.temp,
            humidity: rt.humidity,
            wind_power: rt.wind_power,
            feels_like: rt.feels_like
          };
          updateTime = result.result.update_time || '';
        }

        return {
          temperature: info.temperature != null ? info.temperature : 25,
          humidity: info.humidity != null ? info.humidity : 50,
          weather: info.weather || '晴',
          wind: info.wind_power || 2,
          feelsLike: info.feels_like || info.temperature || 25,
          updateTime: updateTime
        };
      });
  }

  function searchNearby(_a) {
    var keyword = _a.keyword, location = _a.location, radius = _a.radius;
    if (radius === void 0) radius = 1000;
    var path = '/ws/place/v1/search?keyword=' + encodeURIComponent(keyword)
      + '&boundary=nearby(' + location.lat + ',' + location.lng + ',' + radius + ')'
      + '&page_size=20&orderby=_distance';
    return apiGet(path)
      .then(function(result) {
        if (!result.data || !Array.isArray(result.data)) return [];
        return result.data.map(formatPOI);
      });
  }

  function reverseGeocoder(_a) {
    var lat = _a.lat, lng = _a.lng;
    return apiGet('/ws/geocoder/v1/?location=' + lat + ',' + lng + '&get_poi=1')
      .then(function(result) {
        var r = result.result || {};
        var adInfo = r.ad_info || {};
        return {
          address: r.address || '',
          city: adInfo.city || adInfo.district || '',
          district: adInfo.district || '',
          nearby_pois: (r.pois || []).slice(0, 5)
        };
      });
  }

  function formatPOI(poi) {
    return {
      poi_id: poi.id,
      name: poi.title,
      category: poi.category || '美食',
      address: poi.address || '',
      location: {
        lat: poi.location.lat,
        lng: poi.location.lng
      },
      distance: poi._distance || 0,
      rating: estimateRating(poi),
      estimated_price: estimatePrice(poi),
      tags: extractTags(poi),
      image_url: '',
      phone: poi.tel || '',
      has_bad_reviews: false
    };
  }

  function estimateRating(poi) {
    if (poi._distance !== undefined && poi.title) return 4.0;
    return 3.8;
  }

  function estimatePrice(poi) {
    var expensiveCats = ['火锅', '日料', '烤肉', '海鲜'];
    var midCats = ['川菜', '粤菜', '西餐'];
    var cheapCats = ['快餐', '小吃', '面馆', '奶茶'];
    var title = poi.title || '';
    if (expensiveCats.some(function(c) { return title.indexOf(c) !== -1; })) return 100;
    if (midCats.some(function(c) { return title.indexOf(c) !== -1; })) return 50;
    if (cheapCats.some(function(c) { return title.indexOf(c) !== -1; })) return 20;
    return 30;
  }

  function extractTags(poi) {
    var tags = [];
    if (poi.category) tags.push(poi.category);
    if (poi._distance < 300) tags.push('超近');
    return tags.slice(0, 4);
  }

  return {
    getWeather: getWeather,
    searchNearby: searchNearby,
    reverseGeocoder: reverseGeocoder
  };

})();
