export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const apiKey = process.env.TMAP_KEY;
  if (!apiKey) {
    return res.status(200).json({
      status: 311,
      message: 'TMAP_KEY 未配置，使用演示数据',
      result: { realtime: { temp: 28, humidity: 60, weather_str: '多云' } }
    });
  }

  try {
    const url = `https://apis.map.qq.com${path}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({
      status: 310,
      message: 'API 请求失败: ' + err.message,
      result: { realtime: { temp: 28, humidity: 60, weather_str: '多云' } }
    });
  }
}
