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

// Elementos do DOM
const globalStatusDot = document.getElementById('globalStatusDot');
const globalStatusText = document.getElementById('globalStatusText');
const liveGpsBadge = document.getElementById('liveGpsBadge');
const liveGpsText = document.getElementById('liveGpsText');
const btnSosAlert = document.getElementById('btnSosAlert');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const sidebarPanel = document.getElementById('sidebarPanel');

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

// Modal de Autenticação
const btnOpenAuth = document.getElementById('btnOpenAuth');
const authButtonLabel = document.getElementById('authButtonLabel');
const modalAuth = document.getElementById('modalAuth');
const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const tabVerify = document.getElementById('tabVerify');
const formLogin = document.getElementById('formLogin');
const formRegister = document.getElementById('formRegister');
const formVerify = document.getElementById('formVerify');
const panelLoggedIn = document.getElementById('panelLoggedIn');
const loggedUserDisplay = document.getElementById('loggedUserDisplay');
const btnLogoutUser = document.getElementById('btnLogoutUser');

// Inputs de Auth
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const regName = document.getElementById('regName');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const verifyEmail = document.getElementById('verifyEmail');
const verifyToken = document.getElementById('verifyToken');

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
// INICIALIZAÇÃO
// ==============================================================================
async function initApp() {
  initMap('map');
  setupLocalProfile();

  initBatteryMonitor((battery) => {
    myBatteryValue.textContent = `${battery.level}% ${battery.isCharging ? '⚡' : ''}`;
  });

  await connectToSupabase();
  await checkAuthStatus();
  registerEventListeners();

  // Checar se há código de convite na URL (?join=FAM-1234)
  checkUrlInvite();

  // Iniciar transmissão automática contínua (Always-On estilo Life360)
  startContinuousTransmission();

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

function setupLocalProfile() {
  const name = getUserName();
  inputMyName.value = name;
  myAvatarLetter.textContent = name.charAt(0).toUpperCase();
  myAvatarRing.style.background = `linear-gradient(135deg, ${myColor}, #0284c7)`;
  updateCircleUI();
}

function updateCircleUI() {
  headerCircleBadge.textContent = `${currentCircleName} ▾`;
  circleNameDisplay.textContent = currentCircleName;
  circleCodeDisplay.textContent = currentCircle;
}

async function connectToSupabase() {
  const client = getSupabase();
  if (!client) {
    globalStatusDot.className = 'status-indicator-dot offline';
    globalStatusText.textContent = 'Configuração do Supabase pendente';
    return;
  }

  globalStatusDot.className = 'status-indicator-dot online';
  globalStatusText.textContent = 'Supabase Conectado (Tempo Real Ativo)';

  await loadInitialLocations();
  await loadPlaces();

  subscribeCircleLocations(currentCircle, handleIncomingLocation);
}

async function checkAuthStatus() {
  authenticatedUser = await getCurrentUser();
  updateAuthUI();

  onAuthStateChange((event, session) => {
    authenticatedUser = session?.user || null;
    updateAuthUI();
  });
}

function updateAuthUI() {
  if (authenticatedUser) {
    const displayName = authenticatedUser.user_metadata?.name || authenticatedUser.email.split('@')[0];
    authButtonLabel.textContent = displayName;
    userEmailBadge.textContent = authenticatedUser.email;
    userEmailBadge.classList.remove('hidden');
    inputMyName.value = displayName;
    myAvatarLetter.textContent = displayName.charAt(0).toUpperCase();
    setUserName(displayName);
    setCustomUserId(authenticatedUser.id);
  } else {
    authButtonLabel.textContent = 'Entrar / Cadastrar';
    userEmailBadge.classList.add('hidden');
  }
}

// Verifica se foi aberto com link de convite: ex ?join=FAM-7892
function checkUrlInvite() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('join') || params.get('code');
  if (invite) {
    inputCircleCode.value = invite.toUpperCase();
    switchFamilyTab('join');
    modalCircle.classList.remove('hidden');
    showToast(`Convite para a família ${invite.toUpperCase()} detectado! Clique em "Entrar na Família".`);
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
    });
  });
}

// ==============================================================================
// TRANSMISSÃO CONTÍNUA PERMANENTE (ALWAYS-ON ESTILO LIFE360)
// ==============================================================================
function startContinuousTransmission() {
  if (isTrackingActive() && !isSimulating()) return;
  myTrackingStatus.textContent = 'Conectando ao satélite GPS...';

  startTracking(
    (pos) => {
      onPositionAcquired(pos, false);
      myTrackingStatus.textContent = 'GPS Transmitindo em Tempo Real';
      myTrackingStatus.classList.add('live');
      if (liveGpsText) liveGpsText.textContent = 'GPS Transmitindo Ao Vivo';
    },
    (err) => {
      console.warn('Aviso de GPS:', err.message);
      myTrackingStatus.textContent = 'Aguardando permissão de GPS...';
      if (liveGpsText) liveGpsText.textContent = 'Permissão GPS Necessária';
    }
  );
}

