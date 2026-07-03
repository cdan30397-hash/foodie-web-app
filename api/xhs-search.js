/**
 * Vercel Serverless Function — 小红书搜索聚合
 * 通过 Bing 搜索引擎查找被索引的小红书笔记
 */
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  const query = encodeURIComponent(`site:xiaohongshu.com ${q}`);
  const searchUrl = `https://www.bing.com/search?q=${query}&count=10&setmkt=zh-CN`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      }
    });

    const body = await response.text();
    const results = [];

    // 匹配 Bing 搜索结果卡片
    const itemRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;

    while ((match = itemRegex.exec(body)) !== null && results.length < 8) {
      const block = match[1];

      const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const descMatch = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
                     || block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

      if (titleMatch && titleMatch[1].includes('xiaohongshu.com')) {
        let title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
        let link = titleMatch[1];
        let desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        title = title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
        desc = desc.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

        results.push({ title: title || q, url: link, desc: desc || '点击查看小红书笔记' });
      }
    }

    // 没找到结果时给回退链接
    if (results.length === 0) {
      results.push({
        title: `在小红书搜索「${q}」`,
        url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`,
        desc: '点击直接在小红书 App/网页中搜索',
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json({ success: true, keyword: q, results });
  } catch (err) {
    // 出错时返回回退链接
    const fallback = [{
      title: `在小红书搜索「${q}」`,
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`,
      desc: '搜索服务暂时不可用，点击直接打开小红书搜索',
    }];
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, keyword: q, results: fallback });
  }
}
