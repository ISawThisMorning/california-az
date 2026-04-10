const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const BASE_URL = 'https://api.apify.com/v2'

const ACTORS = {
  craigslist: 'easyapi/craigslist-search',
  zillow: 'maxcopell/zillow-scraper',
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

const SEARCH_CONFIGS = {
  tahoma: {
    craigslist: {
      site: 'reno',
      query: 'tahoe west shore tahoma furnished house rental',
      category: 'apa',
      maxItems: 20,
    },
  },
  venice: {
    craigslist: {
      site: 'losangeles',
      query: 'venice marina del rey furnished house rental monthly',
      category: 'apa',
      maxItems: 20,
    },
    zillow: {
      searchUrl: 'https://www.zillow.com/venice-los-angeles-ca/rentals/?searchQueryState=%7B%22mapBounds%22%3A%7B%22west%22%3A-118.4985%2C%22east%22%3A-118.4185%2C%22south%22%3A33.9785%2C%22north%22%3A34.0185%7D%7D',
      maxItems: 20,
    },
  },
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

function normalizeZillow(item, area) {
  return {
    source: 'zillow',
    external_id: String(item.zpid || item.id || ''),
    url: item.detailUrl || item.url,
    area,
    title: item.address || item.streetAddress,
    description: item.description,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    price_per_month: item.price ? parseInt(String(item.price).replace(/\D/g, '')) : null,
    price_raw: item.priceLabel || String(item.price),
    city: item.city,
    lat: item.latitude,
    lng: item.longitude,
    raw: item,
  }
}

export async function scrapeArea(area) {
  const config = SEARCH_CONFIGS[area]
  if (!config) throw new Error(`Unknown area: ${area}`)
  const results = []
  const errors = []

  if (config.craigslist) {
    try {
      const { items } = await runActor(ACTORS.craigslist, config.craigslist)
      results.push(...items.map(i => normalizeCraigslist(i, area)))
      console.log(`Craigslist ${area}: ${items.length} listings`)
    } catch (e) { errors.push(`Craigslist: ${e.message}`) }
  }

  if (config.zillow) {
    try {
      const { items } = await runActor(ACTORS.zillow, config.zillow)
      results.push(...items.map(i => normalizeZillow(i, area)))
      console.log(`Zillow ${area}: ${items.length} listings`)
    } catch (e) { errors.push(`Zillow: ${e.message}`) }
  }

  return { listings: results, errors }
}
