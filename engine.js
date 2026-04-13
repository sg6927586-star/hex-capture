// DATA ENGINE — Run logging, XP system, area math, cloud sync
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// H3 Resolution 11 average hexagon area in m²
const HEX_AREA_M2 = 2149;

// ─── AREA MATH ───
export const hexesToArea = (count) => {
  const totalM2 = count * HEX_AREA_M2;
  const km2 = totalM2 / 1_000_000;
  if (totalM2 >= 1000) return { value: km2.toFixed(km2 >= 1 ? 2 : 3), unit: 'KM²' };
  return { value: Math.round(totalM2).toString(), unit: 'M²' };
};

export const hexesToRawKm2 = (count) => (count * HEX_AREA_M2) / 1_000_000;

// ─── DISTANCE FROM GPS PATH ───
export const pathDistanceKm = (pathCoords) => {
  let total = 0;
  for (let i = 1; i < pathCoords.length; i++) {
    total += haversine(pathCoords[i - 1], pathCoords[i]);
  }
  return total / 1000;
};

const haversine = (a, b) => {
  const R = 6371e3;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// ─── XP & LEVEL SYSTEM ───
export const computeRunXP = (hexesCaptured, donutHexes) => {
  return (hexesCaptured * 10) + (donutHexes * 25) + 50;
};

export const xpToLevel = (xp) => Math.max(1, Math.floor(Math.sqrt(xp / 100)));
export const xpForLevel = (level) => (level * level) * 100;

export const levelProgress = (xp) => {
  const lvl = xpToLevel(xp);
  const currentFloor = lvl <= 1 ? 0 : xpForLevel(lvl);
  const nextFloor = xpForLevel(lvl + 1);
  if (nextFloor <= currentFloor) return 0;
  return Math.max(0, Math.min(100, Math.round(((xp - currentFloor) / (nextFloor - currentFloor)) * 100)));
};

export const rankTitle = (level) => {
  if (level >= 51) return 'COMMANDER';
  if (level >= 31) return 'WARDEN';
  if (level >= 16) return 'STRIKER';
  if (level >= 6) return 'RECON';
  return 'SCOUT';
};

// ═══════════════════════════════════════════════════
// ─── CLOUD SYNC — TERRITORIES ───
// ═══════════════════════════════════════════════════

// Save captured hexes to Supabase (called after each run)
export const syncTerritoriesToCloud = async (hexIds) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = hexIds.map(hex_id => ({
      hex_id,
      user_id: user.id,
      captured_at: new Date().toISOString(),
    }));

    // Upsert = insert or update if hex already exists (steal territory)
    const { error } = await supabase.from('territories')
      .upsert(rows, { onConflict: 'hex_id' });

    if (error) console.warn('Territory sync error:', error.message);
  } catch (e) {
    console.warn('Territory sync failed:', e);
  }
};

// Load ALL territories from cloud (all players)
export const loadAllTerritories = async () => {
  try {
    const { data, error } = await supabase.from('territories')
      .select('hex_id, user_id');

    if (error) throw error;

    // Group by user_id
    const byUser = {};
    const allHexes = {};
    data.forEach(row => {
      allHexes[row.hex_id] = row.user_id;
      if (!byUser[row.user_id]) byUser[row.user_id] = 0;
      byUser[row.user_id]++;
    });

    return { allHexes, byUser, total: data.length };
  } catch (e) {
    console.warn('Load territories failed:', e);
    return { allHexes: {}, byUser: {}, total: 0 };
  }
};

// Load only YOUR hexes from cloud
export const loadMyTerritories = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase.from('territories')
      .select('hex_id')
      .eq('user_id', user.id);

    if (error) throw error;

    const hexMap = {};
    data.forEach(row => { hexMap[row.hex_id] = true; });
    return hexMap;
  } catch (e) {
    console.warn('Load my territories failed:', e);
    return {};
  }
};

