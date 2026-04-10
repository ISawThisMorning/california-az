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
            <button key={a} onClick={() => setArea(a)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: area === a ? '#111' : '#eee',
              color: area === a ? '#fff' : '#333',
              cursor: 'pointer', fontWeight: 500,
            }}>
              {a === 'all' ? 'All' : `${a.charAt(0).toUpperCase() + a.slice(1)}${BUDGETS[a] ? ` · ${BUDGETS[a]}` : ''}`}
            </button>
          ))}
        </div>
        <button onClick={runScrape} disabled={scraping} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: scraping ? '#ccc' : '#2563eb', color: '#fff',
          cursor: scraping ? 'not-allowed' : 'pointer', fontWeight: 600, marginLeft: 'auto',
        }}>
          {scraping ? 'Scraping...' : '🔍 Run Scrape'}
        </button>
      </div>

      {lastRun && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 14 }}>
          {Object.entries(lastRun.areas || {}).map(([a, s]) =>
            `${a}: ${s.found} found, ${s.new} new, ${s.alerted} alerted`
          ).join(' · ')}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#999' }}>Loading...</p>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <p style={{ fontSize: 18 }}>No listings yet</p>
          <p>Hit "Run Scrape" to pull current rentals</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {listings.map(l => (
            <div key={l.id} style={{
              border: '1px solid #e5e7eb', borderRadius: 12, padding: 20,
              display: 'flex', gap: 16, background: l.starred ? '#fffbeb' : '#fff',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, background: { airbnb: '#ff385c', vrbo: '#3D6EF6', craigslist: '#7c3aed' }[l.source] || '#999', color: '#fff'
