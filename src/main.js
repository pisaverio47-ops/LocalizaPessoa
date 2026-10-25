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
  signUpUser,
  verifyEmailOtp,
  signInUser,
  signOutUser,
  getCurrentUser,
  onAuthStateChange,
  createFamily,
  joinFamilyByCode,
  getUserFamilies,
} from './supabase.js';

import {
  getUserId,
  setCustomUserId,
  getUserName,
  setUserName,
  getUserColor,
  initBatteryMonitor,
  startTracking,
  stopTracking,
  isTrackingActive,
  startSimulatedTracking,
  stopSimulatedTracking,
  isSimulating,
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

// Estado Global
let currentCircle = localStorage.getItem('sentinel_circle_code') || 'FAMILIA-01';
let currentCircleName = localStorage.getItem('sentinel_circle_name') || 'Minha Família';
let authenticatedUser = null;
const myColor = getUserColor();
const membersMap = new Map();
let placesList = [];
let mapInitialized = false;

// Elementos da Tela de Bloqueio (Auth Gate)
const authGate = document.getElementById('authGate');
const gateTabLogin = document.getElementById('gateTabLogin');
const gateTabRegister = document.getElementById('gateTabRegister');
const gateTabVerify = document.getElementById('gateTabVerify');
const gateFormLogin = document.getElementById('gateFormLogin');
const gateFormRegister = document.getElementById('gateFormRegister');
const gateFormVerify = document.getElementById('gateFormVerify');
const gateLoginEmail = document.getElementById('gateLoginEmail');
const gateLoginPassword = document.getElementById('gateLoginPassword');
const gateRegName = document.getElementById('gateRegName');
const gateRegEmail = document.getElementById('gateRegEmail');
const gateRegPassword = document.getElementById('gateRegPassword');
const gateVerifyEmail = document.getElementById('gateVerifyEmail');
const gateVerifyToken = document.getElementById('gateVerifyToken');

// Elementos da Aplicação Principal
const appMain = document.getElementById('app');
const liveGpsBadge = document.getElementById('liveGpsBadge');
const liveGpsText = document.getElementById('liveGpsText');
const btnSosAlert = document.getElementById('btnSosAlert');
const btnUserMenu = document.getElementById('btnUserMenu');
const userInitialBadge = document.getElementById('userInitialBadge');

// Sidebar e Bottom Sheet
const sidebarPanel = document.getElementById('sidebarPanel');
const bottomSheetHandle = document.getElementById('bottomSheetHandle');
const sheetQuickStatus = document.getElementById('sheetQuickStatus');

const inputMyName = document.getElementById('inputMyName');
const btnEditName = document.getElementById('btnEditName');
const myAvatarRing = document.getElementById('myAvatarRing');
const myAvatarLetter = document.getElementById('myAvatarLetter');
const myTrackingStatus = document.getElementById('myTrackingStatus');
const userEmailBadge = document.getElementById('userEmailBadge');

// Telemetria Expandida
const myBatteryValue = document.getElementById('myBatteryValue');
const mySpeedValue = document.getElementById('mySpeedValue');
const myAccuracyValue = document.getElementById('myAccuracyValue');
const myHeadingValue = document.getElementById('myHeadingValue');
const myAltitudeValue = document.getElementById('myAltitudeValue');
const myCoordsValue = document.getElementById('myCoordsValue');
const btnSimulateRoute = document.getElementById('btnSimulateRoute');

// Gestão de Famílias
const headerCircleBadge = document.getElementById('headerCircleBadge');
const circleNameDisplay = document.getElementById('circleNameDisplay');
const circleCodeDisplay = document.getElementById('circleCodeDisplay');
const btnCopyCircleCode = document.getElementById('btnCopyCircleCode');
const btnShareWhatsApp = document.getElementById('btnShareWhatsApp');
const btnChangeCircle = document.getElementById('btnChangeCircle');
const btnFitBounds = document.getElementById('btnFitBounds');
const memberCount = document.getElementById('memberCount');
const membersListContainer = document.getElementById('membersList');

const btnRecenterMe = document.getElementById('btnRecenterMe');
const btnToggleLayer = document.getElementById('btnToggleLayer');
const alertToastContainer = document.getElementById('alertToastContainer');

// Modal de Famílias
const modalCircle = document.getElementById('modalCircle');
const btnCloseCircleModal = document.getElementById('btnCloseCircleModal');
const tabCreateFamily = document.getElementById('tabCreateFamily');
const tabJoinFamily = document.getElementById('tabJoinFamily');
const tabMyFamilies = document.getElementById('tabMyFamilies');
const panelCreateFamily = document.getElementById('panelCreateFamily');
const panelJoinFamily = document.getElementById('panelJoinFamily');
const panelMyFamilies = document.getElementById('panelMyFamilies');
const inputNewFamilyName = document.getElementById('inputNewFamilyName');
const btnActionCreateFamily = document.getElementById('btnActionCreateFamily');
const inputCircleCode = document.getElementById('inputCircleCode');
const btnActionJoinFamily = document.getElementById('btnActionJoinFamily');
const myFamiliesList = document.getElementById('myFamiliesList');

// Modal Menu do Usuário
const modalUserMenu = document.getElementById('modalUserMenu');
const btnCloseUserMenuModal = document.getElementById('btnCloseUserMenuModal');
const userMenuAvatar = document.getElementById('userMenuAvatar');
const userMenuName = document.getElementById('userMenuName');
const userMenuEmail = document.getElementById('userMenuEmail');
const btnActionLogout = document.getElementById('btnActionLogout');

// Modal Lugar Seguro
const modalPlace = document.getElementById('modalPlace');
const btnAddPlaceModal = document.getElementById('btnAddPlaceModal');
const inputPlaceName = document.getElementById('inputPlaceName');
const inputPlaceRadius = document.getElementById('inputPlaceRadius');
const btnSavePlaceModal = document.getElementById('btnSavePlaceModal');
const btnCancelPlaceModal = document.getElementById('btnCancelPlaceModal');
const btnClosePlaceModal = document.getElementById('btnClosePlaceModal');

// Modal Configurações
const modalSettings = document.getElementById('modalSettings');
const btnOpenSettings = document.getElementById('btnOpenSettings');
const cfgSupabaseUrl = document.getElementById('cfgSupabaseUrl');
const cfgSupabaseKey = document.getElementById('cfgSupabaseKey');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');

// ==============================================================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==============================================================================
async function initApp() {
  registerAuthGateEvents();
  registerEventListeners();

  // Monitor de Bateria
  initBatteryMonitor((battery) => {
    myBatteryValue.textContent = `${battery.level}% ${battery.isCharging ? '⚡' : ''}`;
  });

  // Checar se o usuário já tem sessão ativa no Supabase
  await checkSessionAndLock();

  // Escutar eventos de login/logout em tempo real
  onAuthStateChange(async (event, session) => {
    if (session?.user) {
      authenticatedUser = session.user;
      unlockAppForUser();
    } else {
      authenticatedUser = null;
      lockApp();
    }
  });

  // Checar código de convite na URL (?join=FAM-1234)
  checkUrlInvite();
}

/**
 * Bloqueia o aplicativo exigindo autenticação
 */
async function checkSessionAndLock() {
  authenticatedUser = await getCurrentUser();
  if (authenticatedUser) {
    unlockAppForUser();
  } else {
    lockApp();
  }
}

function lockApp() {
  stopTracking();
  authGate.classList.remove('hidden');
  appMain.classList.add('hidden');
}

async function unlockAppForUser() {
  authGate.classList.add('hidden');
  appMain.classList.remove('hidden');

  setupUserProfile();
  updateCircleUI();

  // Inicializar o mapa apenas após o login e visibilidade do DOM
  if (!mapInitialized) {
    initMap('map');
    mapInitialized = true;
  }

  // Conectar dados da família no Supabase
  await connectToSupabase();

  // Transmissão de GPS Always-On
  startContinuousTransmission();

  // Centralização inicial no mapa
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        panToLocation(pos.coords.latitude, pos.coords.longitude, 15);
      },
      () => {},
      { timeout: 4000 }
    );
  }
}

