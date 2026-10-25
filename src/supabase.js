import { createClient } from '@supabase/supabase-js';

// Carrega das variáveis de ambiente ou do localStorage (permitindo configuração direta no app)
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

/**
 * Assina atualizações em tempo real das localizações de um círculo
 */
export function subscribeCircleLocations(circleCode, onLocationUpdate) {
  const client = getSupabase();
  if (!client) return null;

  if (activeChannel) {
    client.removeChannel(activeChannel);
  }

  // Canal Realtime para o círculo específico
  const channel = client.channel(`circle:${circleCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: circleCode },
    },
  });

  // 1. Ouvir Broadcast P2P (ultra-rápido, latência de ~50ms)
  channel.on('broadcast', { event: 'location_ping' }, (payload) => {
    if (payload.payload) {
      onLocationUpdate(payload.payload);
    }
  });

  // 2. Ouvir mudanças no banco Postgres (INSERT / UPDATE)
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
    console.log(`[Supabase Realtime] Status do canal circle:${circleCode}:`, status);
  });

  activeChannel = channel;
  return channel;
}

/**
 * Transmite a localização via broadcast instantâneo e persiste na tabela locations
 */
export async function broadcastAndSaveLocation(locationData) {
  const client = getSupabase();
  if (!client) return;

  // 1. Transmitir via WebSocket Broadcast para membros conectados
  if (activeChannel) {
    activeChannel.send({
      type: 'broadcast',
      event: 'location_ping',
      payload: locationData,
    }).catch((err) => console.warn('Erro no broadcast:', err));
  }

  // 2. Persistir no banco de dados Supabase
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
        battery_level: locationData.battery_level,
        is_charging: locationData.is_charging,
        status: locationData.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'circle_code,user_id',
      });

    if (error) {
      console.warn('Erro ao salvar localização no banco:', error.message);
    }

    // 3. Salvar no histórico periodicamente (a cada 30 segundos)
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

/**
 * Busca todas as localizações ativas do círculo
 */
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

/**
 * Busca os Lugares Seguros (Geofences)
 */
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

/**
 * Adiciona um novo Lugar Seguro
 */
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

/**
 * Envia um Alerta / SOS para o círculo
 */
export async function triggerAlert(circleCode, userName, type, message, lat, lng) {
  const client = getSupabase();
  if (!client) return;

  // Broadcast imediato
  if (activeChannel) {
    activeChannel.send({
      type: 'broadcast',
      event: 'sos_alert',
      payload: { circleCode, userName, type, message, lat, lng, time: new Date().toISOString() },
    }).catch(console.warn);
  }

  // Grava na tabela de alertas
  return client.from('alerts').insert({
    circle_code: circleCode,
    user_name: userName,
    type,
    message,
    latitude: lat,
    longitude: lng,
  });
}
