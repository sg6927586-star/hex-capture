import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS } from '../theme';
import { loadRuns, loadPlayerStats, hexesToArea } from '../engine';

// Stitch "OPERATIVE_LOG" — now with REAL run data
export default function LogsScreen() {
  const [runs, setRuns] = useState([]);
  const [stats, setStats] = useState({ totalRuns: 0, totalHexes: 0, totalDistanceKm: 0, totalAreaKm2: 0, totalXP: 0 });

  // Reload data every time this tab gets focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const r = await loadRuns();
        const s = await loadPlayerStats();
        setRuns(r);
        setStats(s);
      })();
    }, [])
  );

  const totalArea = hexesToArea(stats.totalHexes);

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const day = d.getDate();
      const mon = months[d.getMonth()];
      const year = d.getFullYear();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${day} ${mon} ${year} - ${h}:${m}`;
    } catch { return 'UNKNOWN'; }
  };

  const fmtDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>RUN HISTORY</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>

        {/* REAL SUMMARY STATS */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>TOTAL TERRITORY</Text>
            <View style={s.summaryValRow}>
              <Text style={s.summaryVal}>{totalArea.value}</Text>
              <Text style={s.summaryUnit}>{totalArea.unit}</Text>
            </View>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>OPERATIONAL RUNS</Text>
            <View style={s.summaryValRow}>
              <Text style={s.summaryVal}>{stats.totalRuns}</Text>
              <Text style={s.summaryUnit}>UNITS</Text>
            </View>
          </View>
        </View>

        {/* SECTION */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>RECENT ENGAGEMENTS</Text>
          <View style={s.sectionLine} />
        </View>

        {/* REAL RUN CARDS */}
        {runs.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>◎</Text>
            <Text style={s.emptyTitle}>NO OPERATIONS LOGGED</Text>
            <Text style={s.emptySub}>Go to the MAP tab and start your first run to begin capturing territory.</Text>
          </View>
        ) : (
          runs.map((run, i) => {
            const runArea = hexesToArea(run.totalHexes);
            return (
              <View key={run.id || i} style={s.runCard}>
                {/* Map thumbnail placeholder */}
                <View style={s.runMapThumb}>
                  <View style={s.runMapGrid}>
                    {[...Array(6)].map((_, j) => <View key={j} style={s.gridLine} />)}
                  </View>
                </View>

                {/* Run info */}
                <View style={s.runInfoRow}>
                  <View>
                    <Text style={s.runSector}>SECTOR {String(i + 1).padStart(2, '0')}</Text>
                    <Text style={s.runDate}>{formatDate(run.timestamp)}</Text>
                  </View>
                  <View style={[s.statusBadge, { borderColor: run.donutTriggered ? COLORS.primary : COLORS.success }]}>
                    <Text style={[s.statusText, { color: run.donutTriggered ? COLORS.primary : COLORS.success }]}>
                      {run.donutTriggered ? 'DONUT 🍩' : 'SUCCESS'}
                    </Text>
                  </View>
                </View>

                {/* Real metrics */}
                <View style={s.runMetrics}>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>DISTANCE</Text>
                    <View style={s.metricValRow}>
                      <Text style={s.metricVal}>{run.distanceKm}</Text>
                      <Text style={s.metricUnit}>KM</Text>
                    </View>
                  </View>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>GAINED</Text>
                    <View style={s.metricValRow}>
                      <Text style={s.metricVal}>{runArea.value}</Text>
                      <Text style={s.metricUnit}>{runArea.unit}</Text>
                    </View>
                  </View>
                  <View style={s.metric}>
                    <Text style={s.metricLabel}>XP</Text>
                    <Text style={[s.metricVal, { color: COLORS.success }]}>+{run.xpEarned}</Text>
                  </View>
                </View>

                {/* Duration bar */}
                <View style={s.durationRow}>
                  <Text style={s.durationLabel}>DURATION</Text>
                  <Text style={s.durationVal}>{fmtDuration(run.duration)}</Text>
                  <Text style={s.durationLabel}>  |  {run.totalHexes} HEXES</Text>
                </View>
              </View>
            );
          })
        )}

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

  // SUMMARY
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  summaryCard: { flex: 1 },
  summaryLabel: { fontFamily: FONTS.headBold, fontSize: 10, color: COLORS.onSurfaceMuted, letterSpacing: 1.5, marginBottom: 6 },
  summaryValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  summaryVal: { fontFamily: FONTS.headBold, fontSize: 38, color: COLORS.primary, letterSpacing: -2 },
  summaryUnit: { fontFamily: FONTS.headBold, fontSize: 13, color: COLORS.onSurfaceMuted, letterSpacing: 1 },

  // SECTION
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  sectionTitle: { fontFamily: FONTS.headBold, fontSize: 12, color: COLORS.onSurfaceMuted, letterSpacing: 2 },
  sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.surfaceContainerHighest },

  // EMPTY STATE
  emptyWrap: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 48, color: COLORS.surfaceContainerHighest, marginBottom: 16 },
  emptyTitle: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.onSurface, letterSpacing: 1, marginBottom: 8 },
  emptySub: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.onSurfaceMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // RUN CARD
  runCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 22, marginBottom: 16, overflow: 'hidden' },
  runMapThumb: { height: 90, backgroundColor: COLORS.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  runMapGrid: { width: '100%', height: '100%', opacity: 0.15 },
  gridLine: { height: 1, backgroundColor: COLORS.primary, marginVertical: 12, marginHorizontal: 20 },

  runInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  runSector: { fontFamily: FONTS.headBold, fontSize: 11, color: COLORS.primary, letterSpacing: 1.5, marginBottom: 4 },
  runDate: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.onSurface, letterSpacing: -0.3 },

  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: FONTS.headBold, fontSize: 10, letterSpacing: 1 },

  runMetrics: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, paddingTop: 4 },
  metric: {},
  metricLabel: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurfaceMuted, letterSpacing: 1, marginBottom: 4 },
  metricValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricVal: { fontFamily: FONTS.headBold, fontSize: 22, color: COLORS.onSurface, letterSpacing: -0.5 },
  metricUnit: { fontFamily: FONTS.headBold, fontSize: 11, color: COLORS.onSurfaceMuted, letterSpacing: 0.5 },

  durationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 16, paddingTop: 4 },
  durationLabel: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurfaceMuted, letterSpacing: 1 },
  durationVal: { fontFamily: FONTS.headBold, fontSize: 13, color: COLORS.onSurface, marginLeft: 6 },
});