// ═══════════════════════════════════════════════════
// ─── CLOUD SYNC — RUNS ───
// ═══════════════════════════════════════════════════

export const saveRun = async (runData) => {
  try {
    const xp = computeRunXP(runData.hexesCaptured, runData.donutHexes);
    const areaKm2 = hexesToRawKm2(runData.hexesCaptured + runData.donutHexes);

    const run = {
      id: `run_${Date.now()}`,
      timestamp: runData.startTime || new Date().toISOString(),
      duration: runData.duration,
      hexesCaptured: runData.hexesCaptured,
      donutHexes: runData.donutHexes,
      totalHexes: runData.hexesCaptured + runData.donutHexes,
      distanceKm: Math.round(runData.distanceKm * 10) / 10,
      areaKm2: Math.round(areaKm2 * 1000) / 1000,
      areaM2: (runData.hexesCaptured + runData.donutHexes) * HEX_AREA_M2,
      xpEarned: xp,
      donutTriggered: runData.donutHexes > 0,
    };

    // Save locally
    const existing = await loadRuns();
    existing.unshift(run);
    await AsyncStorage.setItem('run_history', JSON.stringify(existing));
    await updatePlayerStats(run);

    // Save to cloud
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('runs').insert({
          user_id: user.id,
          hexes_captured: run.hexesCaptured,
          donut_hexes: run.donutHexes,
          distance_km: run.distanceKm,
          duration: run.duration,
          xp_earned: run.xpEarned,
          started_at: run.timestamp,
        });
      }
    } catch (cloudErr) {
      console.warn('Cloud run save failed:', cloudErr);
    }

    return run;
  } catch (e) {
    console.warn('Failed to save run:', e);
    return null;
  }
};

export const loadRuns = async () => {
  try {
    const data = await AsyncStorage.getItem('run_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const loadPlayerStats = async () => {
  try {
    const data = await AsyncStorage.getItem('player_stats');
    if (data) return JSON.parse(data);
  } catch (e) {}
  return { totalRuns: 0, totalHexes: 0, totalDistanceKm: 0, totalAreaKm2: 0, totalXP: 0 };
};

const updatePlayerStats = async (run) => {
  try {
    const stats = await loadPlayerStats();
    stats.totalRuns += 1;
    stats.totalHexes += run.totalHexes;
    stats.totalDistanceKm = Math.round((stats.totalDistanceKm + run.distanceKm) * 10) / 10;
    stats.totalAreaKm2 = Math.round((stats.totalAreaKm2 + run.areaKm2) * 1000) / 1000;
    stats.totalXP += run.xpEarned;
    await AsyncStorage.setItem('player_stats', JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to update stats:', e);
  }
};

// ─── LEADERBOARD ───
export const loadLeaderboard = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Count hexes per user
    const { data: territories, error } = await supabase
      .from('territories')
      .select('user_id');

    if (error) throw error;

    // Aggregate hex counts
    const counts = {};
    territories.forEach(t => {
      counts[t.user_id] = (counts[t.user_id] || 0) + 1;
    });

    // Get all user IDs that have territory
    const userIds = Object.keys(counts);
    if (userIds.length === 0) return [];

    // Fetch usernames
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds);

    const nameMap = {};
    (profiles || []).forEach(p => { nameMap[p.id] = p.username; });

    // Build leaderboard sorted by hex count
    const board = userIds.map(uid => ({
      userId: uid,
      name: uid === user?.id ? 'YOU' : (nameMap[uid] || 'Unknown'),
      hexes: counts[uid],
      area: hexesToArea(counts[uid]),
      isYou: uid === user?.id,
    }));

    board.sort((a, b) => b.hexes - a.hexes);

    // Add rank
    board.forEach((entry, i) => { entry.rank = i + 1; });

    return board;
  } catch (e) {
    console.warn('Leaderboard load failed:', e);
    return [];
  }
};
