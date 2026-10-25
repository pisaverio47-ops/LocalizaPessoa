import L from 'leaflet';

let mapInstance = null;
let currentLayer = 'dark';
let tileLayer = null;

const markersMap = new Map(); // userId -> { marker, accuracyCircle, trailPolyline }
const placesLayers = new Map(); // placeId -> L.circle

const MAP_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

/**
 * Inicializa o mapa Leaflet
 */
export function initMap(containerId = 'map', defaultCoords = [-23.5505, -46.6333], zoom = 14) {
  if (mapInstance) return mapInstance;

  mapInstance = L.map(containerId, {
    center: defaultCoords,
    zoom: zoom,
    zoomControl: false, // Nós usamos controles personalizados
  });

  // Camada padrão Dark Matter
  tileLayer = L.tileLayer(MAP_LAYERS.dark.url, {
    attribution: MAP_LAYERS.dark.attribution,
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(mapInstance);

  return mapInstance;
}

/**
 * Alterna entre temas de mapa (Escuro, Ruas e Satélite)
 */
export function toggleMapLayer() {
  if (!mapInstance) return;

  if (currentLayer === 'dark') currentLayer = 'streets';
  else if (currentLayer === 'streets') currentLayer = 'satellite';
  else currentLayer = 'dark';

  if (tileLayer) {
    mapInstance.removeLayer(tileLayer);
  }

  tileLayer = L.tileLayer(MAP_LAYERS[currentLayer].url, {
    attribution: MAP_LAYERS[currentLayer].attribution,
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(mapInstance);

  return currentLayer;
}

/**
 * Cria ou atualiza o marcador dinâmico de um membro no mapa
 */
export function updateMemberMarker(member, isSelf = false) {
  if (!mapInstance) return;

  const { user_id, user_name, latitude, longitude, accuracy, avatar_color, speed, battery_level, status } = member;
  const latLng = [latitude, longitude];

  const firstLetter = (user_name || 'U').charAt(0).toUpperCase();
  const color = avatar_color || (isSelf ? '#0091ff' : '#10b981');
  const isMoving = (status === 'moving' || speed > 3);

  // Criação do HTML do marcador com pulso de radar
  const iconHtml = `
    <div class="custom-marker">
      <div class="marker-pulse" style="background-color: ${color};"></div>
      <div class="marker-pin" style="background-color: ${color}; border-color: ${isSelf ? '#ffffff' : '#e2e8f0'};">
        <span>${firstLetter}</span>
      </div>
      <div class="marker-label">
        ${user_name} ${battery_level ? `• ${battery_level}%` : ''}
      </div>
    </div>
  `;

  const customIcon = L.divIcon({
    className: 'leaflet-custom-div-icon',
    html: iconHtml,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  if (markersMap.has(user_id)) {
    // Marcador existente: mover suavemente
    const entry = markersMap.get(user_id);
    entry.marker.setIcon(customIcon);
    entry.marker.setLatLng(latLng);

    if (entry.accuracyCircle) {
      entry.accuracyCircle.setLatLng(latLng);
      entry.accuracyCircle.setRadius(accuracy || 15);
    }
  } else {
    // Novo marcador
    const marker = L.marker(latLng, { icon: customIcon }).addTo(mapInstance);

    // Círculo de precisão do GPS
    const accuracyCircle = L.circle(latLng, {
      radius: accuracy || 20,
      color: color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.12,
    }).addTo(mapInstance);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; color: #0f172a; min-width: 140px;">
        <strong style="display: block; font-size: 14px; margin-bottom: 4px;">${user_name}</strong>
        <div>Velocidade: <b>${speed || 0} km/h</b></div>
        <div>Bateria: <b>${battery_level || '--'}%</b></div>
        <div>Precisão: <b>±${accuracy || '--'} m</b></div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${isMoving ? 'Em movimento' : 'Parado'}</div>
      </div>
    `);

    markersMap.set(user_id, { marker, accuracyCircle });
  }
}

/**
 * Centraliza o mapa em uma coordenada específica
 */
export function panToLocation(lat, lng, zoom = 16) {
  if (!mapInstance) return;
  mapInstance.setView([lat, lng], zoom, { animate: true, duration: 1 });
}

/**
 * Foca em um membro específico do círculo
 */
export function focusMember(userId) {
  if (markersMap.has(userId)) {
    const entry = markersMap.get(userId);
    const pos = entry.marker.getLatLng();
    panToLocation(pos.lat, pos.lng, 17);
    entry.marker.openPopup();
  }
}

/**
 * Ajusta o zoom para enquadrar todos os membros conectados
 */
export function fitAllMembers() {
  if (!mapInstance || markersMap.size === 0) return;

  const group = new L.featureGroup(Array.from(markersMap.values()).map((e) => e.marker));
  mapInstance.fitBounds(group.getBounds().pad(0.2), { animate: true });
}

/**
 * Retorna as coordenadas centrais atuais do mapa
 */
export function getMapCenter() {
  if (!mapInstance) return { lat: 0, lng: 0 };
  const center = mapInstance.getCenter();
  return { lat: center.lat, lng: center.lng };
}

/**
 * Renderiza os Lugares Seguros (Geofences) no mapa
 */
export function renderPlaces(places) {
  if (!mapInstance) return;

  // Limpa lugares antigos
  placesLayers.forEach((circle) => mapInstance.removeLayer(circle));
  placesLayers.clear();

  places.forEach((place) => {
    const circle = L.circle([place.latitude, place.longitude], {
      radius: place.radius_meters || 150,
      color: '#0091ff',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#0091ff',
      fillOpacity: 0.15,
    }).addTo(mapInstance);

    circle.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; color: #0f172a;">
        <strong>Lugar Seguro: ${place.name}</strong>
        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Raio: ${place.radius_meters}m</p>
      </div>
    `);

    placesLayers.set(place.id, circle);
  });
}
