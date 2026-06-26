// YouTube Data API v3 へのプロキシ関数（APIキーをクライアントに公開しない）
exports.handler = async (event) => {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  const { action, q, ids } = event.queryStringParameters || {};
  const headers = { 'Content-Type': 'application/json' };

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'YOUTUBE_API_KEY が環境変数に設定されていません' })
    };
  }

  try {
    // チャンネル検索 + 登録者数取得
    if (action === 'search' && q) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=10&q=${encodeURIComponent(q)}&key=${API_KEY}`;
      const searchRes  = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error.message);

      const channels = (searchData.items || []).map(item => ({
        id:          item.id.channelId,
        title:       item.snippet.channelTitle,
        description: item.snippet.description || '',
        thumbnail:   item.snippet.thumbnails?.default?.url || ''
      }));

      // 登録者数を一括取得
      if (channels.length > 0) {
        const channelIds = channels.map(c => c.id).join(',');
        const statsUrl   = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${API_KEY}`;
        const statsRes   = await fetch(statsUrl);
        const statsData  = await statsRes.json();
        (statsData.items || []).forEach(item => {
          const ch = channels.find(c => c.id === item.id);
          if (ch) {
            ch.subscribers = item.statistics.hiddenSubscriberCount
              ? null
              : Number(item.statistics.subscriberCount || 0);
          }
        });
      }

      return { statusCode: 200, headers, body: JSON.stringify(channels) };
    }

    // 登録者数の一括更新
    if (action === 'stats' && ids) {
      const url  = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(ids)}&key=${API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const stats = (data.items || []).map(item => ({
        id:          item.id,
        subscribers: item.statistics.hiddenSubscriberCount
          ? null
          : Number(item.statistics.subscriberCount || 0)
      }));

      return { statusCode: 200, headers, body: JSON.stringify(stats) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: '不正なリクエスト' }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
