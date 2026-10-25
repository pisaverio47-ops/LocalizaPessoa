import {
  getStoredConfig,
  saveStoredConfig,
  getSupabase,
  subscribeCircleLocations,
  broadcastAndSaveLocation,
  fetchCircleLocations,
  fetchPlaces,
  createPlace,
  triggerAlert,
} from './supabase.js';

import {
  getUserId,
  getUserName,
  setUserName,
  getUserColor,
  initBatteryMonitor,
  startTracking,
  stopTracking,
  isTrackingActive,
  getCurrentPosition,
  calculateDistanceKm,
} from './tracker.js';

import {
  initMap,
  toggleMapLayer,
  updateMemberMarker,
  panToLocation,
  focusMember,
  fitAllMembers,
  getMapCenter,
  renderPlaces,
} from './map.js';

// Estado da Aplicação
let currentCircle = localStorage.getItem('sentinel_circle_code') || 'FAMILIA-01';
let currentCircleName = localStorage.getItem('sentinel_circle_name') || 'Minha Família';
const myUserId = getUserId();
const myColor = getUserColor();
const membersMap = new Map(); // userId -> locationData
let placesList = [];
let simulatedInterval = null;

// Elementos do DOM
const globalStatusDot = document.getElementById('globalStatusDot');
const globalStatusText = document.getElementById('globalStatusText');
const btnToggleTransmit = document.getElementById('btnToggleTransmit');
const transmitButtonLabel = document.getElementById('transmitButtonLabel');
const btnSosAlert = document.getElementById('btnSosAlert');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const sidebarPanel = document.getElementById('sidebarPanel');

const inputMyName = document.getElementById('inputMyName');
const btnEditName = document.getElementById('btnEditName');
const myAvatarRing = document.getElementById('myAvatarRing');
const myAvatarLetter = document.getElementById('myAvatarLetter');
const myTrackingStatus = document.getElementById('myTrackingStatus');
const myBatteryValue = document.getElementById('myBatteryValue');
const mySpeedValue = document.getElementById('mySpeedValue');
const myAccuracyValue = document.getElementById('myAccuracyValue');

const headerCircleBadge = document.getElementById('headerCircleBadge');
const circleNameDisplay = document.getElementById('circleNameDisplay');
const circleCodeDisplay = document.getElementById('circleCodeDisplay');
const btnCopyCircleCode = document.getElementById('btnCopyCircleCode');
const btnChangeCircle = document.getElementById('btnChangeCircle');
const btnFitBounds = document.getElementById('btnFitBounds');
const memberCount = document.getElementById('memberCount');
const membersListContainer = document.getElementById('membersList');

const btnRecenterMe = document.getElementById('btnRecenterMe');
const btnToggleLayer = document.getElementById('btnToggleLayer');
const alertToastContainer = document.getElementById('alertToastContainer');

// Modais
const modalCircle = document.getElementById('modalCircle');
const inputCircleCode = document.getElementById('inputCircleCode');
const inputCircleName = document.getElementById('inputCircleName');
const btnConfirmCircleModal = document.getElementById('btnConfirmCircleModal');
const btnCancelCircleModal = document.getElementById('btnCancelCircleModal');
const btnCloseCircleModal = document.getElementById('btnCloseCircleModal');

const modalPlace = document.getElementById('modalPlace');
const btnAddPlaceModal = document.getElementById('btnAddPlaceModal');
const inputPlaceName = document.getElementById('inputPlaceName');
const inputPlaceRadius = document.getElementById('inputPlaceRadius');
const btnSavePlaceModal = document.getElementById('btnSavePlaceModal');
const btnCancelPlaceModal = document.getElementById('btnCancelPlaceModal');
const btnClosePlaceModal = document.getElementById('btnClosePlaceModal');

const modalSettings = document.getElementById('modalSettings');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const cfgSupabaseUrl = document.getElementById('cfgSupabaseUrl');
const cfgSupabaseKey = document.getElementById('cfgSupabaseKey');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');

// ==============================================================================
// INICIALIZAÇÃO
// ==============================================================================
async function initApp() {
  // 1. Configurar Perfil Local
  setupLocalProfile();

  // 2. Inicializar Mapa
  initMap('map');

  // 3. Monitor de Bateria
  initBatteryMonitor((battery) => {
    myBatteryValue.textContent = `${battery.level}% ${battery.isCharging ? '⚡' : ''}`;
  });

  // 4. Conectar ao Supabase
  await connectToSupabase();

  // 5. Registrar Eventos de Interface
  registerEventListeners();

  // 6. Tentar obter localização inicial para centralizar o mapa
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        panToLocation(pos.coords.latitude, pos.coords.longitude, 15);
      },
      () => {
        console.log('Localização inicial padrão mantida.');
      },
      { timeout: 5000 }
    );
  }
}

