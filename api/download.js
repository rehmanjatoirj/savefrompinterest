export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter. Please provide a Pinterest video URL.' });
    }

    if (!url.includes('pinterest.com') && !url.includes('pin.it')) {
      return res.status(400).json({ error: 'Invalid URL. Only pinterest.com and pin.it links are supported.' });
    }

    let targetUrl = url;

    // Resolve pin.it short links
    if (url.includes('pin.it')) {
      const resolveRes = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      targetUrl = resolveRes.url;
    }

    // Fetch Pinterest page HTML
    const pageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      }
    });

    const html = await pageRes.text();

    // Extract video URL
    let videoUrl = null;

    const pattern1 = /"v_codec"[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/;
    const pattern2 = /"url"\s*:\s*"(https:[^"]*\.mp4[^"]*)"/;
    const pattern3 = /"url"\s*:\s*"(https:[^"]*\.m3u8[^"]*)"/;

    let match = html.match(pattern1);
    if (!match) match = html.match(pattern2);
    if (!match) match = html.match(pattern3);

    if (match) {
      videoUrl = match[1].replace(/\\\//g, '/').replace(/\\u002F/g, '/');
    }

    if (!videoUrl) {
      return res.status(404).json({ error: 'No video found. Make sure this is a video pin, not an image.' });
    }

    // Extract thumbnail
    let thumbnailUrl = '';
    const thumbMatch = html.match(/"og:image"\s+content="([^"]+)"/);
    if (thumbMatch) {
      thumbnailUrl = thumbMatch[1];
    }

    // Extract title
    let title = 'Pinterest Video';
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      title = titleMatch[1].replace(' | Pinterest', '').trim();
    }

    return res.status(200).json({
      success: true,
      videoUrl,
      thumbnailUrl,
      title
    });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch video. Please try again.' });
  }
}
