/**
 * server.js — 本地开发服务器
 * 
 * 功能：
 *   1. 提供静态文件服务（HTML/CSS/JS）
 *   2. 代理腾讯地图 API 请求（解决 CORS）
 *   3. 无 API Key 时自动使用演示数据（让 UI 先跑起来）
 * 
 * 用法：
 *   node server.js                    → 演示模式（无需 Key）
 *   TMAP_KEY=你的密钥 node server.js  → 真实数据模式
 * 
 * 然后浏览器打开 http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const TMAP_KEY = process.env.TMAP_KEY || '3HZBZ-BWTCL-G6GP4-M4K65-Q2XMO-U6FQG';
const ROOT_DIR = __dirname;

// ===== MIME 类型 =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ===== 演示数据 =====
const DEMO_RESTAURANTS = {
  '美食': [
    { id: 'demo_1', title: '老四川火锅', category: '火锅', address: '大学路88号', location: { lat: 30.57, lng: 104.07 }, _distance: 280, tel: '028-88888001' },
    { id: 'demo_2', title: '兰州拉面馆', category: '快餐:面馆', address: '学府路12号', location: { lat: 30.57, lng: 104.07 }, _distance: 150, tel: '028-88888002' },
    { id: 'demo_3', title: '鲜之 Ingredients 轻食沙拉', category: '轻食:沙拉', address: '商业街A座', location: { lat: 30.57, lng: 104.07 }, _distance: 420, tel: '028-88888003' },
    { id: 'demo_4', title: '正新鸡排', category: '小吃:炸鸡', address: '东门小吃街', location: { lat: 30.57, lng: 104.07 }, _distance: 350, tel: '028-88888004' },
    { id: 'demo_5', title: '喜茶 HEYTEA', category: '茶饮:奶茶', address: '万达广场1楼', location: { lat: 30.57, lng: 104.07 }, _distance: 680, tel: '028-88888005' },
    { id: 'demo_6', title: '张记煲仔饭', category: '粤菜:煲仔饭', address: '南门美食城', location: { lat: 30.57, lng: 104.07 }, _distance: 520, tel: '028-88888006' },
    { id: 'demo_7', title: '韩式烤肉一手店', category: '烧烤:烤肉', address: '学府路66号', location: { lat: 30.57, lng: 104.07 }, _distance: 750, tel: '028-88888007' },
    { id: 'demo_8', title: '粥底火锅·养生砂锅', category: '煲汤:砂锅', address: '大学路33号', location: { lat: 30.57, lng: 104.07 }, _distance: 190, tel: '028-88888008' },
    { id: 'demo_9', title: '寿司郎日料定食', category: '日料:寿司', address: '商业街B座', location: { lat: 30.57, lng: 104.07 }, _distance: 550, tel: '028-88888009' },
    { id: 'demo_10', title: '深夜烧烤串串香', category: '烧烤:烤串', address: '东门夜市', location: { lat: 30.57, lng: 104.07 }, _distance: 400, tel: '028-88888010' },
    { id: 'demo_11', title: '川妹子麻辣烫', category: '快餐:麻辣烫', address: '学府路8号', location: { lat: 30.57, lng: 104.07 }, _distance: 220, tel: '028-88888011' },
    { id: 'demo_12', title: '甜蜜蜜甜品站', category: '甜品:糖水', address: '商业街C座', location: { lat: 30.57, lng: 104.07 }, _distance: 600, tel: '028-88888012' },
    { id: 'demo_13', title: '一食堂·瓦罐汤窗口', category: '快餐:汤', address: '校内一食堂2楼', location: { lat: 30.57, lng: 104.07 }, _distance: 80, tel: '' },
    { id: 'demo_14', title: '二食堂·麻辣香锅', category: '川菜:干锅', address: '校内二食堂1楼', location: { lat: 30.57, lng: 104.07 }, _distance: 120, tel: '' },
    { id: 'demo_15', title: '三食堂·兰州牛肉面', category: '快餐:面馆', address: '校内三食堂', location: { lat: 30.57, lng: 104.07 }, _distance: 200, tel: '' },
  ],
  '餐厅': [
    { id: 'demo_1', title: '老四川火锅', category: '火锅', address: '大学路88号', location: { lat: 30.57, lng: 104.07 }, _distance: 280, tel: '028-88888001' },
    { id: 'demo_6', title: '张记煲仔饭', category: '粤菜:煲仔饭', address: '南门美食城', location: { lat: 30.57, lng: 104.07 }, _distance: 520, tel: '028-88888006' },
    { id: 'demo_9', title: '寿司郎日料定食', category: '日料:寿司', address: '商业街B座', location: { lat: 30.57, lng: 104.07 }, _distance: 550, tel: '028-88888009' },
  ],
  '快餐': [
    { id: 'demo_2', title: '兰州拉面馆', category: '快餐:面馆', address: '学府路12号', location: { lat: 30.57, lng: 104.07 }, _distance: 150, tel: '028-88888002' },
    { id: 'demo_11', title: '川妹子麻辣烫', category: '快餐:麻辣烫', address: '学府路8号', location: { lat: 30.57, lng: 104.07 }, _distance: 220, tel: '028-88888011' },
    { id: 'demo_15', title: '三食堂·兰州牛肉面', category: '快餐:面馆', address: '校内三食堂', location: { lat: 30.57, lng: 104.07 }, _distance: 200, tel: '' },
  ],
};

const DEMO_WEATHER = {
  status: 0,
  result: {
    update_time: '2026-07-03T10:00:00+08:00',
    realtime: {
      temp: 31,
      humidity: 65,
      weather_str: '多云',
      wind_power: 2,
      feels_like: 34,
    }
  }
};

const DEMO_GEO = {
  status: 0,
  result: {
    address: '四川省成都市某某区大学路1号',
    ad_info: { city: '成都市', district: '某某区' },
    pois: []
  }
};

// ===== 代理腾讯地图 API =====
function proxyTencentMap(apiPath, res) {
  if (!TMAP_KEY) {
    // 演示模式：返回模拟数据
    return serveDemoData(apiPath, res);
  }

  // 真实模式：代理请求
  const fullUrl = `https://apis.map.qq.com${apiPath}&key=${TMAP_KEY}`;
  
  https.get(fullUrl, (apiRes) => {
    let body = '';
    apiRes.on('data', (chunk) => body += chunk);
    apiRes.on('end', () => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.writeHead(apiRes.statusCode || 200);
      res.end(body);
    });
  }).on('error', (err) => {
    console.error('[Proxy Error]', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: -1, message: '代理请求失败: ' + err.message }));
  });
}

function serveDemoData(apiPath, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 天气 API
  if (apiPath.includes('/ws/weather/')) {
    console.log('[Demo] 返回演示天气数据');
    res.writeHead(200);
    res.end(JSON.stringify(DEMO_WEATHER));
    return;
  }

  // 逆地理编码
  if (apiPath.includes('/ws/geocoder/')) {
    console.log('[Demo] 返回演示地理编码数据');
    res.writeHead(200);
    res.end(JSON.stringify(DEMO_GEO));
    return;
  }

  // POI 搜索
  if (apiPath.includes('/ws/place/v1/search')) {
    const parsed = url.parse(apiPath, true);
    const keyword = parsed.query.keyword || '美食';
    const data = DEMO_RESTAURANTS[keyword] || DEMO_RESTAURANTS['美食'];
    console.log('[Demo] 返回演示餐厅数据, keyword=' + keyword + ', count=' + data.length);
    res.writeHead(200);
    res.end(JSON.stringify({ status: 0, data: data, count: data.length }));
    return;
  }

  // 默认
  res.writeHead(404);
  res.end(JSON.stringify({ status: -1, message: '演示模式不支持此 API' }));
}

// ===== 静态文件服务 =====
function serveStatic(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + path.basename(filePath));
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ===== 小红书搜索（Bing 聚合） =====
function searchXiaohongshu(keyword, res) {
  // 用 Bing 搜 "site:xiaohongshu.com 关键词"
  const query = encodeURIComponent(`site:xiaohongshu.com ${keyword}`);
  const searchUrl = `https://www.bing.com/search?q=${query}&count=10&setmkt=zh-CN`;

  https.get(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }
  }, (bingRes) => {
    let body = '';
    bingRes.on('data', (chunk) => body += chunk);
    bingRes.on('end', () => {
      // 从 Bing HTML 中提取搜索结果
      const results = [];
      
      // 匹配 Bing 搜索结果卡片
      const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
      let match;
      
      while ((match = itemRegex.exec(body)) !== null && results.length < 8) {
        const block = match[1];
        
        // 提取标题和链接
        const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        // 提取描述
        const descMatch = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
                       || block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        
        if (titleMatch && titleMatch[1].includes('xiaohongshu.com')) {
          let title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          let link = titleMatch[1];
          let desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
          
          // 清理标题
          title = title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
          desc = desc.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
          
          // 尝试从小红书 URL 提取笔记 ID
          const noteId = link.match(/xiaohongshu\.com\/[^\/]+\/item\/([a-zA-Z0-9]+)/);
          
          results.push({
            title: title || keyword,
            url: link,
            desc: desc || '点击查看小红书笔记',
            noteId: noteId ? noteId[1] : null,
          });
        }
      }
      
      // 如果没找到结果，提供回退搜索链接
      if (results.length === 0) {
        results.push({
          title: `在小红书搜索「${keyword}」`,
          url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`,
          desc: '点击直接在小红书 App/网页中搜索',
          noteId: null,
        });
      }
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, keyword, results }));
    });
  }).on('error', (err) => {
    console.error('[XHS Search Error]', err.message);
    // 出错时返回回退链接
    const fallback = [{
      title: `在小红书搜索「${keyword}」`,
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}`,
      desc: '搜索服务暂时不可用，点击直接打开小红书搜索',
      noteId: null,
    }];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, keyword, results: fallback }));
  });
}

// ===== 主服务器 =====
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // 小红书搜索
  if (pathname === '/api/xhs-search') {
    const keyword = parsed.query.q;
    if (!keyword) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing q parameter' }));
      return;
    }
    searchXiaohongshu(keyword, res);
    return;
  }

  // API 代理
  if (pathname === '/api/proxy') {
    const apiPath = parsed.query.path;
    if (!apiPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing path parameter' }));
      return;
    }
    proxyTencentMap(apiPath, res);
    return;
  }

  // 静态文件
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // 安全检查：防止目录遍历
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback
      filePath = path.join(ROOT_DIR, 'index.html');
    }
    serveStatic(filePath, res);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  🍜 美食推荐网站已启动！');
  console.log('');
  console.log('  ───────────────────────────────────────');
  console.log('  📡 地址: http://localhost:' + PORT);
  console.log('  ───────────────────────────────────────');
  console.log('');
  if (TMAP_KEY) {
    console.log('  ✅ 模式: 真实数据（已配置 TMAP_KEY）');
  } else {
    console.log('  🎮 模式: 演示数据（未配置 TMAP_KEY）');
    console.log('  💡 如需真实数据，请:');
    console.log('     1. 前往 https://lbs.qq.com/ 申请免费 Key');
    console.log('     2. 启动时设置: TMAP_KEY=你的Key node server.js');
  }
  console.log('');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('');
});