// Configura dados visuais do usuário local
function setupLocalProfile() {
  const name = getUserName();
  inputMyName.value = name;
  myAvatarLetter.textContent = name.charAt(0).toUpperCase();
  myAvatarRing.style.background = `linear-gradient(135deg, ${myColor}, #0284c7)`;
  updateCircleUI();
}

function updateCircleUI() {
  headerCircleBadge.textContent = `Círculo: ${currentCircle}`;
  circleNameDisplay.textContent = currentCircleName;
  circleCodeDisplay.textContent = currentCircle;
}

// Conexão com o Supabase e carregamento inicial
async function connectToSupabase() {
  const client = getSupabase();
  if (!client) {
    globalStatusDot.className = 'status-indicator-dot offline';
    globalStatusText.textContent = 'Configuração do Supabase pendente';
    return;
  }

  globalStatusDot.className = 'status-indicator-dot online';
  globalStatusText.textContent = 'Conectado ao Supabase (Tempo Real)';

  // Carregar dados existentes
  await loadInitialLocations();
  await loadPlaces();

  // Assinar WebSocket em tempo real para este círculo
  subscribeCircleLocations(currentCircle, handleIncomingLocation);
}

// Carrega as posições já gravadas
async function loadInitialLocations() {
  const locations = await fetchCircleLocations(currentCircle);
  locations.forEach((loc) => {
    handleIncomingLocation(loc);
  });
}

// Carrega os lugares seguros
async function loadPlaces() {
  placesList = await fetchPlaces(currentCircle);
  renderPlaces(placesList);
  renderPlacesSidebar();
}

// Atualiza a lista de lugares na sidebar
function renderPlacesSidebar() {
  const container = document.getElementById('placesList');
  if (!container) return;

  if (placesList.length === 0) {
    container.innerHTML = '<div class="empty-places"><span>Nenhum lugar cadastrado ainda.</span></div>';
    return;
  }

  container.innerHTML = placesList
    .map(
      (p) => `
      <div class="place-item" data-id="${p.id}">
        <span class="place-name">📍 ${p.name}</span>
        <span class="place-radius">${p.radius_meters}m</span>
      </div>
    `
    )
    .join('');
}

// ==============================================================================
// PROCESSAMENTO DE LOCALIZAÇÃO EM TEMPO REAL
// ==============================================================================
function handleIncomingLocation(data) {
  if (!data || !data.user_id) return;

  const isSelf = data.user_id === myUserId;
  membersMap.set(data.user_id, data);

  // Atualizar marcador no mapa
  updateMemberMarker(data, isSelf);

  // Atualizar lista visual de membros
  renderMembersList();

  // Se for o próprio usuário, atualizar telemetria da tela
  if (isSelf) {
    mySpeedValue.textContent = `${data.speed || 0} km/h`;
    myAccuracyValue.textContent = `±${data.accuracy || 0} m`;
    myBatteryValue.textContent = `${data.battery_level || '--'}% ${data.is_charging ? '⚡' : ''}`;
  }
}

// Renderiza a lista de membros na barra lateral
function renderMembersList() {
  const otherMembers = Array.from(membersMap.values()).filter((m) => m.user_id !== myUserId);
  memberCount.textContent = otherMembers.length.toString();

  if (otherMembers.length === 0) {
    membersListContainer.innerHTML = `
      <div class="empty-state">
        <p>Nenhum outro membro transmitindo neste círculo.</p>
        <small>Abra este site em outro celular com o mesmo código para vê-lo aqui.</small>
      </div>
    `;
    return;
  }

  membersListContainer.innerHTML = otherMembers
    .map((member) => {
      const isOnline = Date.now() - new Date(member.updated_at || Date.now()).getTime() < 120000;
      const initial = (member.user_name || 'U').charAt(0).toUpperCase();
      const statusText = member.speed > 3 ? `Em movimento (${member.speed} km/h)` : 'Parado';

      return `
      <div class="member-item" data-userid="${member.user_id}">
        <div class="member-main">
          <div class="member-avatar" style="background-color: ${member.avatar_color || '#10b981'};">
            <span>${initial}</span>
            <span class="status-dot" style="background-color: ${isOnline ? '#10b981' : '#f59e0b'};"></span>
          </div>
          <div class="member-details">
            <span class="member-name">${member.user_name}</span>
            <span class="member-status">${statusText}</span>
          </div>
        </div>
        <div class="member-meta">
          <span class="member-battery">🔋 ${member.battery_level || '--'}%</span>
          <span class="member-time">±${member.accuracy || 0}m</span>
        </div>
      </div>
    `;
    })
    .join('');

  // Adicionar clique para focar no membro
  membersListContainer.querySelectorAll('.member-item').forEach((item) => {
    item.addEventListener('click', () => {
      const uId = item.getAttribute('data-userid');
      focusMember(uId);
    });
  });
}

