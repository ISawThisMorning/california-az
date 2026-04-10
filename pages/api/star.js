import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const { id, starred } = req.body

  const { error } = await supabaseAdmin
    .from('listings')
    .update({ starred })
    .eq('id', id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}
