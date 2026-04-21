const SUPABASE_URL = 'https://naypfraaybctcmaxjzoz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CDa0DBxz1daz4x4xwOHZ6w_xbIPIWDn'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const map = L.map('map').setView([52.1, 19.4], 6)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

const markers = {}

const params = new URLSearchParams(window.location.search)
const currentView = params.get('view') === 'admin' ? 'admin' : 'kursant'

document.getElementById('admin-controls').style.display =
  currentView === 'admin' ? 'block' : 'none'

function createIcon() {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%"></div>`,
    iconSize: [14, 14]
  })
}

async function loadVehicle() {
  const { data } = await supabaseClient
    .from('vehicles')
    .select('*')
    .single()

  if (!data) return

  if (!markers[data.id]) {
    markers[data.id] = L.marker([data.lat, data.lng], { icon: createIcon() }).addTo(map)
  }

  markers[data.id].setLatLng([data.lat, data.lng])
}

async function animateVehicle() {
  const { data: trip } = await supabaseClient
    .from('active_trip')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(1)
    .single()

  if (!trip) return

  const now = Date.now()
  const start = new Date(trip.start_time).getTime()
  const end = new Date(trip.end_time).getTime()

  const progress = Math.min(1, (now - start) / (end - start))

  const lat = trip.start_lat + (trip.end_lat - trip.start_lat) * progress
  const lng = trip.start_lng + (trip.end_lng - trip.start_lng) * progress

  await supabaseClient
    .from('vehicles')
    .update({ lat, lng })
    .eq('id', trip.vehicle_id)

  loadVehicle()
}

setInterval(animateVehicle, 1000)

document.addEventListener('click', async (e) => {
  if (e.target.id === 'start-trip') {

    const startLat = parseFloat(document.getElementById('start-lat').value)
    const startLng = parseFloat(document.getElementById('start-lng').value)
    const endLat = parseFloat(document.getElementById('end-lat').value)
    const endLng = parseFloat(document.getElementById('end-lng').value)
    const duration = parseInt(document.getElementById('duration').value)

    const now = new Date()
    const endTime = new Date(now.getTime() + duration * 60000)

    const { data: vehicle } = await supabaseClient
      .from('vehicles')
      .select('*')
      .single()

    await supabaseClient.from('active_trip').insert({
      vehicle_id: vehicle.id,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng,
      start_time: now,
      end_time: endTime
    })
  }
})

loadVehicle()
