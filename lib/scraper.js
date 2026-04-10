const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const BASE_URL = 'https://api.apify.com/v2'

const ACTORS = {
  airbnb: 'tri_angle/airbnb-scraper',
  vrbo: 'jupri/vrbo-property',
  craigslist: 'easyapi/craigslist-search',
}

function getDateString(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

const SEARCH_CONFIGS = {
  tahoma: {
    airbnb: {
      startUrls: [{ url: 'https://www.airbnb.com/s/Tahoma--CA/homes?checkin=2026-05-29&checkout=2026-08-30&adults=2&monthly_start_date=2026-05-01&monthly_length=3' }],
      currency: 'USD',
      locale: 'en-US',
      enrichUserProfiles: false,
      maxItems: 20,
    },
    craigslist: { site: 'reno', query: 'tahoma tahoe west shore house rental', category: 'apa' },
  },
  venice: {
    airbnb: {
      startUrls: [{ url: 'https://www.airbnb.com/s/Venice-Beach--CA/homes?checkin=2026-05-29&checkout=2026-08-30&adults=2&monthly_start_date=2026-05-01&monthly_length=3' }],
      currency: 'USD',
      locale: 'en-US',
      enrichUserProfiles: false,
      maxItems: 20,
    },
    craigslist: { site: 'losangeles', query: 'venice marina del rey house rental furnished', category: 'apa' },
  },
}

async function runActor(actorId, input) {
  const runUrl = `${BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}&waitForFinish=60`
  const response = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Apify actor ${actorId} failed: ${await response.text()}`)
  const run = await response.json()
  const datasetId = run.data?.defaultDatasetId
  if (!datasetId) throw new Error('No dataset ID returned from Apify')
  const resultsRes = await fetch(`${BASE_URL}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`)
  const items = await resultsRes.json()
  return { runId: run.data?.id, items }
}

function normalizeAirbnb(item, area) {
  // Extract nightly rate from "X nights x $NNN.NN" string
  let nightlyPrice = null
  const baseDesc = item.price?.breakDown?.basePrice?.description || ''
  const match = baseDesc.match(/\$([0-9,]+\.?\d*)/)
  if (match) {
    nightlyPrice = parseFloat(match[1].replace(',', ''))
  }
  // Fallback: parse total price and divide by nights
  if (!nightlyPrice && item.price?.price) {
    const totalStr = item.price.price.replace(/[^0-9.]/g, '')
    const total = parseFloat(totalStr)
    const nightsMatch = baseDesc.match(/(\d+)\s+nights?/)
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : 5
    if (total && nights) nightlyPrice = total / nights
  }

  const monthlyPrice = nightlyPrice ? Math.round(nightlyPrice * 30) : null

  return {
    source: 'airbnb',
    external_id: String(item.id || ''),
    url: item.url || `https://airbnb.com/rooms/${item.id}`,
    area,
    title: item.title,
    description: item.description,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    max_guests: item.personCapacity,
    property_type: item.propertyType,
    price_per_night: nightlyPrice,
    price_per_month: monthlyPrice,
    price_raw: monthlyPrice ? `$${monthlyPrice.toLocaleString()}/mo` : item.price?.label,
    lat: item.coordinates?.lat,
    lng: item.coordinates?.lng,
    city: item.location?.city,
    thumbnail: item.thumbnail,
    raw: item,
  }
}

function normalizeVrbo(item, area) {
  const nightlyPrice = item.pricePerNight || null
  return {
    source: 'vrbo',
    external_id: String(item.id || ''),
    url: item.detailPageUrl || item.url,
    area,
    title: item.headline || item.name,
    description: item.description,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    max_guests: item.sleeps,
    property_type: item.propertyType,
    price_per_night: nightlyPrice,
    price_per_month: nightlyPrice ? Math.round(nightlyPrice * 30 * 0.85) : null,
    price_raw: String(nightlyPrice),
    lat: item.lat,
    lng: item.lng,
    city: item.city,
    raw: item,
  }
}

function normalizeCraigslist(item, area) {
  return {
    source: 'craigslist',
    external_id: String(item.id || item.postId || ''),
    url: item.url || item.link,
    area,
    title: item.title,
    description: item.body,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    price_per_month: item.price ? parseInt(item.price.replace(/\D/g, '')) : null,
    price_raw: item.price,
    city: item.location,
    raw: item,
  }
}

export async function scrapeArea(area) {
  const config = SEARCH_CONFIGS[area]
  if (!config) throw new Error(`Unknown area: ${area}`)
  const results = []
  const errors = []

  if (config.airbnb) {
    try {
      const { items } = await runActor(ACTORS.airbnb, config.airbnb)
      results.push(...items.map(i => normalizeAirbnb(i, area)))
    } catch (e) { errors.push(`Airbnb: ${e.message}`) }
  }

  if (config.vrbo) {
    try {
      const { items } = await runActor(ACTORS.vrbo, config.vrbo)
      results.push(...items.map(i => normalizeVrbo(i, area)))
    } catch (e) { errors.push(`VRBO: ${e.message}`) }
  }

  if (config.craigslist) {
    try {
      const { items } = await runActor(ACTORS.craigslist, config.craigslist)
      results.push(...items.map(i => normalizeCraigslist(i, area)))
    } catch (e) { errors.push(`Craigslist: ${e.message}`) }
  }

  return { listings: results, errors }
}
