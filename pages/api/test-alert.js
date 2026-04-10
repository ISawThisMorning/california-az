import { sendTestAlert } from '../../lib/alerts'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const results = await sendTestAlert()
    return res.status(200).json({ success: true, results })
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message })
  }
}
