import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const { area, starred } = req.query

  let query = supabaseAdmin
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .order('price_per_month', { ascending: true })

  if (area && area !== 'all') query = query.eq('area', area)
  if (starred === 'true') query = query.eq('starred', true)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ listings: data, count: data.length })
}
