/**
 * Módulo de Captura de GPS e Sensores do Dispositivo com Telemetria Rica
 */

let watchId = null;
let currentPosition = null;
let batteryInfo = { level: 100, isCharging: false };
let lastReportTime = 0;
let lastCoord = null;
let simulationInterval = null;

// Paleta de cores para avatares dos membros
const AVATAR_COLORS = [
  '#0091ff', // Electric Azure
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export function getUserId() {
  let id = localStorage.getItem('sentinel_user_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('sentinel_user_id', id);
  }
  return id;
}

export function setCustomUserId(id) {
  localStorage.setItem('sentinel_user_id', id);
}

export function getUserName() {
  return localStorage.getItem('sentinel_user_name') || 'Meu Celular';
}

export function setUserName(name) {
  localStorage.setItem('sentinel_user_name', name.trim());
}

export function getUserColor() {
  let color = localStorage.getItem('sentinel_user_color');
  if (!color) {
    color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    localStorage.setItem('sentinel_user_color', color);
  }
  return color;
}

/**
 * Monitora o nível de bateria do dispositivo se a API for suportada
 */
export async function initBatteryMonitor(onUpdate) {
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      const updateBattery = () => {
        batteryInfo = {
          level: Math.round(battery.level * 100),
          isCharging: battery.charging,
        };
        if (onUpdate) onUpdate(batteryInfo);
      };
      updateBattery();
      battery.addEventListener('levelchange', updateBattery);
      battery.addEventListener('chargingchange', updateBattery);
    } catch (e) {
      console.warn('Battery API não disponível:', e);
    }
  }
}

/**
 * Inicia o rastreamento contínuo de alta precisão
 */
export function startTracking(onPositionUpdate, onError) {
  if (!('geolocation' in navigator)) {
    if (onError) onError(new Error('Geolocalização não é suportada neste navegador.'));
    return false;
  }

  if (watchId !== null) {
    return true; // Já está ativo
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 2000,
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = pos.coords;
      let calculatedSpeed = coords.speed ? Math.round(coords.speed * 3.6) : 0; // m/s -> km/h

      // Se a velocidade nativa for nula, calcular via delta de distância
      const now = Date.now();
      if (lastCoord && (!coords.speed || coords.speed < 0)) {
        const distKm = calculateDistanceKm(lastCoord.lat, lastCoord.lng, coords.latitude, coords.longitude);
        const timeHours = (now - lastReportTime) / 3600000;
        if (timeHours > 0) {
          calculatedSpeed = Math.round(distKm / timeHours);
        }
      }

      lastCoord = { lat: coords.latitude, lng: coords.longitude };
      lastReportTime = now;

      let status = 'idle';
      if (calculatedSpeed > 3) status = 'moving';
      else status = 'stopped';

      currentPosition = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: Math.round(coords.accuracy || 10),
        speed: calculatedSpeed,
        heading: coords.heading || 0,
        altitude: coords.altitude || null,
        battery_level: batteryInfo.level,
        is_charging: batteryInfo.isCharging,
        status,
        timestamp: pos.timestamp,
      };

      if (onPositionUpdate) {
        onPositionUpdate(currentPosition);
      }
    },
    (err) => {
      console.warn('Aviso de geolocalização:', err.message);
      if (onError) onError(err);
    },
    options
  );

  return true;
}

/**
 * Inicia uma rota simulada para testes no computador ou ambientes internos
 */
export function startSimulatedTracking(initialLat, initialLng, onPositionUpdate) {
  stopTracking();
  stopSimulatedTracking();

  let lat = initialLat || -23.5505;
  let lng = initialLng || -46.6333;
  let step = 0;

  simulationInterval = setInterval(() => {
    step++;
    // Movimento suave simulando carro/caminhada
    lat += Math.sin(step * 0.2) * 0.0003 + 0.0001;
    lng += Math.cos(step * 0.2) * 0.0003 + 0.0001;

    currentPosition = {
      latitude: lat,
      longitude: lng,
      accuracy: 6,
      speed: Math.round(20 + Math.sin(step * 0.3) * 15), // 15 a 35 km/h
      heading: (step * 25) % 360,
      altitude: 760 + Math.round(Math.sin(step) * 5),
      battery_level: Math.max(10, batteryInfo.level - Math.floor(step / 30)),
      is_charging: batteryInfo.isCharging,
      status: 'moving',
      timestamp: Date.now(),
    };

    if (onPositionUpdate) {
      onPositionUpdate(currentPosition);
    }
  }, 2000);

  return true;
}

export function stopSimulatedTracking() {
  if (simulationInterval !== null) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

export function isSimulating() {
  return simulationInterval !== null;
}

/**
 * Interrompe o envio de GPS
 */
export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  stopSimulatedTracking();
}

export function isTrackingActive() {
  return watchId !== null || simulationInterval !== null;
}

export function getCurrentPosition() {
  return currentPosition;
}

/**
 * Fórmula de Haversine para calcular distância em km entre dois pontos
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