// ==============================================================================
// TRANSMISSÃO DE LOCALIZAÇÃO DO DISPOSITIVO (GPS)
// ==============================================================================
function toggleTransmission() {
  if (isTrackingActive()) {
    // Parar transmissão
    stopTracking();
    btnToggleTransmit.classList.remove('active');
    transmitButtonLabel.textContent = 'Transmitir GPS';
    myTrackingStatus.textContent = 'GPS Desligado';
    myTrackingStatus.classList.remove('live');
    showToast('Transmissão de localização desativada.');
  } else {
    // Iniciar transmissão de alta precisão
    myTrackingStatus.textContent = 'Buscando satélites GPS...';
    
    const started = startTracking(
      (pos) => {
        btnToggleTransmit.classList.add('active');
        transmitButtonLabel.textContent = 'Transmitindo AO VIVO';
        myTrackingStatus.textContent = 'Transmitindo em Tempo Real';
        myTrackingStatus.classList.add('live');

        const payload = {
          circle_code: currentCircle,
          user_id: myUserId,
          user_name: getUserName(),
          avatar_color: myColor,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          speed: pos.speed,
          heading: pos.heading,
          battery_level: pos.battery_level,
          is_charging: pos.is_charging,
          status: pos.status,
          updated_at: new Date().toISOString(),
        };

        // Enviar para Supabase e atualizar localmente
        broadcastAndSaveLocation(payload);
        handleIncomingLocation(payload);

        // Checar aproximação de Lugares Seguros
        checkGeofences(pos.latitude, pos.longitude);
      },
      (err) => {
        btnToggleTransmit.classList.remove('active');
        transmitButtonLabel.textContent = 'Transmitir GPS';
        myTrackingStatus.textContent = 'Erro de permissão GPS';
        showToast(`Permissão de GPS necessária: ${err.message}`, true);
      }
    );

    if (started) {
      showToast('Transmissão ativada! Coordenadas enviando ao Supabase.');
    }
  }
}

// Checagem de Geofencing
function checkGeofences(lat, lng) {
  placesList.forEach((place) => {
    const distKm = calculateDistanceKm(lat, lng, place.latitude, place.longitude);
    const distMeters = distKm * 1000;
    const insideKey = `inside_place_${place.id}`;
    const wasInside = sessionStorage.getItem(insideKey) === 'true';

    if (distMeters <= (place.radius_meters || 150)) {
      if (!wasInside) {
        sessionStorage.setItem(insideKey, 'true');
        const msg = `${getUserName()} chegou em: ${place.name}`;
        triggerAlert(currentCircle, getUserName(), 'geofence_enter', msg, lat, lng);
        showToast(msg);
      }
    } else {
      if (wasInside) {
        sessionStorage.setItem(insideKey, 'false');
        const msg = `${getUserName()} saiu de: ${place.name}`;
        triggerAlert(currentCircle, getUserName(), 'geofence_exit', msg, lat, lng);
        showToast(msg);
      }
    }
  });
}

// ==============================================================================
// ALERTAS E TOASTS
// ==============================================================================
function showToast(message, isDanger = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isDanger ? 'toast-sos' : ''}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none; border:none; color:inherit; cursor:pointer; font-size:16px;">&times;</button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  alertToastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 5000);
}

// Disparar Alerta SOS
function handleSosClick() {
  const confirmSos = confirm('Você deseja disparar um ALERTA DE EMERGÊNCIA SOS para todos os membros deste círculo?');
  if (!confirmSos) return;

  const pos = getCurrentPosition();
  const lat = pos ? pos.latitude : null;
  const lng = pos ? pos.longitude : null;

  triggerAlert(
    currentCircle,
    getUserName(),
    'sos',
    `EMERGÊNCIA! ${getUserName()} acionou o botão de socorro SOS!`,
    lat,
    lng
  );

  showToast(`🚨 ALERTA SOS ENVIADO PARA O CÍRCULO ${currentCircle}!`, true);

  // Som de alerta via Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.4);
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn(e);
  }
}