function setupUserProfile() {
  if (!authenticatedUser) return;

  const displayName = authenticatedUser.user_metadata?.name || authenticatedUser.email.split('@')[0];
  const email = authenticatedUser.email;
  const initial = displayName.charAt(0).toUpperCase();

  setUserName(displayName);
  setCustomUserId(authenticatedUser.id);

  inputMyName.value = displayName;
  myAvatarLetter.textContent = initial;
  userInitialBadge.textContent = initial;
  userEmailBadge.textContent = email;

  myAvatarRing.style.background = `linear-gradient(135deg, ${myColor}, #0284c7)`;

  userMenuAvatar.style.background = `linear-gradient(135deg, ${myColor}, #0284c7)`;
  userMenuAvatar.querySelector('span').textContent = initial;
  userMenuName.textContent = displayName;
  userMenuEmail.textContent = email;
}

function updateCircleUI() {
  headerCircleBadge.textContent = `${currentCircleName} ▾`;
  circleNameDisplay.textContent = currentCircleName;
  circleCodeDisplay.textContent = currentCircle;
  updateSheetQuickInfo();
}

function updateSheetQuickInfo() {
  if (sheetQuickStatus) {
    const count = membersMap.size;
    sheetQuickStatus.textContent = `${currentCircleName} • ${count} ${count === 1 ? 'membro' : 'membros'}`;
  }
}

