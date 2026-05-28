# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes de développement

```bash
npx expo start          # Lance le serveur de dev (QR code pour Expo Go)
npx expo start --web    # Lance en mode web (maps mockée)
npx expo start --android
npx expo start --ios
```

Pas de linter ni de tests configurés. Pas de build step — Expo gère la compilation.

## Architecture

### Stack
- **Expo SDK 54** / React Native 0.81 / React 19
- **Supabase** (`supabase.js`) : base de données + auth + storage
- **React Navigation** : `createStackNavigator` + `createBottomTabNavigator`
- Pas de state manager global (useState local + appels Supabase directs)

### Deux univers distincts dans App.js

`App.js` est le point d'entrée. Il détecte le rôle de l'utilisateur (`session.user.user_metadata.role`) et route vers deux navigations parallèles :

- **Cliente** → `ClientTabs` (Home / Feed / Profile) avec `GlassTabBar` (tab bar custom animée)
- **Coiffeuse** → `CoiffeuseTabs` (tabBar masquée) + `CoiffeuseTabBar` embarquée dans chaque écran

### Tab bar coiffeuse
`CoiffeuseTabBar` est exportée depuis `CoiffeuseHomeScreen.js` et importée par tous les écrans coiffeuse (`CoiffeuseDashboard`, `AgendaScreen`, `CoiffeuseSalonScreen`). Elle charge la photo du salon en interne. Ne pas recréer de tab bar inline dans les nouveaux écrans coiffeuse.

### Fichiers structurants

| Fichier | Rôle |
|---|---|
| `App.js` | Navigation racine, détection rôle, push notifications |
| `supabase.js` | Client Supabase (URL + clé anon du projet `wpqivrznmuqzidpcaala`) |
| `colors.js` | Palette (`colors.*`) + `SPECIALITES` (spécialités coiffure afro) |
| `CoiffeuseHomeScreen.js` | Écran home coiffeuse **+ export `CoiffeuseTabBar`** |
| `PhotoViewer.js` | Visionneuse modale avec zoom/pan/swipe, actions like/inspiration |
| `QueueService.js` | `joinQueue`, `checkAlreadyInQueue`, `checkAnyActiveQueue`, `leaveQueue` |
| `utils/hours.js` | `isWithinHours(row)`, `todayDow()` — horaires d'ouverture |
| `utils/geo.js` | `haversineKm(lat1, lon1, lat2, lon2)` |
| `freshScore.js` | `calculateFreshScore(params)`, `getFreshLevel(score)` |

### Base de données Supabase

Tables principales : `clientes`, `coiffeuses`, `salons`, `salon_photos`, `salon_invites`, `services`, `opening_hours`, `appointments`, `queue`, `coupes`, `coupe_likes`, `coupe_inspirations`, `coupe_tags`, `avis` (= reviews), `followed_barbers`, `followed_clients`, `notifications`, `book_photos`, `photo_partages`, `photo_likes`.

Buckets storage : `avatars`, `book-photos`, `photos-coupes`, `Photos` (photos salon).

Colonnes clés non évidentes :
- `coiffeuses.work_mode` : `'salon'` | `'domicile'`
- `coiffeuses.role` : `'manager'` | `'coiffeuse'`
- `services.price_type` : `'fixed'` | `'range'` | `'from'` + `price_min` / `price_max`
- `appointments.time` : heure au format `'HH:MM'`
- `coupes.inspirations_count` : maintenu via RPCs `increment_coupe_inspirations` / `decrement_coupe_inspirations`

RPC Supabase utilisées : `increment_coupe_views`, `increment_coupe_inspirations`, `decrement_coupe_inspirations`.

### Helpers d'affichage partagés

`fmtDuration(minutes)` et `fmtPrice(svc)` sont définis **dans `CoiffeuseProfileScreen.js`** et **dupliqués dans `ServicesManagementScreen.js`**. Si d'autres écrans en ont besoin, les extraire dans `utils/format.js`.

### Mocks web
`react-native-maps` est mocké sur web via `metro.config.js` → `mocks/react-native-maps.js`. Ne pas importer `react-native-maps` sans ce fallback.

## Conventions UI

- Fond global : `#FAF4F8` (rose ivoire)
- Couleur primaire : `#7C3D8F` (violet) — côté coiffeuse
- Couleur secondaire : `#D4A843` (or) — côté cliente / avis
- Glassmorphism systématique : `<BlurView intensity={55} tint="light">` avec `borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)'`
- Tous les écrans ont un fond "blobs" (4 cercles colorés en `position: absolute`)
- StyleSheet en bas de chaque fichier, variable `s` ou `styles`
- Pas de fichier de styles partagé — styles locaux à chaque écran

## Migrations SQL

Les fichiers `migration_*.sql` à la racine sont à exécuter manuellement dans Supabase Dashboard → SQL Editor. Ils sont idempotents (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

Fichiers existants :
- `migration_salons.sql` — tables salon, horaires, services, invitations
- `migration_tags_workmode.sql` — `work_mode` coiffeuses, `coupe_tags`, stats coupes, heure RDV, prix enrichis services
