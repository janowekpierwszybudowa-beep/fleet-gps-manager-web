const SUPABASE_URL = 'https://naypfraaybctcmaxjzoz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CDa0DBxz1daz4x4xwOHZ6w_xbIPIWDn'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const map = L.map('map').setView([52.1, 19.4], 6)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const markers = {}
let simulationRunning = false

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
        className: '',
        html: `<div style="width:15px;height:15px;background:${color};border-radius:50%;border:2px solid white;"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7]
      })

      if (markers[vehicle.id]) {
        markers[vehicle.id].setLatLng([vehicle.lat, vehicle.lng])
        markers[vehicle.id].setIcon(icon)
      } else {
        markers[vehicle.id] = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(map)
      }
    }
  })
}

async function saveVehicleHistory(vehicleId, point, newSpeed, newStatus) {
  const { error } = await supabaseClient
    .from('vehicle_history')
    .insert({
      vehicle_id: vehicleId,
      lat: point.lat,
      lng: point.lng,
      speed: newSpeed,
      status: newStatus,
      road_type: point.road_type
    })

  if (error) {
    console.error('Błąd zapisu historii:', error)
  }
}

async function startSimulation() {
  if (simulationRunning) return
  simulationRunning = true

  document.getElementById('status').innerText = 'Symulacja uruchomiona'

  const { data: vehicle, error: vehicleError } = await supabaseClient
    .from('vehicles')
    .select('*')
    .eq('registration', 'DW 1234A')
    .single()

  if (vehicleError || !vehicle) {
    console.error(vehicleError)
    document.getElementById('status').innerText = 'Nie znaleziono pojazdu'
    simulationRunning = false
    return
  }

  const { data: points, error: pointsError } = await supabaseClient
    .from('route_points')
    .select('*')
    .eq('route_id', vehicle.route_id)
    .order('position', { ascending: true })

  if (pointsError || !points || !points.length) {
    console.error(pointsError)
    document.getElementById('status').innerText = 'Brak punktów trasy'
    simulationRunning = false
    return
  }

  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const isStop = (point.stop_seconds || 0) > 0

    const newStatus = isStop ? 'stopped' : 'moving'
    const newSpeed = isStop ? 0 : (point.speed_limit || 50)

    const { error: updateError } = await supabaseClient
      .from('vehicles')
      .update({
        lat: point.lat,
        lng: point.lng,
        status: newStatus,
        speed: newSpeed
      })
      .eq('registration', 'DW 1234A')

    if (updateError) {
      console.error(updateError)
      document.getElementById('status').innerText = 'Błąd aktualizacji pojazdu'
      simulationRunning = false
      return
    }

    await saveVehicleHistory(vehicle.id, point, newSpeed, newStatus)
    await loadVehicles()

    const waitSeconds = isStop ? Math.max(point.stop_seconds, 2) : 3
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
  }

  document.getElementById('status').innerText = 'Symulacja zakończona'
  simulationRunning = false
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'start-simulation') {
    startSimulation()
  }
})

loadVehicles()
setInterval(loadVehicles, 5000)
