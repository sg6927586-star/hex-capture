import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, Alert, TouchableOpacity, LayoutAnimation, Platform, UIManager, Animated, Easing } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { latLngToCell, cellToBoundary, polygonToCells } from 'h3-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, HEX_RESOLUTION } from '../theme';
import { hexesToArea, pathDistanceKm, saveRun, syncTerritoriesToCloud, loadAllTerritories, loadLeaderboard } from '../engine';
import { supabase } from '../supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const haversine = (a, b) => {
  const R = 6371e3;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);

  const [appMode, setAppMode] = useState('home');
  const [homeTab, setHomeTab] = useState('leaderboard');
  const [sheetOpen, setSheetOpen] = useState(false);

  const [runPath, setRunPath] = useState([]);
  const [sessionHexes, setSessionHexes] = useState({});
  const [runDuration, setRunDuration] = useState(0);
  const [runStartTime, setRunStartTime] = useState(null);

  const [initialRegion, setInitialRegion] = useState(null);
  
  // Cloud data
  const [cloudHexes, setCloudHexes] = useState({}); // { hexId: userId }
  const [leaderboard, setLeaderboard] = useState([]);
  const [myUserId, setMyUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setHasPermissions(true);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);

      try {
        await AsyncStorage.removeItem('capturedHexes'); // Wipe old prototype hexes
      } catch (e) {}

      // Fetch cloud data
      try {
        const { allHexes } = await loadAllTerritories();
        setCloudHexes(allHexes);
        const lb = await loadLeaderboard();
        setLeaderboard(lb);
      } catch (e) { console.warn('Cloud sync failed', e); }

      // Get current position so map starts at your location
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setInitialRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        setLocation(pos.coords);
      } catch (e) { console.warn('Initial position failed', e); }
    })();
  }, []);

  useEffect(() => {
    if (appMode !== 'running') return;
    const iv = setInterval(() => setRunDuration(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [appMode]);

  const handleLocationChange = (e) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord || coord.latitude === 0) return;
    setLocation(coord);
    try {
      const h3 = latLngToCell(coord.latitude, coord.longitude, HEX_RESOLUTION);
      if (appMode === 'running') {
        setRunPath(p => [...p, coord]);
        if (!cloudHexes[h3] && !sessionHexes[h3]) {
          setSessionHexes(p => ({ ...p, [h3]: true }));
        }
      }
    } catch (err) { console.error('h3 error', err); }
  };

  const startRun = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAppMode('run_setup');
  };

  const cancelRun = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAppMode('home');
  };

  const beginTracking = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAppMode('running');
    setRunPath([]);
    setSessionHexes({});
    setRunDuration(0);
    setRunStartTime(new Date().toISOString());
  };

  const stopTracking = async () => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAppMode('home');

      let newCap = { ...sessionHexes };
      let donutCount = 0;

      if (runPath.length > 5) {
        const dist = haversine(runPath[0], runPath[runPath.length - 1]);
        if (dist < 50) {
          try {
            const poly = runPath.map(p => [p.latitude, p.longitude]);
            poly.push([...poly[0]]);
            const cells = polygonToCells(poly, HEX_RESOLUTION);
            // Only count cells that weren't already walked through
            cells.forEach(h => {
              if (!newCap[h]) donutCount++;
              newCap[h] = true;
            });
          } catch (e) { console.warn('Poly fill err', e); }
        }
      }

      // Local storage removed in favor of Supabase cloud sync

      const walkedHexes = Object.keys(sessionHexes).length;
      const totalCaptured = walkedHexes + donutCount;

      // SAVE RUN TO HISTORY (Local + Cloud)
      const distKm = pathDistanceKm(runPath);
      await saveRun({
        hexesCaptured: walkedHexes,
        donutHexes: donutCount,
        duration: runDuration,
        distanceKm: distKm,
        startTime: runStartTime,
      });

      // SYNC TERRITORIES TO CLOUD
      if (Object.keys(newCap).length > 0) {
        await syncTerritoriesToCloud(Object.keys(newCap));
        // Refresh cloud view
        const { allHexes } = await loadAllTerritories();
        setCloudHexes(allHexes);
        const lb = await loadLeaderboard();
        setLeaderboard(lb);
      }

      if (totalCaptured > 0) {
        const area = hexesToArea(totalCaptured);
        Alert.alert(
          'RUN COMPLETED!',
          `You captured ${totalCaptured} hexes (${area.value} ${area.unit}) this session.` +
          (donutCount > 0 ? `\n\n🍩 DONUT HOLE TRIGGERED!\nGranted ${donutCount} bonus enclosed hexes!` : '')
        );
      }

      setSessionHexes({});
      setRunPath([]);
      setRunDuration(0);
      setRunStartTime(null);
    } catch (err) {
      Alert.alert('Critical Engine Error', String(err));
      setAppMode('home');
    }
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Pulse animation for loading hex
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // LOADING — show until GPS is locked
  if (!hasPermissions || !initialRegion) {
    return (
      <View style={st.loadWrap}>
        <Animated.Text style={[st.loadHex, { opacity: pulseAnim }]}>⬡</Animated.Text>
        <Text style={st.loadText}>LOCKING GPS…</Text>
        <Text style={st.loadSub}>Finding your position</Text>
      </View>
    );
  }

  // Merge cloud hexes, local captured hexes, and active session hexes
  const allHexList = { ...cloudHexes };
  // (Legacy local hex logic removed)
  // Session hexes overlay everything
  Object.keys(sessionHexes).forEach(h => { allHexList[h] = myUserId; });

  // Calculate area and count based on ALL user's hexes (local + cloud + session)
  const hexCount = Object.values(allHexList).filter(uid => uid === myUserId).length;
  const totalArea = hexesToArea(hexCount);
  const sessionArea = hexesToArea(Object.keys(sessionHexes).length);

  const polygons = Object.keys(allHexList).map(id => {
    const isMine = allHexList[id] === myUserId;
    return (
      <Polygon key={id}
        coordinates={cellToBoundary(id).map(c => ({ latitude: c[0], longitude: c[1] }))}
        fillColor={isMine ? COLORS.mapGlowPrimary : 'rgba(255, 100, 100, 0.2)'}
        strokeColor={isMine ? COLORS.mapStrokePrimary : 'rgba(255, 100, 100, 0.4)'}
        strokeWidth={1.5}
      />
    );
  });

  const darkMap = [
    { elementType: 'geometry', stylers: [{ color: COLORS.surface }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: COLORS.surfaceContainerLow }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: COLORS.surfaceContainerHigh }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: COLORS.surfaceContainerHighest }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: COLORS.surfaceContainerLow }] },
  ];

  return (
    <View style={st.root}>
      <View style={st.sectorBar}>
        <Text style={st.sectorName}>HEX CAPTURE</Text>
        <Text style={st.sectorSignal}>(( • ))</Text>
      </View>

      <MapView style={st.map} customMapStyle={darkMap}
        initialRegion={initialRegion}
        showsUserLocation followsUserLocation onUserLocationChange={handleLocationChange}>
        {polygons}
      </MapView>

      {/* HOME */}
      {location && appMode === 'home' && (
        <View style={st.homeWrap}>
          {/* COLLAPSIBLE SHEET — only visible when sheetOpen */}
          {sheetOpen && (
            <View style={st.sheet}>
              <View style={st.tabRow}>
                <TouchableOpacity onPress={() => setHomeTab('leaderboard')}>
                  <Text style={[st.tabLabel, homeTab === 'leaderboard' && st.tabActive]}>LEADERBOARD</Text>
                  {homeTab === 'leaderboard' && <View style={st.tabLine} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setHomeTab('history')}>
                  <Text style={[st.tabLabel, homeTab === 'history' && st.tabActive]}>HISTORY</Text>
                  {homeTab === 'history' && <View style={st.tabLine} />}
                </TouchableOpacity>
              </View>

              {homeTab === 'leaderboard' ? (
                <View style={st.leaderWrap}>
                  {leaderboard.length === 0 ? (
                    <Text style={st.histPlaceholder}>No players found.</Text>
                  ) : (
                    leaderboard.slice(0, 5).map((p, i) => (
                      <View key={i} style={[st.lbRow, p.isYou && st.lbRowActive]}>
                        <View style={st.lbRankCircle}>
                          <Text style={st.lbRankNum}>{p.rank}</Text>
                        </View>
                        <View style={st.lbInfo}>
                          <Text style={st.lbName}>{p.name}</Text>
                          <Text style={st.lbLevel}>{p.hexes} HEXES</Text>
                        </View>
                        <View style={st.lbPts}>
                          <Text style={[st.lbPtsVal, p.isYou && { color: COLORS.primary }]}>{p.area.value}</Text>
                          <Text style={st.lbPtsLabel}>{p.area.unit}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View style={st.histWrap}>
                  <Text style={st.histPlaceholder}>Switch to RUNS tab for full run history.</Text>
                </View>
              )}
            </View>
          )}

          {/* BOTTOM BAR — always visible */}
          <View style={st.bottomBar}>
            <TouchableOpacity onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSheetOpen(!sheetOpen);
            }} activeOpacity={0.7}>
              <View style={st.dragBar} />
              <Text style={st.bbScore}>{totalArea.value} {totalArea.unit}</Text>
              <Text style={st.bbLabel}>{hexCount} HEXES CAPTURED</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.bbStartBtn} onPress={startRun} activeOpacity={0.85}>
              <Text style={st.bbStartText}>START RUN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TRACKING DASHBOARD */}
      {location && (appMode === 'run_setup' || appMode === 'running') && (
        <View style={st.dash}>
          <View style={st.dashHead}>
            <Text style={st.dashHeroVal}>
              {appMode === 'running' ? `${sessionArea.value}` : '0'} {sessionArea.unit}
            </Text>
            <Text style={st.dashHeroSub}>
              {appMode === 'running' ? '● ACTIVE RECORDING' : '○ WAITING FOR START…'}
            </Text>
          </View>

          <View style={st.dashStats}>
            {[
              { val: Object.keys(sessionHexes).length, label: 'HEXES' },
              { val: fmt(runDuration), label: 'DURATION' },
              { val: HEX_RESOLUTION, label: 'RES.' },
            ].map((s, i) => (
              <View key={i} style={st.dashStatCard}>
                <Text style={st.dashStatVal}>{s.val}</Text>
                <Text style={st.dashStatLbl}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={st.dashBtnRow}>
            {appMode === 'run_setup' && (
              <TouchableOpacity style={st.dashCancelBtn} onPress={cancelRun}>
                <Text style={st.dashCancelX}>✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[st.dashActionBtn, appMode === 'running' ? st.dashStopBtn : st.dashGoBtn]}
              onPress={appMode === 'running' ? stopTracking : beginTracking}
              activeOpacity={0.8}>
              <Text style={[st.dashActionTxt, appMode === 'running' && { color: COLORS.error }]}>
                {appMode === 'running' ? 'STOP RUN' : 'START TRACKING'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const { width: W } = Dimensions.get('window');
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  map: { width: W, height: '100%' },

  sectorBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: 'rgba(19,19,19,0.85)' },
  sectorName: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.primary, letterSpacing: 2 },
  sectorSignal: { fontFamily: FONTS.headBold, fontSize: 14, color: COLORS.primary },

  loadWrap: { flex: 1, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  loadHex: { fontSize: 64, color: COLORS.primary, marginBottom: 20 },
  loadText: { fontFamily: FONTS.headBold, color: COLORS.primary, fontSize: 18, letterSpacing: 3, marginBottom: 6 },
  loadSub: { fontFamily: FONTS.bodyRegular, color: COLORS.onSurfaceMuted, fontSize: 13 },

  homeWrap: { position: 'absolute', bottom: 0, width: '100%' },
  sheet: { marginHorizontal: 10, backgroundColor: COLORS.surfaceContainerLow, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10, shadowColor: COLORS.primary, shadowOpacity: 0.08, shadowRadius: 20, elevation: 12 },

  tabRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 16 },
  tabLabel: { fontFamily: FONTS.headBold, fontSize: 13, color: COLORS.surfaceContainerHighest, letterSpacing: 1.5 },
  tabActive: { color: COLORS.onSurface },
  tabLine: { height: 2, backgroundColor: COLORS.primary, marginTop: 6, borderRadius: 1 },

  leaderWrap: { gap: 10, paddingBottom: 8 },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerHigh, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14 },
  lbRowActive: { borderWidth: 1, borderColor: 'rgba(0,240,255,0.2)' },
  lbRankCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  lbRankNum: { fontFamily: FONTS.headBold, color: COLORS.primary, fontSize: 14 },
  lbInfo: { flex: 1 },
  lbName: { fontFamily: FONTS.headBold, color: COLORS.onSurface, fontSize: 15, letterSpacing: 0.5 },
  lbLevel: { fontFamily: FONTS.bodyRegular, color: COLORS.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  lbPts: { alignItems: 'flex-end' },
  lbPtsVal: { fontFamily: FONTS.headBold, color: COLORS.onSurface, fontSize: 17 },
  lbPtsLabel: { fontFamily: FONTS.headBold, color: COLORS.onSurfaceMuted, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  histWrap: { paddingVertical: 30, alignItems: 'center' },
  histPlaceholder: { fontFamily: FONTS.bodyRegular, color: COLORS.onSurfaceMuted, fontStyle: 'italic' },

  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLow, paddingHorizontal: 24, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 12 : 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  dragBar: { width: 36, height: 4, backgroundColor: COLORS.surfaceContainerHighest, borderRadius: 2, marginBottom: 10 },
  bbScore: { fontFamily: FONTS.headBold, fontSize: 24, color: COLORS.primary, letterSpacing: -1 },
  bbLabel: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurface, letterSpacing: 1.5, marginTop: 2 },
  bbStartBtn: { backgroundColor: COLORS.error, paddingVertical: 15, paddingHorizontal: 34, borderRadius: 28, shadowColor: COLORS.error, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  bbStartText: { fontFamily: FONTS.headBold, fontSize: 15, color: '#FFFFFF', letterSpacing: 1 },

  dash: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: COLORS.surfaceContainerLow, borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingTop: 28, paddingBottom: Platform.OS === 'ios' ? 40 : 28, paddingHorizontal: 22, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowOffset: { width: 0, height: -8 }, shadowRadius: 24, elevation: 20 },
  dashHead: { alignItems: 'center', marginBottom: 24 },
  dashHeroVal: { fontFamily: FONTS.headBold, fontSize: 42, color: COLORS.onSurface, letterSpacing: -2 },
  dashHeroSub: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.primary, letterSpacing: 1, marginTop: 4 },

  dashStats: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dashStatCard: { flex: 1, alignItems: 'center', backgroundColor: COLORS.surfaceContainerHigh, borderRadius: 16, paddingVertical: 14 },
  dashStatVal: { fontFamily: FONTS.headBold, fontSize: 24, color: COLORS.primary, letterSpacing: -0.5 },
  dashStatLbl: { fontFamily: FONTS.headBold, fontSize: 9, color: COLORS.onSurface, letterSpacing: 1, marginTop: 4 },

  dashBtnRow: { flexDirection: 'row', alignItems: 'center' },
  dashCancelBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dashCancelX: { fontFamily: FONTS.headBold, fontSize: 18, color: COLORS.onSurface },
  dashActionBtn: { flex: 1, paddingVertical: 17, borderRadius: 28, alignItems: 'center' },
  dashGoBtn: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },
  dashStopBtn: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.error },
  dashActionTxt: { fontFamily: FONTS.headBold, fontSize: 16, color: COLORS.primaryDark, letterSpacing: 1 },
});
