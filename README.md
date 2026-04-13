# Hex Capture ⬡

A cloud-connected, multiplayer territory capture game built with React Native and Expo. Walk or run through the real world to claim H3 hexagons, conquer territories, and compete on a global leaderboard!

## 🚀 Features
- **Real-World GPS Tracking**: Uses your device's location to actively track your path while running.
- **H3 Hexagon Engine**: Powered by Uber's H3 geospatial indexing system (Resolution 11) for high-performance map gridding.
- **Supabase Cloud Sync**: Row Level Security (RLS) protected backend that syncs your captured territories and live leaderboard rankings instantly.
- **XP & Leveling System**: Earn XP based on the size of the territory you capture and unlock new Warden/Commander military ranks.
- **Offline MVP Caching**: Seamlessly caches your personal run histories on the device for rapid access.

## 🛠 Tech Stack
- **Frontend**: React Native, Expo, React Navigation
- **Maps API**: `react-native-maps`
- **Geospatial Logic**: `h3-js`
- **Backend & Auth**: Supabase, PostgreSQL
- **Storage**: AsyncStorage

## 📦 How to Run Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Supabase Database**
   Copy the contents of `supabase_setup.sql` and run it in your Supabase project's SQL editor to generate the required tables and security policies.

3. **Start the Expo Server**
   ```bash
   npx expo start
   ```
   *Scan the QR code with the Expo Go app on iOS or Android to start playing.*

## 📸 Screenshots
*(Add a few screenshots of your app running on Expo here!)*