async function connectToSupabase() {
  const client = getSupabase();
  if (!client) return;

  await loadInitialLocations();
  await loadPlaces();

  subscribeCircleLocations(currentCircle, handleIncomingLocation);
}

function checkUrlInvite() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('join') || params.get('code');
  if (invite) {
    inputCircleCode.value = invite.toUpperCase();
    if (authenticatedUser) {
      switchFamilyTab('join');
      modalCircle.classList.remove('hidden');
    }
  }
}

async function loadInitialLocations() {
  const locations = await fetchCircleLocations(currentCircle);
  locations.forEach((loc) => {
    handleIncomingLocation(loc);
  });
}

async function loadPlaces() {
  placesList = await fetchPlaces(currentCircle);
  renderPlaces(placesList);
  renderPlacesSidebar();
}

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

  const myId = getUserId();
  const isSelf = data.user_id === myId;
  membersMap.set(data.user_id, data);

  updateMemberMarker(data, isSelf);
  renderMembersList();
  updateSheetQuickInfo();

  if (isSelf) {
    updateTelemetryCard(data);
  }
}

function updateTelemetryCard(data) {
  mySpeedValue.textContent = `${data.speed || 0} km/h`;
  myAccuracyValue.textContent = `±${data.accuracy || 0} m`;
  myBatteryValue.textContent = `${data.battery_level || '--'}% ${data.is_charging ? '⚡' : ''}`;
  myHeadingValue.textContent = data.heading ? `${Math.round(data.heading)}°` : '--';
  myAltitudeValue.textContent = data.altitude ? `${Math.round(data.altitude)} m` : '-- m';
  myCoordsValue.textContent = `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
}

function renderMembersList() {
  const myId = getUserId();
  const otherMembers = Array.from(membersMap.values()).filter((m) => m.user_id !== myId);
  memberCount.textContent = otherMembers.length.toString();

  if (otherMembers.length === 0) {
    membersListContainer.innerHTML = `
      <div class="empty-state">
        <p>Nenhum outro membro transmitindo nesta família.</p>
        <small>Envie o código de convite para adicionar pessoas.</small>
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

  membersListContainer.querySelectorAll('.member-item').forEach((item) => {
    item.addEventListener('click', () => {
      const uId = item.getAttribute('data-userid');
      focusMember(uId);
      // No celular, fecha o bottom sheet para mostrar o membro no mapa
      if (window.innerWidth <= 768) {
        sidebarPanel.classList.remove('expanded');
      }
    });
  });
}

