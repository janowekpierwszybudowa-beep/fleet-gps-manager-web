const SUPABASE_URL = 'https://naypfraaybctcmaxjzoz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CDa0DBxz1daz4x4xwOHZ6w_xbIPIWDn'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const map = L.map('map').setView([52.1, 19.4], 6)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const markers = {}

async function loadVehicles() {
  const { data, error } = await supabaseClient
    .from('vehicles')
    .select('*')

  if (error) {
    document.getElementById('status').innerText = 'Błąd połączenia'
    console.error(error)
    return
  }

  document.getElementById('status').innerText = 'Połączono'

  const list = document.getElementById('vehicle-list')
  list.innerHTML = ''

  data.forEach(vehicle => {
    const item = document.createElement('div')
    item.className = 'vehicle-item'

    const statusClass = vehicle.status === 'moving' ? 'status-moving' : 'status-stopped'

    item.innerHTML = `
      <strong>${vehicle.registration}</strong><br>
      Status: <span class="${statusClass}">${vehicle.status}</span><br>
      Prędkość: ${vehicle.speed} km/h
    `

    list.appendChild(item)

    if (vehicle.lat && vehicle.lng) {
      const color = vehicle.status === 'moving' ? 'green' : 'red'

      const icon = L.divIcon({
        html: `<div style="width:15px;height:15px;background:${color};border-radius:50%"></div>`
      })

      if (markers[vehicle.id]) {
        markers[vehicle.id].setLatLng([vehicle.lat, vehicle.lng])
      } else {
        markers[vehicle.id] = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(map)
      }
    }
  })
}

loadVehicles()
setInterval(loadVehicles, 5000)
