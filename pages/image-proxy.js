export default async function handler(req, res) {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'No URL' })
  
  const response = await fetch(decodeURIComponent(url), {
    headers: {
      'Referer': 'https://www.zillow.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  })
  
  if (!response.ok) return res.status(404).json({ error: 'Image not found' })
  
  const buffer = await response.arrayBuffer()
  res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(Buffer.from(buffer))
}
