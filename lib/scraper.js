const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const BASE_URL = 'https://api.apify.com/v2'

const ACTORS = {
  craigslist: 'easyapi/craigslist-search-results-scraper',
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
      searchUrls: ['https://reno.craigslist.org/search/tahoe-city-ca/hhh?lat=39.1133&lon=-120.0957&query=house%20rental%20tahoma%20tahoe%20west%20shore&search_distance=19'],
      maxItems: 20,
    },
  },
  venice: {
    craigslist: {
      searchUrls: ['https://losangeles.craigslist.org/search/hhh?query=venice%20furnished%20rental%20monthly'],
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
    description: item.body || item.description,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    price_per_month: item.price ? parseInt(String(item.price).replace(/\D/g, '')) : null,
    price_raw: item.price,
    city: item.location || item.city,
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

  return { listings: results, errors }
}