function onPositionAcquired(pos, isSimulated = false) {
  myTrackingStatus.textContent = isSimulated ? 'Simulando Deslocamento' : 'GPS Transmitindo em Tempo Real';
  myTrackingStatus.classList.add('live');
  if (liveGpsText) {
    liveGpsText.textContent = isSimulated ? 'Simulação de Rota Ao Vivo' : 'GPS Transmitindo Ao Vivo';
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
    btnSimulateRoute.textContent = '🚗 Simular Rota de Teste';
    showToast('Simulação encerrada. Retornando ao GPS nativo.');
    startContinuousTransmission();
  } else {
    const center = getMapCenter();
    startSimulatedTracking(center.lat, center.lng, (pos) => {
      onPositionAcquired(pos, true);
    });
    btnSimulateRoute.textContent = '🛑 Parar Simulação';
    showToast('Simulação de trajeto iniciada! Veja seu marcador se mover.');
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
// GESTÃO DE FAMÍLIAS (ABAS, CRIAÇÃO E CONVITES)
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

// Compartilhar convite no WhatsApp
function shareInviteWhatsApp() {
  const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${currentCircle}`;
  const message = `Olá! Estou compartilhando minha localização com você no Sentinel. Entre na minha família usando o código *${currentCircle}* ou acesse diretamente pelo link: ${inviteUrl}`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
}

// ==============================================================================
// GESTÃO DE AUTENTICAÇÃO
// ==============================================================================
function switchAuthTab(tab) {
  tabLogin.classList.remove('active');
  tabRegister.classList.remove('active');
  tabVerify.classList.remove('active');

  formLogin.classList.add('hidden');
  formRegister.classList.add('hidden');
  formVerify.classList.add('hidden');
  panelLoggedIn.classList.add('hidden');

  if (authenticatedUser) {
    panelLoggedIn.classList.remove('hidden');
    loggedUserDisplay.textContent = authenticatedUser.email;
    return;
  }

  if (tab === 'login') {
    tabLogin.classList.add('active');
    formLogin.classList.remove('hidden');
  } else if (tab === 'register') {
    tabRegister.classList.add('active');
    formRegister.classList.remove('hidden');
  } else if (tab === 'verify') {
    tabVerify.classList.add('active');
    formVerify.classList.remove('hidden');
  }
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

  // Garantir que a transmissão continue ativa quando voltar à janela
  window.addEventListener('focus', startContinuousTransmission);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startContinuousTransmission();
  });

  btnToggleSidebar.addEventListener('click', () => {
    sidebarPanel.classList.toggle('open');
  });

  btnEditName.addEventListener('click', () => {
    const newName = inputMyName.value.trim();
    if (newName) {
      setUserName(newName);
      myAvatarLetter.textContent = newName.charAt(0).toUpperCase();
      showToast(`Nome salvo como "${newName}".`);
    }
  });

  btnCopyCircleCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCircle);
    showToast(`Código da Família (${currentCircle}) copiado para a área de transferência!`);
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

  // Ação: Criar Nova Família
  btnActionCreateFamily.addEventListener('click', async () => {
    const familyName = inputNewFamilyName.value.trim();
    if (!familyName) {
      alert('Por favor, informe o nome da sua família (ex: Família Silva).');
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
      showToast(`🎉 Família "${newFamily.name}" criada com o código ${newFamily.code}! Compartilhe este código.`);
    } catch (err) {
      alert(`Erro ao criar família: ${err.message}`);
    }
  });

  // Ação: Entrar na Família com Código
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
      showToast(`🎉 Você agora faz parte da família "${joinedCircle.name}"!`);
    } catch (err) {
      alert(`Erro ao entrar na família: ${err.message}`);
    }
  });

  // Autenticação Modal
  btnOpenAuth.addEventListener('click', () => {
    switchAuthTab('login');
    modalAuth.classList.remove('hidden');
  });

  btnCloseAuthModal.addEventListener('click', () => modalAuth.classList.add('hidden'));

  tabLogin.addEventListener('click', () => switchAuthTab('login'));
  tabRegister.addEventListener('click', () => switchAuthTab('register'));
  tabVerify.addEventListener('click', () => switchAuthTab('verify'));

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      showToast('Entrando...');
      await signInUser(email, password);
      modalAuth.classList.add('hidden');
      showToast('Login realizado com sucesso!');
    } catch (err) {
      alert(`Erro no login: ${err.message}`);
    }
  });

  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = regName.value.trim();
    const email = regEmail.value.trim();
    const password = regPassword.value;

    try {
      showToast('Cadastrando e enviando e-mail...');
      await signUpUser(name, email, password, myColor);
      verifyEmail.value = email;
      switchAuthTab('verify');
      showToast('Conta criada! Verifique o token enviado para o seu e-mail.');
    } catch (err) {
      alert(`Erro no cadastro: ${err.message}`);
    }
  });

  formVerify.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = verifyEmail.value.trim();
    const token = verifyToken.value.trim();

    try {
      showToast('Validando token...');
      await verifyEmailOtp(email, token);
      modalAuth.classList.add('hidden');
      showToast('E-mail e conta confirmados com sucesso!');
    } catch (err) {
      alert(`Token inválido ou expirado: ${err.message}`);
    }
  });

  btnLogoutUser.addEventListener('click', async () => {
    await signOutUser();
    modalAuth.classList.add('hidden');
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
