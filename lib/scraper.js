const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const BASE_URL = 'https://api.apify.com/v2'

const ACTORS = {
  craigslist: 'easyapi/craigslist-search-results-scraper',
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
      searchUrls: ['https://reno.craigslist.org/search/tahoe-city-ca/hhh?lat=39.1133&lon=-120.0957&query=house%20rental%20tahoma%20tahoe%20west%20shore&search_distance=19'],
      maxItems: 20,
    },
  },
  venice: {
    craigslist: {
      searchUrls: ['https://losangeles.craigslist.org/search/hhh?query=venice%20furnished%20rental%20monthly'],
      maxItems: 20,
    },
    zillow: {
      searchUrls: [{ url: 'https://www.zillow.com/venice-los-angeles-ca/rentals/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A34.02177426226341%2C%22south%22%3A33.966125634618%2C%22east%22%3A-118.41947490441895%2C%22west%22%3A-118.51062709558106%7D%2C%22filterState%22%3A%7B%22fr%22%3A%7B%22value%22%3Atrue%7D%2C%22fsba%22%3A%7B%22value%22%3Afalse%7D%2C%22fsbo%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22cmsn%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%22Venice%2C%20Los%20Angeles%2C%20CA%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A21056%2C%22regionType%22%3A8%7D%5D%7D' }],
    },
  },
}

function normalizeCraigslist(item, area) {
  const post = item.post || item
  const priceStr = post.price || ''
  const priceNum = priceStr ? parseInt(priceStr.replace(/\D/g, '')) : null
  return {
    source: 'craigslist',
    external_id: String(post.postId || ''),
    url: post.postUrl || post.url,
    area,
    title: post.title,
    description: post.description || null,
    bedrooms: null,
    bathrooms: null,
    price_per_month: priceNum,
    price_raw: priceStr,
    city: null,
    thumbnail: post.thumbnailUrl || null,
    raw: item,
  }
}

function normalizeZillow(item, area) {
  const price = item.price ? parseInt(String(item.price).replace(/\D/g, '')) : null
  return {
    source: 'zillow',
    external_id: String(item.zpid || item.id || ''),
    url: item.detailUrl || item.url,
    area,
    title: item.streetAddress || item.address || item.title,
    description: item.description || null,
    bedrooms: item.bedrooms || item.beds || null,
    bathrooms: item.bathrooms || item.baths || null,
    price_per_month: price,
    price_raw: item.price ? String(item.price) : null,
    city: item.city || 'Venice',
    thumbnail: item.imgSrc || item.image || null,
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