// ==============================================================================
// TRANSMISSÃO CONTÍNUA PERMANENTE (ALWAYS-ON ESTILO LIFE360)
// ==============================================================================
function startContinuousTransmission() {
  if (!authenticatedUser) return;
  if (isTrackingActive() && !isSimulating()) return;
  myTrackingStatus.textContent = 'Conectando ao satélite GPS...';

  startTracking(
    (pos) => {
      onPositionAcquired(pos, false);
      myTrackingStatus.textContent = 'GPS Transmitindo em Tempo Real';
      myTrackingStatus.classList.add('live');
      if (liveGpsText) liveGpsText.textContent = 'GPS Ao Vivo';
    },
    (err) => {
      console.warn('Aviso de GPS:', err.message);
      myTrackingStatus.textContent = 'Permissão GPS necessária';
      if (liveGpsText) liveGpsText.textContent = 'Aguardando GPS';
    }
  );
}

function onPositionAcquired(pos, isSimulated = false) {
  myTrackingStatus.textContent = isSimulated ? 'Simulando Deslocamento' : 'GPS Transmitindo em Tempo Real';
  myTrackingStatus.classList.add('live');
  if (liveGpsText) {
    liveGpsText.textContent = isSimulated ? 'Simulação Ao Vivo' : 'GPS Ao Vivo';
  }

  const payload = {
    circle_code: currentCircle,
    user_id: getUserId(),
    user_name: getUserName(),
    avatar_color: myColor,
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracy: pos.accuracy,
    speed: pos.speed,
    heading: pos.heading,
    altitude: pos.altitude,
    battery_level: pos.battery_level,
    is_charging: pos.is_charging,
    status: pos.status,
    updated_at: new Date().toISOString(),
  };

  broadcastAndSaveLocation(payload);
  handleIncomingLocation(payload);
  checkGeofences(pos.latitude, pos.longitude);
}

function toggleSimulation() {
  if (isSimulating()) {
    stopSimulatedTracking();
    btnSimulateRoute.textContent = '🚗 Simular Rota de Teste (PC)';
    showToast('Simulação encerrada. Retornando ao GPS.');
    startContinuousTransmission();
  } else {
    const center = getMapCenter();
    startSimulatedTracking(center.lat, center.lng, (pos) => {
      onPositionAcquired(pos, true);
    });
    btnSimulateRoute.textContent = '🛑 Parar Simulação';
    showToast('Simulação de trajeto iniciada no mapa!');
  }
}

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
// GESTÃO DE FAMÍLIAS
// ==============================================================================
function switchFamilyTab(tab) {
  tabCreateFamily.classList.remove('active');
  tabJoinFamily.classList.remove('active');
  tabMyFamilies.classList.remove('active');

  panelCreateFamily.classList.add('hidden');
  panelJoinFamily.classList.add('hidden');
  panelMyFamilies.classList.add('hidden');

  if (tab === 'create') {
    tabCreateFamily.classList.add('active');
    panelCreateFamily.classList.remove('hidden');
  } else if (tab === 'join') {
    tabJoinFamily.classList.add('active');
    panelJoinFamily.classList.remove('hidden');
  } else if (tab === 'my') {
    tabMyFamilies.classList.add('active');
    panelMyFamilies.classList.remove('hidden');
    renderMyFamiliesList();
  }
}

async function renderMyFamiliesList() {
  const families = await getUserFamilies(getUserId());
  if (families.length === 0) {
    myFamiliesList.innerHTML = `
      <div class="empty-state">
        <p>Você ainda não está registrado em nenhuma família.</p>
        <small>Crie uma nova família ou entre com um código de convite.</small>
      </div>
    `;
    return;
  }

  myFamiliesList.innerHTML = families
    .map(
      (f) => `
      <div class="family-select-item ${f.code === currentCircle ? 'active' : ''}" data-code="${f.code}" data-name="${f.name}">
        <div>
          <strong style="display:block; font-size:14px; color:#f8fafc;">${f.name}</strong>
          <span class="family-select-code">${f.code}</span>
        </div>
        <button class="btn btn-secondary btn-sm">${f.code === currentCircle ? 'Ativo' : 'Acessar'}</button>
      </div>
    `
    )
    .join('');

  myFamiliesList.querySelectorAll('.family-select-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const code = item.getAttribute('data-code');
      const name = item.getAttribute('data-name');
      await switchActiveCircle(code, name);
      modalCircle.classList.add('hidden');
    });
  });
}

