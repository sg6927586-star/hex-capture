import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, HEX_RESOLUTION } from '../theme';
import { loadPlayerStats, hexesToArea } from '../engine';

export default function SystemScreen() {
  const [hexCount, setHexCount] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [totalXP, setTotalXP] = useState(0);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const stored = await AsyncStorage.getItem('capturedHexes');
          if (stored) setHexCount(Object.keys(JSON.parse(stored)).length);
          const stats = await loadPlayerStats();
          setRunCount(stats.totalRuns);
          setTotalXP(stats.totalXP);
        } catch (e) {}
      })();
    }, [])
  );

  const clearTerritory = () => {
    Alert.alert('Clear All Territory?', 'This will wipe your entire hex map. You cannot undo this.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('capturedHexes');
          setHexCount(0);
          Alert.alert('Done', 'All territory has been cleared.');
        }
      },
    ]);
  };

  const clearHistory = () => {
    Alert.alert('Clear Run History?', 'This will delete all your past runs and reset your XP to 0.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem('run_history');
          await AsyncStorage.removeItem('player_stats');
          setRunCount(0);
          setTotalXP(0);
          Alert.alert('Done', 'Run history and XP have been reset.');
        }
      },
    ]);
  };

  const clearEverything = () => {
    Alert.alert('⚠ Delete ALL Data?', 'This will erase your territory, run history, XP — everything. Start completely fresh.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Everything', style: 'destructive', onPress: async () => {
          await AsyncStorage.clear();
          setHexCount(0);
          setRunCount(0);
          setTotalXP(0);
          Alert.alert('Done', 'All data has been wiped. You are starting fresh.');
        }
      },
    ]);
  };

  const area = hexesToArea(hexCount);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>

        {/* CURRENT DATA */}
        <Text style={s.sectionLabel}>YOUR DATA</Text>
        <View style={s.dataCard}>
          <View style={s.dataRow}>
            <Text style={s.dataKey}>Territory</Text>
            <Text style={s.dataVal}>{hexCount} hexes · {area.value} {area.unit}</Text>
          </View>
          <View style={s.dataRow}>
            <Text style={s.dataKey}>Runs Completed</Text>
            <Text style={s.dataVal}>{runCount}</Text>
          </View>
          <View style={s.dataRow}>
            <Text style={s.dataKey}>Total XP</Text>
            <Text style={s.dataVal}>{totalXP.toLocaleString()}</Text>
          </View>
          <View style={[s.dataRow, { borderBottomWidth: 0 }]}>
            <Text style={s.dataKey}>Hex Resolution</Text>
            <Text style={s.dataVal}>Level {HEX_RESOLUTION} (~48m per hex)</Text>
          </View>
        </View>

        {/* ACTIONS */}
        <Text style={s.sectionLabel}>MANAGE</Text>

        <TouchableOpacity style={s.actionBtn} onPress={clearTerritory} activeOpacity={0.8}>
          <Text style={s.actionIcon}>🗺</Text>
          <View style={s.actionInfo}>
            <Text style={s.actionTitle}>Clear All Territory</Text>
            <Text style={s.actionSub}>Wipe the hex map and start capturing fresh</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} onPress={clearHistory} activeOpacity={0.8}>
          <Text style={s.actionIcon}>📋</Text>
          <View style={s.actionInfo}>
            <Text style={s.actionTitle}>Clear Run History</Text>
            <Text style={s.actionSub}>Delete past runs and reset your XP to 0</Text>
          </View>
          <Text style={s.actionChev}>›</Text>
        </TouchableOpacity>

        {/* DANGER ZONE */}
        <Text style={[s.sectionLabel, { color: COLORS.errorContainer, marginTop: 30 }]}>DANGER ZONE</Text>

        <TouchableOpacity style={[s.actionBtn, { borderWidth: 1, borderColor: COLORS.errorContainer }]} onPress={clearEverything} activeOpacity={0.8}>
          <Text style={s.actionIcon}>⚠</Text>
          <View style={s.actionInfo}>
            <Text style={[s.actionTitle, { color: COLORS.errorContainer }]}>Delete All Data</Text>
            <Text style={s.actionSub}>Erase everything — territory, runs, XP, all of it</Text>
          </View>
          <Text style={[s.actionChev, { color: COLORS.errorContainer }]}>›</Text>
        </TouchableOpacity>

        {/* APP INFO */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Hex Capture</Text>
          <Text style={s.infoSub}>v1.0 · H3 Resolution {HEX_RESOLUTION} · Local Storage</Text>
        </View>

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

  sectionLabel: { fontFamily: FONTS.headBold, fontSize: 11, color: COLORS.onSurfaceMuted, letterSpacing: 2, marginBottom: 12 },

  // DATA CARD
  dataCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 20, padding: 18, marginBottom: 28 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerHigh },
  dataKey: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.onSurface },
  dataVal: { fontFamily: FONTS.headBold, fontSize: 14, color: COLORS.primary },

  // ACTION BUTTONS
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 18, padding: 18, marginBottom: 10 },
  actionIcon: { fontSize: 22, marginRight: 14 },
  actionInfo: { flex: 1 },
  actionTitle: { fontFamily: FONTS.headBold, fontSize: 15, color: COLORS.onSurface, marginBottom: 3 },
  actionSub: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.onSurfaceMuted },
  actionChev: { fontFamily: FONTS.headBold, fontSize: 24, color: COLORS.onSurfaceMuted },

  // APP INFO
  infoCard: { alignItems: 'center', paddingVertical: 30, marginTop: 20 },
  infoTitle: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.onSurfaceMuted, letterSpacing: 1, marginBottom: 4 },
  infoSub: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.surfaceContainerHighest },
});
