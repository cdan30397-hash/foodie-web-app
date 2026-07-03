/**
 * Vercel Serverless Function — 腾讯地图 API 代理
 * 解决浏览器跨域限制，保护 API Key
 *
 * 环境变量: TMAP_KEY（在 Vercel 后台设置）
 */
export default async function handler(req, res) {
  // CORS 预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const apiKey = process.env.TMAP_KEY;
  if (!apiKey) {
    // 无 Key 时返回演示数据提示
    return res.status(200).json({
      status: -1,
      message: 'TMAP_KEY not configured on server. Using demo mode.',
      demo: true,
      result: {
        realtime: { temp: 28, humidity: 60, weather_str: '多云', wind_power: 2, feels_like: 30 },
        update_time: new Date().toISOString()
      }
    });
  }

  const url = `https://apis.map.qq.com${path}&key=${apiKey}`;

  try {
    const response = await fetch(url, {
      headers: { 'Referer': 'https://foodie-app.vercel.app' }
    });

    res.setHeader('Cache-Control', 'public, max-age=300');

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API error', detail: err.message });
  }
}
