/**
 * canteen.js — 校园食堂自定义数据库（localStorage）
 *
 * 功能：
 *   - 增删改查食堂窗口数据
 *   - 与腾讯地图 POI 数据合并参与推荐
 *   - 支持导出/导入 JSON（换设备不丢数据）
 *
 * 数据格式：
 *   {
 *     id: 'canteen_1',
 *     name: '一食堂·瓦罐汤窗口',
 *     canteen: '一食堂',        // 所在食堂
 *     floor: '2楼',             // 楼层
 *     category: '煲汤',          // 品类（火锅/面馆/快餐/粥/...）
 *     distance: 80,             // 距离（米，手动填写）
 *     price: 15,                // 人均价格
 *     rating: 4.5,              // 评分 1-5
 *     mustTry: '瓦罐鸡汤',       // 必点菜
 *     tags: ['校内', '热乎'],
 *     source: 'canteen'
 *   }
 */

var CanteenDB = (function() {
  'use strict';

  var STORAGE_KEY = 'foodie_canteen_list';

  // 默认示例数据（首次使用时自动加载）
  var DEFAULT_DATA = [
    {
      id: 'canteen_seed_1',
      name: '一食堂·瓦罐汤窗口',
      canteen: '一食堂',
      floor: '2楼',
      category: '煲汤',
      distance: 80,
      price: 15,
      rating: 4.5,
      mustTry: '瓦罐鸡汤、瓦罐排骨',
      tags: ['校内', '热乎', '养生'],
      source: 'canteen'
    },
    {
      id: 'canteen_seed_2',
      name: '二食堂·麻辣香锅',
      canteen: '二食堂',
      floor: '1楼',
      category: '川菜',
      distance: 120,
      price: 22,
      rating: 4.2,
      mustTry: '微辣香锅加宽粉',
      tags: ['校内', '重口'],
      source: 'canteen'
    },
    {
      id: 'canteen_seed_3',
      name: '三食堂·兰州牛肉面',
      canteen: '三食堂',
      floor: '1楼',
      category: '面馆',
      distance: 200,
      price: 14,
      rating: 4.0,
      mustTry: '二细毛细都行',
      tags: ['校内', '快'],
      source: 'canteen'
    }
  ];

  // ===== 读取 =====
  function getAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // 首次使用，写入默认数据
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
        return DEFAULT_DATA.slice();
      }
      return JSON.parse(raw);
    } catch(e) {
      return [];
    }
  }

  // ===== 新增 =====
  function add(item) {
    var list = getAll();
    item.id = 'canteen_' + Date.now();
    item.source = 'canteen';
    if (!item.tags) item.tags = ['校内'];
    if (item.tags.indexOf('校内') === -1) item.tags.unshift('校内');
    list.push(item);
    save(list);
    return item;
  }

  // ===== 修改 =====
  function update(id, updates) {
    var list = getAll();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in updates) {
          if (updates.hasOwnProperty(k)) list[i][k] = updates[k];
        }
        save(list);
        return list[i];
      }
    }
    return null;
  }

  // ===== 删除 =====
  function remove(id) {
    var list = getAll();
    var filtered = list.filter(function(item) { return item.id !== id; });
    save(filtered);
    return list.length !== filtered.length;
  }

  // ===== 清空 =====
  function clearAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ===== 重置为默认 =====
  function resetToDefault() {
    save(DEFAULT_DATA);
    return DEFAULT_DATA.slice();
  }

  // ===== 导出 JSON =====
  function exportJSON() {
    var data = getAll();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'my-canteen-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===== 导入 JSON =====
  function importJSON(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) throw new Error('格式错误：需要数组');
      var validated = data.map(function(item, i) {
        return {
          id: item.id || ('canteen_import_' + i),
          name: item.name || '未命名窗口',
          canteen: item.canteen || '',
          floor: item.floor || '',
          category: item.category || '其他',
          distance: parseInt(item.distance) || 200,
          price: parseInt(item.price) || 20,
          rating: parseFloat(item.rating) || 4.0,
          mustTry: item.mustTry || '',
          tags: item.tags || ['校内'],
          source: 'canteen'
        };
      });
      save(validated);
      return validated;
    } catch(e) {
      throw new Error('导入失败: ' + e.message);
    }
  }

  // ===== 内部保存 =====
  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch(e) {}
  }

  // ===== 转为推荐引擎兼容格式 =====
  function toEngineFormat() {
    return getAll().map(function(item) {
      return {
        poi_id: item.id,
        name: item.name,
        category: item.category,
        address: (item.canteen ? item.canteen + ' ' : '') + (item.floor || ''),
        location: null,
        distance: item.distance || 200,
        rating: item.rating || 4.0,
        estimated_price: item.price || 20,
        tags: item.tags || ['校内'],
        image_url: '',
        phone: '',
        has_bad_reviews: false,
        source: 'canteen',
        mustTry: item.mustTry || ''
      };
    });
  }

  return {
    getAll: getAll,
    add: add,
    update: update,
    remove: remove,
    clearAll: clearAll,
    resetToDefault: resetToDefault,
    exportJSON: exportJSON,
    importJSON: importJSON,
    toEngineFormat: toEngineFormat
  };

})();