async function switchActiveCircle(newCode, newName) {
  currentCircle = newCode;
  currentCircleName = newName;
  localStorage.setItem('sentinel_circle_code', newCode);
  localStorage.setItem('sentinel_circle_name', newName);

  updateCircleUI();
  membersMap.clear();
  await connectToSupabase();
  showToast(`Conectado à família "${newName}" (${newCode})!`);
}

function shareInviteWhatsApp() {
  const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${currentCircle}`;
  const message = `Olá! Estou compartilhando minha localização com você no Sentinel. Entre na minha família usando o código *${currentCircle}* ou acesse pelo link: ${inviteUrl}`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
}

// ==============================================================================
// AUTH GATEWAY (LOGIN, CADASTRO E TOKEN OBRIGATÓRIOS)
// ==============================================================================
function switchGateTab(tab) {
  gateTabLogin.classList.remove('active');
  gateTabRegister.classList.remove('active');
  gateTabVerify.classList.remove('active');

  gateFormLogin.classList.add('hidden');
  gateFormRegister.classList.add('hidden');
  gateFormVerify.classList.add('hidden');

  if (tab === 'login') {
    gateTabLogin.classList.add('active');
    gateFormLogin.classList.remove('hidden');
  } else if (tab === 'register') {
    gateTabRegister.classList.add('active');
    gateFormRegister.classList.remove('hidden');
  } else if (tab === 'verify') {
    gateTabVerify.classList.add('active');
    gateFormVerify.classList.remove('hidden');
  }
}

function registerAuthGateEvents() {
  gateTabLogin.addEventListener('click', () => switchGateTab('login'));
  gateTabRegister.addEventListener('click', () => switchGateTab('register'));
  gateTabVerify.addEventListener('click', () => switchGateTab('verify'));

  // Submit Login
  gateFormLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = gateLoginEmail.value.trim();
    const password = gateLoginPassword.value;

    try {
      showToast('Autenticando...');
      await signInUser(email, password);
      showToast('Login realizado com sucesso!');
    } catch (err) {
      alert(`Falha no login: ${err.message}`);
    }
  });

  // Submit Cadastro
  gateFormRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = gateRegName.value.trim();
    const email = gateRegEmail.value.trim();
    const password = gateRegPassword.value;

    try {
      showToast('Criando conta e enviando e-mail...');
      await signUpUser(name, email, password, myColor);
      gateVerifyEmail.value = email;
      switchGateTab('verify');
      showToast('Conta criada! Verifique o token recebido no seu e-mail.');
    } catch (err) {
      alert(`Erro no cadastro: ${err.message}`);
    }
  });

  // Submit Confirmação de Token
  gateFormVerify.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = gateVerifyEmail.value.trim();
    const token = gateVerifyToken.value.trim();

    try {
      showToast('Validando token...');
      await verifyEmailOtp(email, token);
      showToast('E-mail verificado! Acesso liberado.');
    } catch (err) {
      alert(`Token inválido: ${err.message}`);
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
  }, 6000);
}

function handleSosClick() {
  const confirmSos = confirm('Você deseja disparar um ALERTA DE EMERGÊNCIA SOS para todos os membros desta família?');
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

  showToast(`🚨 ALERTA SOS ENVIADO PARA A FAMÍLIA ${currentCircle}!`, true);

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
  btnSimulateRoute.addEventListener('click', toggleSimulation);
  btnSosAlert.addEventListener('click', handleSosClick);

  // Puxador touch para celular (Bottom Sheet)
  bottomSheetHandle.addEventListener('click', () => {
    sidebarPanel.classList.toggle('expanded');
  });

  // Garantir GPS contínuo ao focar ou reabrir
  window.addEventListener('focus', startContinuousTransmission);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startContinuousTransmission();
  });

  btnEditName.addEventListener('click', () => {
    const newName = inputMyName.value.trim();
    if (newName) {
      setUserName(newName);
      myAvatarLetter.textContent = newName.charAt(0).toUpperCase();
      userInitialBadge.textContent = newName.charAt(0).toUpperCase();
      showToast(`Nome salvo como "${newName}".`);
    }
  });

  btnCopyCircleCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCircle);
    showToast(`Código da Família (${currentCircle}) copiado!`);
  });

  btnShareWhatsApp.addEventListener('click', shareInviteWhatsApp);

  btnToggleLayer.addEventListener('click', () => {
    const layerName = toggleMapLayer();
    showToast(`Estilo de mapa: ${layerName}`);
  });

  btnRecenterMe.addEventListener('click', () => {
    const pos = getCurrentPosition();
    if (pos) {
      panToLocation(pos.latitude, pos.longitude, 16);
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((p) => {
        panToLocation(p.coords.latitude, p.coords.longitude, 16);
      });
    }
  });

  btnFitBounds.addEventListener('click', () => {
    fitAllMembers();
    if (window.innerWidth <= 768) {
      sidebarPanel.classList.remove('expanded');
    }
  });

  // Modal de Família
  headerCircleBadge.addEventListener('click', () => {
    switchFamilyTab('create');
    modalCircle.classList.remove('hidden');
  });

  btnChangeCircle.addEventListener('click', () => {
    switchFamilyTab('create');
    modalCircle.classList.remove('hidden');
  });

  btnCloseCircleModal.addEventListener('click', () => modalCircle.classList.add('hidden'));

  tabCreateFamily.addEventListener('click', () => switchFamilyTab('create'));
  tabJoinFamily.addEventListener('click', () => switchFamilyTab('join'));
  tabMyFamilies.addEventListener('click', () => switchFamilyTab('my'));

  btnActionCreateFamily.addEventListener('click', async () => {
    const familyName = inputNewFamilyName.value.trim();
    if (!familyName) {
      alert('Informe o nome da sua família (ex: Família Silva).');
      return;
    }

    try {
      showToast('Criando família e gerando código...');
      const newFamily = await createFamily(
        familyName,
        getUserId(),
        getUserName(),
        myColor
      );

      inputNewFamilyName.value = '';
      await switchActiveCircle(newFamily.code, newFamily.name);
      modalCircle.classList.add('hidden');
      showToast(`🎉 Família "${newFamily.name}" criada com código ${newFamily.code}!`);
    } catch (err) {
      alert(`Erro ao criar família: ${err.message}`);
    }
  });

  btnActionJoinFamily.addEventListener('click', async () => {
    const code = inputCircleCode.value.trim().toUpperCase();
    if (!code) {
      alert('Informe o código da família para entrar.');
      return;
    }

    try {
      showToast('Verificando código de convite...');
      const joinedCircle = await joinFamilyByCode(
        code,
        getUserId(),
        getUserName(),
        myColor
      );

      await switchActiveCircle(joinedCircle.code, joinedCircle.name);
      modalCircle.classList.add('hidden');
      showToast(`🎉 Você entrou na família "${joinedCircle.name}"!`);
    } catch (err) {
      alert(`Erro ao entrar na família: ${err.message}`);
    }
  });

  // Modal Menu do Usuário & Logout
  btnUserMenu.addEventListener('click', () => {
    modalUserMenu.classList.remove('hidden');
  });

  btnCloseUserMenuModal.addEventListener('click', () => modalUserMenu.classList.add('hidden'));

  btnActionLogout.addEventListener('click', async () => {
    modalUserMenu.classList.add('hidden');
    await signOutUser();
    showToast('Você saiu da sua conta.');
  });

  // Modal Lugar Seguro
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

  // Modal Configurações
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

document.addEventListener('DOMContentLoaded', initApp);
