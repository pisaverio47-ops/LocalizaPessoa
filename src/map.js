import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

let mapInstance = null;
let currentLayer = 'streets'; // Usar OpenStreetMap/Voyager por padrão para garantir visibilidade imediata
let tileLayer = null;

const markersMap = new Map(); // userId -> { marker, accuracyCircle, trailPolyline, historyCoords: [] }
const placesLayers = new Map(); // placeId -> L.circle

// Provedores de mapas testados e estáveis
const MAP_LAYERS = {
  streets: {
    name: 'Ruas & Cidades',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> colaboradores',
    maxZoom: 19,
  },
  dark: {
    name: 'Noturno / Tático',
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
};

/**
 * Inicializa o mapa Leaflet com garantia de renderização
 */
export function initMap(containerId = 'map', defaultCoords = [-23.5505, -46.6333], zoom = 14) {
  if (mapInstance) return mapInstance;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Contêiner do mapa #${containerId} não encontrado.`);
    return null;
  }

  mapInstance = L.map(containerId, {
    center: defaultCoords,
    zoom: zoom,
    zoomControl: true, // Habilitar controle de zoom nativo
  });

  // Camada padrão OpenStreetMap (garantia total de carregamento)
  tileLayer = L.tileLayer(MAP_LAYERS.streets.url, {
    attribution: MAP_LAYERS.streets.attribution,
    maxZoom: MAP_LAYERS.streets.maxZoom,
  }).addTo(mapInstance);

  // Forçar o recalculo do tamanho do contêiner para evitar tela cinza
  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 150);

  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 600);

  window.addEventListener('resize', () => {
    if (mapInstance) mapInstance.invalidateSize();
  });

  return mapInstance;
}

/**
 * Alterna entre temas de mapa (Ruas, Escuro e Satélite)
 */
export function toggleMapLayer() {
  if (!mapInstance) return 'streets';

  if (currentLayer === 'streets') currentLayer = 'dark';
  else if (currentLayer === 'dark') currentLayer = 'satellite';
  else currentLayer = 'streets';

  if (tileLayer) {
    mapInstance.removeLayer(tileLayer);
  }

  const selected = MAP_LAYERS[currentLayer];
  tileLayer = L.tileLayer(selected.url, {
    attribution: selected.attribution,
    maxZoom: selected.maxZoom,
  }).addTo(mapInstance);

  return selected.name;
}

/**
 * Converte graus de direção em ponto cardeal
 */
function getHeadingCardinal(heading) {
  if (heading === null || heading === undefined || heading < 0) return 'Indefinido';
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(heading / 45) % 8;
  return `${directions[index]} (${Math.round(heading)}°)`;
}

/**
 * Cria ou atualiza o marcador dinâmico de um membro no mapa
 */
export function updateMemberMarker(member, isSelf = false) {
  if (!mapInstance) return;

  const {
    user_id,
    user_name,
    latitude,
    longitude,
    accuracy,
    avatar_color,
    speed,
    heading,
    altitude,
    battery_level,
    status,
    updated_at,
  } = member;

  const latLng = [latitude, longitude];
  const firstLetter = (user_name || 'U').charAt(0).toUpperCase();
  const color = avatar_color || (isSelf ? '#0091ff' : '#10b981');
  const isMoving = status === 'moving' || (speed && speed > 3);
  const timeStr = updated_at ? new Date(updated_at).toLocaleTimeString('pt-BR') : 'Agora';
  const headingText = getHeadingCardinal(heading);

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

  const popupContent = `
    <div style="font-family: inherit; font-size: 13px; color: #0f172a; min-width: 220px; line-height: 1.5;">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
        <strong style="font-size: 15px; color: #0f172a;">${user_name} ${isSelf ? '(Você)' : ''}</strong>
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isMoving ? '#dcfce7' : '#f1f5f9'}; color: ${isMoving ? '#15803d' : '#475569'}; font-weight: 600;">
          ${isMoving ? '🚗 Em Movimento' : '🛑 Parado'}
        </span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
        <div>⚡ Velocidade: <b>${speed || 0} km/h</b></div>
        <div>🔋 Bateria: <b>${battery_level || '--'}%</b></div>
        <div>🎯 Precisão: <b>±${accuracy || '--'} m</b></div>
        <div>🧭 Direção: <b>${headingText}</b></div>
      </div>
      ${altitude ? `<div>⛰️ Altitude: <b>${Math.round(altitude)} m</b></div>` : ''}
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
        📍 Coords: <code>${latitude.toFixed(5)}, ${longitude.toFixed(5)}</code>
      </div>
      <div style="font-size: 11px; color: #94a3b8;">Último sinal: ${timeStr}</div>
    </div>
  `;

  if (markersMap.has(user_id)) {
    // Marcador existente: mover suavemente
    const entry = markersMap.get(user_id);
    entry.marker.setIcon(customIcon);
    entry.marker.setLatLng(latLng);
    entry.marker.setPopupContent(popupContent);

    if (entry.accuracyCircle) {
      entry.accuracyCircle.setLatLng(latLng);
      entry.accuracyCircle.setRadius(accuracy || 15);
    }

    // Traçado do trajeto (Breadcrumb trail)
    entry.historyCoords.push(latLng);
    if (entry.historyCoords.length > 50) {
      entry.historyCoords.shift();
    }
    if (entry.trailPolyline) {
      entry.trailPolyline.setLatLngs(entry.historyCoords);
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

    // Linha de rastro do trajeto
    const historyCoords = [latLng];
    const trailPolyline = L.polyline(historyCoords, {
      color: color,
      weight: 3,
      opacity: 0.6,
      dashArray: '4, 8',
    }).addTo(mapInstance);

    marker.bindPopup(popupContent);

    markersMap.set(user_id, {
      marker,
      accuracyCircle,
      trailPolyline,
      historyCoords,
    });
  }
}

/**
 * Centraliza o mapa em uma coordenada específica
 */
export function panToLocation(lat, lng, zoom = 16) {
  if (!mapInstance) return;
  mapInstance.setView([lat, lng], zoom, { animate: true, duration: 0.8 });
  setTimeout(() => mapInstance.invalidateSize(), 100);
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
  mapInstance.fitBounds(group.getBounds().pad(0.25), { animate: true });
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
        <strong>📍 Lugar Seguro: ${place.name}</strong>
        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">Raio de detecção: ${place.radius_meters}m</p>
      </div>
    `);

    placesLayers.set(place.id, circle);
  });
}