// ==============================================================================
// EVENT LISTENERS E CONTROLES
// ==============================================================================
function registerEventListeners() {
  // Transmitir GPS
  btnToggleTransmit.addEventListener('click', toggleTransmission);

  // Botão SOS
  btnSosAlert.addEventListener('click', handleSosClick);

  // Menu Mobile Drawer
  btnToggleSidebar.addEventListener('click', () => {
    sidebarPanel.classList.toggle('open');
  });

  // Salvar Nome do Usuário
  btnEditName.addEventListener('click', () => {
    const newName = inputMyName.value.trim();
    if (newName) {
      setUserName(newName);
      myAvatarLetter.textContent = newName.charAt(0).toUpperCase();
      showToast(`Nome salvo como "${newName}".`);
    }
  });

  // Copiar Código do Círculo
  btnCopyCircleCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCircle);
    showToast(`Código ${currentCircle} copiado para a área de transferência!`);
  });

  // Alternar Camadas do Mapa
  btnToggleLayer.addEventListener('click', () => {
    const layer = toggleMapLayer();
    showToast(`Estilo de mapa alterado: ${layer.toUpperCase()}`);
  });

  // Centralizar na Minha Posição
  btnRecenterMe.addEventListener('click', () => {
    const pos = getCurrentPosition();
    if (pos) {
      panToLocation(pos.latitude, pos.longitude, 16);
    } else {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((p) => {
          panToLocation(p.coords.latitude, p.coords.longitude, 16);
        });
      }
    }
  });

  // Ver todos os membros no mapa
  btnFitBounds.addEventListener('click', () => {
    fitAllMembers();
  });

  // Modal: Trocar Círculo
  btnChangeCircle.addEventListener('click', () => {
    inputCircleCode.value = currentCircle;
    inputCircleName.value = currentCircleName;
    modalCircle.classList.remove('hidden');
  });

  btnCloseCircleModal.addEventListener('click', () => modalCircle.classList.add('hidden'));
  btnCancelCircleModal.addEventListener('click', () => modalCircle.classList.add('hidden'));

  btnConfirmCircleModal.addEventListener('click', async () => {
    const newCode = inputCircleCode.value.trim().toUpperCase();
    const newName = inputCircleName.value.trim() || 'Minha Família';

    if (!newCode) {
      alert('Por favor, informe um código para o círculo.');
      return;
    }

    currentCircle = newCode;
    currentCircleName = newName;
    localStorage.setItem('sentinel_circle_code', newCode);
    localStorage.setItem('sentinel_circle_name', newName);

    updateCircleUI();
    modalCircle.classList.add('hidden');

    membersMap.clear();
    await connectToSupabase();
    showToast(`Entrou no círculo "${newCode}".`);
  });

  // Modal: Adicionar Lugar Seguro
  btnAddPlaceModal.addEventListener('click', () => {
    modalPlace.classList.remove('hidden');
  });

  btnClosePlaceModal.addEventListener('click', () => modalPlace.classList.add('hidden'));
  btnCancelPlaceModal.addEventListener('click', () => modalPlace.classList.add('hidden'));

  btnSavePlaceModal.addEventListener('click', async () => {
    const name = inputPlaceName.value.trim();
    const radius = parseInt(inputPlaceRadius.value, 10);
    if (!name) {
      alert('Informe o nome do lugar.');
      return;
    }

    const center = getMapCenter();
    try {
      await createPlace(currentCircle, name, center.lat, center.lng, radius);
      modalPlace.classList.add('hidden');
      inputPlaceName.value = '';
      await loadPlaces();
      showToast(`Lugar Seguro "${name}" salvo!`);
    } catch (err) {
      alert(`Erro ao salvar lugar: ${err.message}`);
    }
  });

  // Modal: Configurações do Supabase
  btnOpenSettings.addEventListener('click', () => {
    const { url, key } = getStoredConfig();
    cfgSupabaseUrl.value = url;
    cfgSupabaseKey.value = key;
    modalSettings.classList.remove('hidden');
  });

  btnCloseSettingsModal.addEventListener('click', () => modalSettings.classList.add('hidden'));
  btnCancelSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));

  btnSaveSettings.addEventListener('click', async () => {
    const url = cfgSupabaseUrl.value.trim();
    const key = cfgSupabaseKey.value.trim();
    if (!url || !key) {
      alert('Preencha a URL e a Anon Key do Supabase.');
      return;
    }

    saveStoredConfig(url, key);
    modalSettings.classList.add('hidden');
    await connectToSupabase();
    showToast('Credenciais do Supabase atualizadas e reconectadas!');
  });
}

// Inicia aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initApp);
