import { scrapeArea } from '../../lib/scraper'
import { alertListing } from '../../lib/alerts'
import { supabaseAdmin } from '../../lib/supabase'

const BUDGET = {
  tahoma: { min: 3000, max: 5500 },
  venice: { min: 4000, max: 6500 },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const area = req.query.area || 'all'
  const areas = area === 'all' ? ['tahoma', 'venice'] : [area]
  const summary = { areas: {}, errors: [] }

  for (const a of areas) {
    const { data: searchLog } = await supabaseAdmin
      .from('searches').insert({ area: a, source: 'all', status: 'running' }).select().single()

    try {
      const { listings, errors } = await scrapeArea(a)
      summary.areas[a] = { found: listings.length, new: 0, alerted: 0, errors }

      for (const listing of listings) {
  if (listing.external_id === undefined) continue
        const { data: saved, error } = await supabaseAdmin
          .from('listings')
          .upsert(listing, { onConflict: 'source,external_id', ignoreDuplicates: false })
          .select().single()
      if (error) { console.error('Upsert error:', error.message, listing.external_id); continue }
        if (!saved.alerted) {
          summary.areas[a].new++
          const budget = BUDGET[a]
          const price = saved.price_per_month
          if (price && price >= budget.min && price <= budget.max && (!saved.bedrooms || saved.bedrooms >= 2)) {
            await alertListing(saved, supabaseAdmin)
            summary.areas[a].alerted++
          }
        }
      }
      await supabaseAdmin.from('searches').update({ listings_found: summary.areas[a].found, listings_new: summary.areas[a].new, status: 'complete' }).eq('id', searchLog?.id)
    } catch (e) {
      summary.errors.push(`${a}: ${e.message}`)
      await supabaseAdmin.from('searches').update({ status: 'failed' }).eq('id', searchLog?.id)
    }
  }

  return res.status(200).json(summary)
}
