import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '../theme';
import { loadPlayerStats, xpToLevel, levelProgress, xpForLevel, rankTitle, hexesToArea, loadMyTerritories } from '../engine';
import { supabase } from '../supabase';

// Player profile & stats dashboard
export default function HudScreen() {
  const [stats, setStats] = useState({ totalRuns: 0, totalHexes: 0, totalDistanceKm: 0, totalAreaKm2: 0, totalXP: 0 });
  const [hexCount, setHexCount] = useState(0);
  const [username, setUsername] = useState('Player');
  const [userEmail, setUserEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await loadPlayerStats();
        setStats(s);
        try {
          const myCloudHexes = await loadMyTerritories();
          setHexCount(Object.keys(myCloudHexes).length);
        } catch (e) {}
        // Fetch username from Supabase
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserEmail(user.email || '');
            const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
            if (data?.username) setUsername(data.username);
            else setUsername(user.email?.split('@')[0] || 'Player');
          }
        } catch (e) {}
      })();
    }, [])
  );

  const level = xpToLevel(stats.totalXP);
  const rank = rankTitle(level);
  const progress = levelProgress(stats.totalXP);
  const nextLvlXP = xpForLevel(level + 1);
  const totalArea = hexesToArea(hexCount);

  // Combat power = total XP as a display number
  const combatPower = stats.totalXP.toLocaleString();
  // Agility score = runs completed (simple but meaningful)
  const agility = stats.totalRuns;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>PROFILE</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>

        {/* PROFILE CARD */}
        <View style={s.profileCard}>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: stats.totalRuns > 0 ? COLORS.success : COLORS.onSurfaceMuted }]} />
            <Text style={[s.statusLabel, { color: stats.totalRuns > 0 ? COLORS.success : COLORS.onSurfaceMuted }]}>
              {stats.totalRuns > 0 ? 'ACTIVE PLAYER' : 'NEW PLAYER — GO RUN!'}
            </Text>
          </View>
          <Text style={s.operativeName}>{username}</Text>
          <Text style={s.operativeLevel}>LVL {level} {rank}</Text>

          <View style={s.xpRow}>
            <Text style={s.xpLabel}>XP PROGRESS</Text>
            <View style={s.xpBarOuter}>
              <View style={[s.xpBarInner, { width: `${progress}%` }]} />
            </View>
            <Text style={s.xpPct}>{progress}%</Text>
          </View>
          <Text style={s.xpDetail}>{stats.totalXP} / {nextLvlXP} XP</Text>
        </View>

        {/* CORE METRICS — REAL DATA */}
        <Text style={s.sectionTitle}>YOUR STATS</Text>

        {[
          {
            icon: '⚡', label: 'TOTAL XP',
            value: combatPower,
            delta: stats.totalRuns > 0 ? `+${stats.totalXP > 0 ? Math.round((stats.totalXP / Math.max(stats.totalRuns, 1))) : 0} AVG/RUN` : 'NO DATA',
            deltaColor: stats.totalXP > 0 ? COLORS.success : COLORS.onSurfaceMuted,
          },
          {
            icon: '◈', label: 'RUNS COMPLETED',
            value: String(agility),
            delta: agility >= 10 ? 'TOP TIER' : agility >= 5 ? 'RISING' : 'ROOKIE',
            deltaColor: COLORS.primary,
          },
          {
            icon: '⬡', label: 'TERRITORY CONTROLLED',
            value: totalArea.value,
            delta: `${hexCount} HEXES · ${totalArea.unit}`,
            deltaColor: COLORS.onSurfaceMuted,
          },
        ].map((m, i) => (
          <View key={i} style={s.metricCard}>
            <View style={s.metricHeader}>
              <Text style={s.metricIcon}>{m.icon}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
            <View style={s.metricBody}>
              <Text style={s.metricValue}>{m.value}</Text>
              <Text style={[s.metricDelta, { color: m.deltaColor }]}>{m.delta}</Text>
            </View>
            <View style={s.statusIndicator} />
          </View>
        ))}

        {/* DISTANCE STATS */}
        <Text style={[s.sectionTitle, { marginTop: 18 }]}>DISTANCE</Text>
        <View style={s.fieldStatsRow}>
          <View style={s.fieldStatCard}>
            <Text style={s.fieldStatLabel}>TOTAL DISTANCE</Text>
            <Text style={s.fieldStatVal}>{stats.totalDistanceKm} KM</Text>
          </View>
          <View style={s.fieldStatCard}>
            <Text style={s.fieldStatLabel}>TOTAL RUNS</Text>
            <Text style={s.fieldStatVal}>{stats.totalRuns}</Text>
          </View>
        </View>

        {/* EQUIPPED LOADOUT — still mock but labeled clearly */}
        <View style={s.loadoutHeader}>
          <Text style={s.sectionTitle}>BADGES</Text>
          <Text style={s.manageLink}>COMING SOON</Text>
        </View>

        {[
          { name: 'First Steps', rarity: 'STARTER BADGE', rarityColor: COLORS.onSurfaceMuted, tag: 'Complete 5 runs', locked: level < 5 },
          { name: 'Territory King', rarity: 'RARE BADGE', rarityColor: COLORS.primary, tag: 'Capture 500+ hexes', locked: level < 10 },
          { name: 'Donut Master', rarity: 'LEGENDARY BADGE', rarityColor: COLORS.warning, tag: 'Trigger 10 donut holes', locked: level < 20 },
        ].map((item, i) => (
          <View key={i} style={[s.loadoutCard, item.locked && { opacity: 0.4 }]}>
            <View style={[s.loadoutIconWrap, { borderColor: item.rarityColor }]}>
              <Text style={s.loadoutIcon}>{item.locked ? '🔒' : '◉'}</Text>
            </View>
            <View style={s.loadoutInfo}>
              <Text style={s.loadoutName}>{item.name}</Text>
              <Text style={[s.loadoutRarity, { color: item.rarityColor }]}>{item.rarity}</Text>
              <Text style={s.loadoutTag}>{item.locked ? `UNLOCKS AT LVL ${[5, 10, 20][i]}` : item.tag}</Text>
            </View>
          </View>
        ))}

        {/* SIGN OUT */}
        <TouchableOpacity style={s.signOutBtn} onPress={() => {
          Alert.alert('Sign Out?', 'You will need to log in again.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
          ]);
        }} activeOpacity={0.8}>
          <Text style={s.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
        <Text style={s.emailLabel}>{userEmail}</Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },

  header: { paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingBottom: 16, paddingHorizontal: 22, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow },
  headerTitle: { fontFamily: FONTS.headBold, fontSize: 18, color: COLORS.primary, letterSpacing: 3 },

  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 20, paddingTop: 24 },

  // PROFILE
  profileCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 24, padding: 22, marginBottom: 28 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { fontFamily: FONTS.headBold, fontSize: 10, letterSpacing: 1.5 },
  operativeName: { fontFamily: FONTS.headBold, fontSize: 32, color: COLORS.onSurface, letterSpacing: -1, marginBottom: 4 },
  operativeLevel: { fontFamily: FONTS.headBold, fontSize: 12, color: COLORS.onSurfaceMuted, letterSpacing: 1.5, marginBottom: 18 },

  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpLabel: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurfaceMuted, letterSpacing: 1 },
  xpBarOuter: { flex: 1, height: 6, backgroundColor: COLORS.surfaceContainerHighest, borderRadius: 3 },
  xpBarInner: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  xpPct: { fontFamily: FONTS.headBold, fontSize: 11, color: COLORS.primary },
  xpDetail: { fontFamily: FONTS.bodyRegular, fontSize: 10, color: COLORS.onSurfaceMuted, marginTop: 6, textAlign: 'right' },

  // SECTION
  sectionTitle: { fontFamily: FONTS.headBold, fontSize: 12, color: COLORS.onSurfaceMuted, letterSpacing: 2, marginBottom: 14 },

  // METRIC CARD
  metricCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 20, padding: 18, marginBottom: 10, position: 'relative' },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metricIcon: { fontSize: 16, marginRight: 8, color: COLORS.primary },
  metricLabel: { fontFamily: FONTS.headBold, fontSize: 11, color: COLORS.onSurfaceMuted, letterSpacing: 1 },
  metricBody: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  metricValue: { fontFamily: FONTS.headBold, fontSize: 36, color: COLORS.onSurface, letterSpacing: -1.5 },
  metricDelta: { fontFamily: FONTS.bodyBold, fontSize: 13 },
  statusIndicator: { position: 'absolute', top: 14, right: 14, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.errorContainer },

  // FIELD STATS
  fieldStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  fieldStatCard: { flex: 1, backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16 },
  fieldStatLabel: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurfaceMuted, letterSpacing: 1.5, marginBottom: 6 },
  fieldStatVal: { fontFamily: FONTS.headBold, fontSize: 22, color: COLORS.primary, letterSpacing: -0.5 },

  // LOADOUT
  loadoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 18 },
  manageLink: { fontFamily: FONTS.headBold, fontSize: 10, color: COLORS.onSurfaceMuted, letterSpacing: 1 },
  loadoutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 20, padding: 16, marginBottom: 10 },
  loadoutIconWrap: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14, backgroundColor: COLORS.surfaceContainerHigh },
  loadoutIcon: { fontSize: 20, color: COLORS.primary },
  loadoutInfo: { flex: 1 },
  loadoutName: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.onSurface, marginBottom: 2 },
  loadoutRarity: { fontFamily: FONTS.headBold, fontSize: 10, letterSpacing: 1.5, marginBottom: 2 },
  loadoutTag: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.onSurfaceMuted },

  // SIGN OUT
  signOutBtn: { borderWidth: 1.5, borderColor: COLORS.errorContainer, borderRadius: 26, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  signOutText: { fontFamily: FONTS.headBold, fontSize: 13, color: COLORS.errorContainer, letterSpacing: 1 },
  emailLabel: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.onSurfaceMuted, textAlign: 'center', marginTop: 10 },
});
