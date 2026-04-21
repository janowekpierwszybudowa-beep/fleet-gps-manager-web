const SUPABASE_URL = 'https://naypfraaybctcmaxjzoz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_CDa0DBxz1daz4x4xwOHZ6w_xbIPIWDn'

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const map = L.map('map').setView([52.1, 19.4], 6)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map)

const markers = {}
let simulationRunning = false

const params = new URLSearchParams(window.location.search)
const currentView = params.get('view') === 'admin' ? 'admin' : 'kursant'

const viewLabel = document.getElementById('view-label')
const adminControls = document.getElementById('admin-controls')
const miniViewRow = document.getElementById('mini-view-row')

if (currentView === 'admin') {
  viewLabel.innerText = 'Widok: administrator'
  viewLabel.style.display = 'inline-flex'
  adminControls.style.display = 'block'
  miniViewRow.style.display = 'flex'
} else {
  viewLabel.innerText = ''
  viewLabel.style.display = 'none'
  adminControls.style.display = 'none'
  miniViewRow.style.display = 'none'
}

function updateMiniCard(vehicle) {
  document.getElementById('mini-registration').innerText = vehicle?.registration || '-'
  document.getElementById('mini-status').innerText =
    vehicle?.status === 'moving' ? 'W ruchu' : vehicle?.status === 'stopped' ? 'Postój' : '-'
  document.getElementById('mini-speed').innerText =
    vehicle?.speed != null ? `${vehicle.speed} km/h` : '-'

  if (currentView === 'admin') {
    document.getElementById('mini-view').innerText = 'Administrator'
  }
}

function createTruckIcon(status) {
  const truckClass = status === 'moving' ? 'truck-moving' : 'truck-stopped'

  return L.divIcon({
    className: '',
    html: `<div class="truck-marker ${truckClass}"></div>`,
    iconSize: [46, 28],
    iconAnchor: [23, 14],
    popupAnchor: [0, -12]
  })
}

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

  let firstVehicle = null

  data.forEach(vehicle => {
    if (!firstVehicle) firstVehicle = vehicle

    const item = document.createElement('div')
    item.className = 'vehicle-item'

    const statusClass = vehicle.status === 'moving' ? 'status-moving' : 'status-stopped'
    const statusText = vehicle.status === 'moving' ? 'W ruchu' : 'Postój'

    item.innerHTML = `
      <strong>${vehicle.registration}</strong>
      Status: <span class="${statusClass}">${statusText}</span><br>
      Prędkość: ${vehicle.speed} km/h
    `

    list.appendChild(item)

    if (vehicle.lat && vehicle.lng) {
      const icon = createTruckIcon(vehicle.status)

      if (markers[vehicle.id]) {
        markers[vehicle.id].setLatLng([vehicle.lat, vehicle.lng])
        markers[vehicle.id].setIcon(icon)
        markers[vehicle.id].bindPopup(`
          <strong>${vehicle.registration}</strong><br>
          Status: ${statusText}<br>
          Prędkość: ${vehicle.speed} km/h
        `)
      } else {
        markers[vehicle.id] = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(map)
          .bindPopup(`
            <strong>${vehicle.registration}</strong><br>
            Status: ${statusText}<br>
            Prędkość: ${vehicle.speed} km/h
          `)
      }
    }
  })

  updateMiniCard(firstVehicle)
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
  if (currentView !== 'admin') return
  if (simulationRunning) return

  simulationRunning = true
  document.getElementById('status').innerText = 'Przejazd uruchomiony'

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

  document.getElementById('status').innerText = 'Przejazd zakończony'
  simulationRunning = false
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'start-simulation') {
    startSimulation()
  }
})

loadVehicles()
setInterval(loadVehicles, 5000)
