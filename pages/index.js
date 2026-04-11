import { useState, useEffect } from 'react'

const BUDGETS = { tahoma: '$5,000–5,500/mo', venice: '$6,000–6,500/mo' }

export default function Home() {
  const [listings, setListings] = useState([])
  const [area, setArea] = useState('all')
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [lastRun, setLastRun] = useState(null)

  async function fetchListings() {
    setLoading(true)
    const res = await fetch(`/api/listings?area=${area}`)
    const data = await res.json()
    setListings(data.listings || [])
    setLoading(false)
  }

  async function runScrape() {
    setScraping(true)
    const res = await fetch(`/api/scrape?area=${area}`, { method: 'POST' })
    const data = await res.json()
    setLastRun(data)
    setScraping(false)
    fetchListings()
  }

  async function toggleStar(id, current) {
    await fetch('/api/star', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, starred: !current }),
    })
    fetchListings()
  }

  useEffect(() => { fetchListings() }, [area])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>California A-Z</h1>
        <p style={{ color: '#666', marginTop: 4 }}>The A-Z for tasteful nomads · Move-in May 29</p>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'tahoma', 'venice'].map(a => (
            <button key={a} onClick={() => setArea(a)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: area === a ? '#111' : '#eee', color: area === a ? '#fff' : '#333', cursor: 'pointer', fontWeight: 500 }}>
              {a === 'all' ? 'All' : `${a.charAt(0).toUpperCase() + a.slice(1)} · ${BUDGETS[a]}`}
            </button>
          ))}
        </div>
        <button onClick={runScrape} disabled={scraping} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: scraping ? '#ccc' : '#2563eb', color: '#fff', cursor: scraping ? 'not-allowed' : 'pointer', fontWeight: 600, marginLeft: 'auto' }}>
          {scraping ? 'Scraping...' : 'Run Scrape'}
        </button>
      </div>
      {lastRun && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14 }}>
          {Object.entries(lastRun.areas || {}).map(([a, s]) => `${a}: ${s.found} found, ${s.new} new, ${s.alerted} alerted`).join(' · ')}
        </div>
      )}
      {loading ? (
        <p style={{ color: '#999' }}>Loading...</p>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <p style={{ fontSize: 18 }}>No listings yet</p>
          <p>Hit Run Scrape to pull current rentals</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {listings.map(l => (
            <div key={l.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: l.starred ? '#fffbeb' : '#fff' }}>
              {l.thumbnail && (
                <img
                  src={`/api/image-proxy?url=${encodeURIComponent(l.thumbnail)}`}
                  alt={l.title}
                  style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                />
              )}
              <div style={{ padding: 20, display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, background: { airbnb: '#ff385c', vrbo: '#3D6EF6', craigslist: '#7c3aed', zillow: '#006aff' }[l.source] || '#999', color: '#fff', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{l.source}</span>
                    <span style={{ fontSize: 11, color: '#999', textTransform: 'capitalize' }}>{l.area}</span>
                    {l.alerted && <span style={{ fontSize: 11, color: '#16a34a' }}>Alerted</span>}
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'none' }}>{l.title || 'Untitled listing'}</a>
                  </h3>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                    {[l.bedrooms && `${l.bedrooms} bed`, l.bathrooms && `${l.bathrooms} bath`, l.city].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{l.price_per_month ? `$${l.price_per_month.toLocaleString()}/mo` : l.price_raw || 'Price TBC'}</div>
                </div>
                <button onClick={() => toggleStar(l.id, l.starred)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>
                  {l.starred ? '⭐' : '☆'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
