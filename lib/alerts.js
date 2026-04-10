const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER

const RECIPIENTS = [
  process.env.ALASDAIR_PHONE,
  process.env.ZOE_PHONE,
].filter(Boolean)

function formatListingAlert(listing) {
  const price = listing.price_per_month
    ? `$${listing.price_per_month.toLocaleString()}/mo`
    : listing.price_raw || 'Price TBC'
  const beds = listing.bedrooms ? `${listing.bedrooms}bd` : ''
  const baths = listing.bathrooms ? `${listing.bathrooms}ba` : ''
  const details = [beds, baths].filter(Boolean).join(' ')
  const area = listing.area.charAt(0).toUpperCase() + listing.area.slice(1)
  const source = listing.source.charAt(0).toUpperCase() + listing.source.slice(1)
  return `🏠 New ${area} listing on ${source}\n${listing.title?.slice(0, 50) || 'Rental'}\n${details} · ${price}\n${listing.url || 'No link'}`
}

async function sendSMS(to, body) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const params = new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body })
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
    },
    body: params.toString(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Twilio error: ${data.message}`)
  return data.sid
}

export async function alertListing(listing, supabaseAdmin) {
  const message = formatListingAlert(listing)
  const sids = []
  for (const phone of RECIPIENTS) {
    try {
      const sid = await sendSMS(phone, message)
      sids.push(sid)
      await supabaseAdmin.from('alerts').insert({ listing_id: listing.id, recipient: phone, message, twilio_sid: sid, status: 'sent' })
    } catch (e) {
      console.error(`Failed to alert ${phone}:`, e.message)
      await supabaseAdmin.from('alerts').insert({ listing_id: listing.id, recipient: phone, message, status: 'failed' })
    }
  }
  if (sids.length > 0) {
    await supabaseAdmin.from('listings').update({ alerted: true }).eq('id', listing.id)
  }
  return sids
}

export async function sendTestAlert() {
  const message = `✅ California A-Z is live. You'll get alerts here when matching rentals drop.`
  const results = []
  for (const phone of RECIPIENTS) {
    try {
      const sid = await sendSMS(phone, message)
      results.push({ phone, sid, status: 'sent' })
    } catch (e) {
      results.push({ phone, error: e.message, status: 'failed' })
    }
  }
  return results
}
