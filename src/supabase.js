import { createClient } from '@supabase/supabase-js';

// Carrega das variáveis de ambiente ou do localStorage
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tsrlmvpnautpiubmsjow.supabase.co';
const DEFAULT_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kO2S_wWduJqPgf3IJA6N-g_4_BeKWke';

let supabaseClient = null;
let activeChannel = null;

export function getStoredConfig() {
  const url = localStorage.getItem('sentinel_supabase_url') || DEFAULT_URL;
  const key = localStorage.getItem('sentinel_supabase_key') || DEFAULT_KEY;
  return { url, key };
}

export function saveStoredConfig(url, key) {
  localStorage.setItem('sentinel_supabase_url', url.trim());
  localStorage.setItem('sentinel_supabase_key', key.trim());
  supabaseClient = null; // Força recriação
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const { url, key } = getStoredConfig();
  if (!url || !key) {
    console.warn('Supabase URL ou Key não configurados.');
    return null;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return supabaseClient;
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

// ==============================================================================
// AUTENTICAÇÃO COM SUPABASE AUTH (CADASTRO, LOGIN E TOKEN POR E-MAIL)
// ==============================================================================

export async function signUpUser(name, email, password, avatarColor) {
  const client = getSupabase();
  if (!client) throw new Error('Cliente Supabase não inicializado.');

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        avatar_color: avatarColor,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function verifyEmailOtp(email, token) {
  const client = getSupabase();
  if (!client) throw new Error('Cliente Supabase não inicializado.');

  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });

  if (error) throw error;
  return data;
}

export async function signInUser(email, password) {
  const client = getSupabase();
  if (!client) throw new Error('Cliente Supabase não inicializado.');

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
}

export async function getCurrentUser() {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

export function onAuthStateChange(callback) {
  const client = getSupabase();
  if (!client) return () => {};

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription.unsubscribe();
}

// ==============================================================================
// GESTÃO DE FAMÍLIAS / CÍRCULOS (CRIAR, ENTRAR COM CÓDIGO E LISTAR)
// ==============================================================================

/**
 * Cria uma nova família com código único
 */
export async function createFamily(name, createdByUserId, userName, avatarColor) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não conectado.');

  // Gerar código único e legível (ex: FAM-7492)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const code = `FAM-${randomNum}`;

  // 1. Inserir na tabela circles
  const { data: circleData, error: circleErr } = await client
    .from('circles')
    .insert({
      code,
      name,
      created_by: createdByUserId,
    })
    .select()
    .single();

  if (circleErr) throw circleErr;

  // 2. Adicionar o criador na tabela circle_members como admin
  await client.from('circle_members').insert({
    circle_code: code,
    user_id: createdByUserId,
    user_name: userName,
    avatar_color: avatarColor,
    role: 'admin',
  });

  return circleData;
}

/**
 * Entra em uma família existente utilizando o código de convite
 */
export async function joinFamilyByCode(circleCode, userId, userName, avatarColor) {
  const client = getSupabase();
  if (!client) throw new Error('Supabase não conectado.');

  const formattedCode = circleCode.trim().toUpperCase();

  // 1. Verificar se o círculo existe
  const { data: circle, error: findErr } = await client
    .from('circles')
    .select('*')
    .eq('code', formattedCode)
    .single();

  if (findErr || !circle) {
    throw new Error(`Família com o código "${formattedCode}" não foi encontrada.`);
  }

  // 2. Inserir ou atualizar na tabela circle_members
  const { error: memberErr } = await client
    .from('circle_members')
    .upsert({
      circle_code: formattedCode,
      user_id: userId,
      user_name: userName,
      avatar_color: avatarColor,
      role: 'member',
    }, {
      onConflict: 'circle_code,user_id',
    });

  if (memberErr) {
    console.warn('Aviso ao registrar membro:', memberErr.message);
  }

  return circle;
}

/**
 * Busca todas as famílias em que o usuário participa
 */
export async function getUserFamilies(userId) {
  const client = getSupabase();
  if (!client || !userId) return [];

  try {
    const { data, error } = await client
      .from('circle_members')
      .select('circle_code, role, circles ( code, name )')
      .eq('user_id', userId);

    if (error) return [];
    return data
      .map((item) => ({
        code: item.circle_code,
        name: item.circles?.name || item.circle_code,
        role: item.role,
      }))
      .filter((c) => c.code);
  } catch (err) {
    console.warn('Erro ao carregar famílias do usuário:', err);
    return [];
  }
}

// ==============================================================================
// LOCALIZAÇÃO EM TEMPO REAL E BANCO
// ==============================================================================

export function subscribeCircleLocations(circleCode, onLocationUpdate) {
  const client = getSupabase();
  if (!client) return null;

  if (activeChannel) {
    client.removeChannel(activeChannel);
  }

  const channel = client.channel(`circle:${circleCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: circleCode },
    },
  });

  // 1. Broadcast P2P (ultra-rápido)
  channel.on('broadcast', { event: 'location_ping' }, (payload) => {
    if (payload.payload) {
      onLocationUpdate(payload.payload);
    }
  });

  // 2. Mudanças no banco Postgres (INSERT / UPDATE)
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'locations',
      filter: `circle_code=eq.${circleCode}`,
    },
    (payload) => {
      if (payload.new) {
        onLocationUpdate(payload.new);
      }
    }
  );

  channel.subscribe((status) => {
    console.log(`[Supabase Realtime] Canal circle:${circleCode}:`, status);
  });

  activeChannel = channel;
  return channel;
}

export async function broadcastAndSaveLocation(locationData) {
  const client = getSupabase();
  if (!client) return;

  if (activeChannel) {
    activeChannel.send({
      type: 'broadcast',
      event: 'location_ping',
      payload: locationData,
    }).catch((err) => console.warn('Erro no broadcast:', err));
  }

  try {
    const { error } = await client
      .from('locations')
      .upsert({
        circle_code: locationData.circle_code,
        user_id: locationData.user_id,
        user_name: locationData.user_name,
        avatar_color: locationData.avatar_color,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        speed: locationData.speed,
        heading: locationData.heading,
        altitude: locationData.altitude,
        battery_level: locationData.battery_level,
        is_charging: locationData.is_charging,
        status: locationData.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'circle_code,user_id',
      });

    if (error) {
      console.warn('Aviso ao salvar localização no banco:', error.message);
    }

    const lastHistorySave = parseInt(sessionStorage.getItem('last_history_save') || '0', 10);
    const now = Date.now();
    if (now - lastHistorySave > 30000) {
      sessionStorage.setItem('last_history_save', now.toString());
      client.from('location_history').insert({
        circle_code: locationData.circle_code,
        user_id: locationData.user_id,
        user_name: locationData.user_name,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: locationData.speed,
        battery_level: locationData.battery_level,
      }).then();
    }
  } catch (err) {
    console.error('Falha na sincronização com Supabase:', err);
  }
}

export async function fetchCircleLocations(circleCode) {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('locations')
    .select('*')
    .eq('circle_code', circleCode);

  if (error) {
    console.warn('Erro ao carregar localizações:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchPlaces(circleCode) {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('places')
    .select('*')
    .eq('circle_code', circleCode)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function createPlace(circleCode, name, latitude, longitude, radiusMeters) {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('places')
    .insert({
      circle_code: circleCode,
      name,
      latitude,
      longitude,
      radius_meters: radiusMeters,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar lugar seguro:', error.message);
    throw error;
  }
  return data;
}

export async function triggerAlert(circleCode, userName, type, message, lat, lng) {
  const client = getSupabase();
  if (!client) return;

  if (activeChannel) {
    activeChannel.send({
      type: 'broadcast',
      event: 'sos_alert',
      payload: { circleCode, userName, type, message, lat, lng, time: new Date().toISOString() },
    }).catch(console.warn);
  }

  return client.from('alerts').insert({
    circle_code: circleCode,
    user_name: userName,
    type,
    message,
    latitude: lat,
    longitude: lng,
  });
}
