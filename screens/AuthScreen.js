import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Platform, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { supabase } from '../supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Missing fields', 'Enter your email and password.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  const handleSignup = async () => {
    if (!email || !password) return Alert.alert('Missing fields', 'Enter your email and password.');
    if (password.length < 6) return Alert.alert('Weak password', 'Password must be at least 6 characters.');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Signup failed', error.message);
      return;
    }
    // Save username to profiles table
    if (data.user && username) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: username || email.split('@')[0],
      });
    }
    // Auto-login after signup
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) {
      Alert.alert('Account created!', 'Please switch to Login and sign in.');
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.inner}>
        {/* LOGO */}
        <Text style={s.hexIcon}>⬡</Text>
        <Text style={s.title}>HEX CAPTURE</Text>
        <Text style={s.subtitle}>Territory conquest starts here</Text>

        {/* TOGGLE */}
        <View style={s.toggleRow}>
          <TouchableOpacity onPress={() => setMode('login')} style={[s.toggleBtn, mode === 'login' && s.toggleActive]}>
            <Text style={[s.toggleText, mode === 'login' && s.toggleTextActive]}>LOGIN</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('signup')} style={[s.toggleBtn, mode === 'signup' && s.toggleActive]}>
            <Text style={[s.toggleText, mode === 'signup' && s.toggleTextActive]}>SIGN UP</Text>
          </TouchableOpacity>
        </View>

        {/* FORM */}
        {mode === 'signup' && (
          <TextInput
            style={s.input}
            placeholder="Username"
            placeholderTextColor={COLORS.onSurfaceMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={COLORS.onSurfaceMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={COLORS.onSurfaceMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* SUBMIT */}
        <TouchableOpacity
          style={s.submitBtn}
          onPress={mode === 'login' ? handleLogin : handleSignup}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.primaryDark} />
          ) : (
            <Text style={s.submitText}>{mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT'}</Text>
          )}
        </TouchableOpacity>

        <Text style={s.footer}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <Text style={s.footerLink} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Sign up' : 'Login'}
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },

  hexIcon: { fontSize: 56, color: COLORS.primary, textAlign: 'center', marginBottom: 8 },
  title: { fontFamily: FONTS.headBold, fontSize: 28, color: COLORS.onSurface, textAlign: 'center', letterSpacing: 2, marginBottom: 4 },
  subtitle: { fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.onSurfaceMuted, textAlign: 'center', marginBottom: 36 },

  toggleRow: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 14, padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  toggleActive: { backgroundColor: COLORS.surfaceContainerHigh },
  toggleText: { fontFamily: FONTS.headBold, fontSize: 13, color: COLORS.onSurfaceMuted, letterSpacing: 1.5 },
  toggleTextActive: { color: COLORS.primary },

  input: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, fontFamily: FONTS.bodyRegular, fontSize: 15, color: COLORS.onSurface, marginBottom: 12 },

  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 28, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: COLORS.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  submitText: { fontFamily: FONTS.headBold, fontSize: 15, color: COLORS.primaryDark, letterSpacing: 1 },

  footer: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.onSurfaceMuted, textAlign: 'center', marginTop: 24 },
  footerLink: { color: COLORS.primary, fontFamily: FONTS.bodyBold },
});
