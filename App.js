import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import CoiffeuseDashboard from './CoiffeuseDashboard';
import CoiffeuseHomeScreen from './CoiffeuseHomeScreen';
import NotificationScreen from './NotificationScreen';
import AfterCutScreen from './AfterCutScreen';
import AgendaScreen from './AgendaScreen';
import StatsScreen from './StatsScreen';
import ProfileScreen from './ProfileScreen';
import FriendsScreen from './FriendsScreen';
import AuthScreen from './AuthScreen';
import CoiffeuseActionScreen from './CoiffeuseActionScreen';
import JoinQueueModal from './JoinQueueModal';
import CoiffeuseProfileScreen from './CoiffeuseProfileScreen';
import OpenQueueModal from './OpenQueueModal';
import AddClientModal from './AddClientModal';
import CoiffeuseSalonScreen from './CoiffeuseSalonScreen';
import AfterCutCoiffeuseScreen from './AfterCutCoiffeuseScreen';
import InProgressScreen from './InProgressScreen';
import MapScreen from './MapScreen';
import SearchScreen from './SearchScreen';
import CommunityScreen from './CommunityScreen';
import TutosScreen from './TutosScreen';
import TopFreshScoreScreen from './TopFreshScoreScreen';
import PublicProfileScreen from './PublicProfileScreen';
import TopCoiffeusesScreen from './TopCoiffeusesScreen';
import SalonManagementScreen from './SalonManagementScreen';
import ServicesManagementScreen from './ServicesManagementScreen';
import AccountSettingsScreen from './AccountSettingsScreen';
import CoiffeuseNotificationsScreen from './CoiffeuseNotificationsScreen';
import NearbyAvailableScreen from './NearbyAvailableScreen';
import SalonPublicScreen from './SalonPublicScreen';
import CoiffeuseClientDetailScreen from './CoiffeuseClientDetailScreen';
import BookAppointmentScreen from './BookAppointmentScreen';
import ShopManagementScreen from './ShopManagementScreen';
import PhotoConsentScreen from './PhotoConsentScreen';
import CreateSalonScreen from './CreateSalonScreen';
import OnboardingIndependanteScreen from './OnboardingIndependanteScreen';
import NearbySalonsScreen from './NearbySalonsScreen';
import CoiffeuseBookScreen from './CoiffeuseBookScreen';




import HomeScreen from './HomeScreen';
import SalonScreen from './SalonScreen';
import QueueScreen from './QueueScreen';
import { Image as RNImage } from 'react-native';

import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from './notificationService';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const FADE_OPTS = {
  cardStyleInterpolator: ({ current, next }) => ({
    cardStyle: {
      opacity: next
        ? next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' })
        : current.progress,
    },
  }),
  transitionSpec: {
    open:  { animation: 'timing', config: { duration: 180 } },
    close: { animation: 'timing', config: { duration: 160 } },
  },
};

const CLIENT_TABS = [
  { label: 'Accueil',   imgA: require('./assets/homefull.png'),    imgI: require('./assets/homevide.png'),   size: 22 },
  { label: 'Feed',      imgA: require('./assets/Commufull.png'),   imgI: require('./assets/Commuvide.png'),  size: 28 },
  { label: null,        isProfile: true },
];

const { width: SCREEN_W } = Dimensions.get('window');
const TAB_W = (SCREEN_W - 28) / 3;

function GlassTabBar({ state, navigation }) {
  const pillX = useRef(new Animated.Value(state.index)).current;
  const [clientAvatar, setClientAvatar] = useState(null);

  useEffect(() => {
    Animated.spring(pillX, {
      toValue: state.index,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [state.index]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('clientes').select('avatar_url').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.avatar_url) setClientAvatar(data.avatar_url); });
    });
  }, []);

  const translateX = pillX.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, TAB_W, TAB_W * 2],
  });

  return (
    <View style={glassStyles.tabBarOuter}>
      <BlurView intensity={65} tint="light" style={glassStyles.tabBarInner}>
        <Animated.View style={[glassStyles.slidingPill, { transform: [{ translateX }] }]}>
          <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFill} />
        </Animated.View>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const def = CLIENT_TABS[index];
          return (
            <TouchableOpacity
              key={route.key}
              style={glassStyles.tabItem}
              onPress={() => { if (!isFocused) navigation.navigate(route.name); }}
              activeOpacity={0.7}
            >
              {def.isProfile ? (
                clientAvatar ? (
                  <RNImage source={{ uri: clientAvatar }} style={[glassStyles.tabAvatar, isFocused && glassStyles.tabAvatarActive]} />
                ) : (
                  <View style={[glassStyles.tabAvatarPlaceholder, isFocused && glassStyles.tabAvatarActive]}>
                    <Text style={glassStyles.tabAvatarInitial}>M</Text>
                  </View>
                )
              ) : (
                <>
                  <RNImage source={isFocused ? def.imgA : def.imgI} style={[glassStyles.tabImg, { width: def.size, height: def.size }]} />
                  <Text style={[glassStyles.tabLabel, isFocused && glassStyles.tabLabelActive]}>{def.label}</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

function CoiffeuseTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={() => null}
    >
      <Tab.Screen name="BarberHome"         component={CoiffeuseHomeScreen} />
      <Tab.Screen name="CoiffeuseDashboard" component={CoiffeuseDashboard} />
      <Tab.Screen name="Agenda"             component={AgendaScreen} />
      <Tab.Screen name="BarberSalon"        component={CoiffeuseSalonScreen} />
    </Tab.Navigator>
  );
}

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Feed"    component={CommunityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useRef(null);
  const [session, setSession] = useState(null);
const [role, setRole] = useState(null);
const [loading, setLoading] = useState(true);
const [isGuest, setIsGuest] = useState(false);
const [needsSalonSetup, setNeedsSalonSetup]   = useState(false);
const [needsOnboarding, setNeedsOnboarding]   = useState(false);

async function checkCoiffeuseSetup(userId, user) {
  const { data } = await supabase
    .from('coiffeuses')
    .select('salon_id, role, profile_type, onboarding_done')
    .eq('user_id', userId)
    .maybeSingle();

  // Si la row coiffeuses n'est pas encore créée (race condition signup),
  // on se rabat sur user_metadata.barber_type stocké lors de l'inscription.
  const profileType = data?.profile_type ?? user?.user_metadata?.barber_type;

  if (profileType === 'independante') {
    setNeedsSalonSetup(false);
    setNeedsOnboarding(!data?.onboarding_done);
  } else {
    setNeedsOnboarding(false);
    setNeedsSalonSetup(!data?.salon_id);
  }
}

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    if (session?.user) {
      const userRole = session.user.user_metadata?.role || 'client';
      setRole(userRole);
      if (userRole === 'client') registerForPushNotifications();
      if (userRole === 'coiffeuse') checkCoiffeuseSetup(session.user.id, session.user);
    }
    setLoading(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    if (session?.user) {
      const userRole = session.user.user_metadata?.role || 'client';
      setRole(userRole);
      if (userRole === 'client') registerForPushNotifications();
      if (userRole === 'coiffeuse') checkCoiffeuseSetup(session.user.id, session.user);
    } else {
      setRole(null);
      setNeedsSalonSetup(false);
      setNeedsOnboarding(false);
    }
  });

  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (!navigationRef.current) return;
    if (data?.screen === 'Queue') {
      navigationRef.current.navigate('Queue', data.params ?? {});
    } else if (data?.screen === 'PhotoConsent') {
      navigationRef.current.navigate('PhotoConsent', data);
    } else if (data?.screen === 'AfterCut') {
      navigationRef.current.navigate('AfterCut', {
        barberId: data.barber_id,
        queueId: data.queue_id,
        barberName: data.barber_name,
        barberService: data.service,
      });
    }
  });
  return () => sub.remove();
}, []);

if (loading) return null;

  return (
  <SafeAreaProvider>
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session && !isGuest ? (
          <Stack.Screen name="Auth">
            {props => <AuthScreen {...props} onGuestMode={() => setIsGuest(true)} />}
          </Stack.Screen>
        ) : role === 'coiffeuse' && needsOnboarding ? (
          <Stack.Screen name="OnboardingIndependante">
            {() => <OnboardingIndependanteScreen onComplete={() => setNeedsOnboarding(false)} />}
          </Stack.Screen>
        ) : role === 'coiffeuse' && needsSalonSetup ? (
          <Stack.Screen name="CreateSalon">
            {() => <CreateSalonScreen onSalonCreated={() => setNeedsSalonSetup(false)} onBack={() => supabase.auth.signOut()} />}
          </Stack.Screen>
        ) : role === 'coiffeuse' ? (
          <>
            <Stack.Screen name="BarberHome"      component={CoiffeuseTabs}        options={{ animationEnabled: false }} />
            <Stack.Screen name="Stats"           component={StatsScreen} />
            <Stack.Screen name="OpenQueue"       component={OpenQueueModal} />
            <Stack.Screen name="CoiffeuseBook"   component={CoiffeuseBookScreen}  options={{ animationEnabled: false }} />
            <Stack.Screen name="AfterCutBarber" component={AfterCutCoiffeuseScreen} />
            <Stack.Screen name="BarberProfile" component={CoiffeuseProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SalonManagement" component={SalonManagementScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ServicesManagement" component={ServicesManagementScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ShopManagement" component={ShopManagementScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BarberNotifications" component={CoiffeuseNotificationsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SalonPublic" component={SalonPublicScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BarberClientDetail" component={CoiffeuseClientDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AddClient" component={AddClientModal} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="ClientTabs" component={ClientTabs} />
            {!session && (
              <Stack.Screen name="Auth">
                {props => <AuthScreen {...props} onGuestMode={() => setIsGuest(true)} />}
              </Stack.Screen>
            )}
            <Stack.Screen name="Salon" component={SalonScreen} />
            <Stack.Screen name="Queue" component={QueueScreen} />
            <Stack.Screen name="Notification" component={NotificationScreen} />
            <Stack.Screen name="CoiffeuseDashboard" component={CoiffeuseDashboard} />
            <Stack.Screen name="Stats" component={StatsScreen} />
            <Stack.Screen name="BarberAction" component={CoiffeuseActionScreen} />
            <Stack.Screen name="JoinQueue" component={JoinQueueModal} />
            <Stack.Screen name="BarberProfile" component={CoiffeuseProfileScreen} />
            <Stack.Screen name="OpenQueue" component={OpenQueueModal} />
            <Stack.Screen name="BarberSalon" component={CoiffeuseSalonScreen} />
            <Stack.Screen name="InProgress" component={InProgressScreen} />
            <Stack.Screen name="AfterCut" component={AfterCutScreen} />
            <Stack.Screen name="Map" component={MapScreen} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Tutos" component={TutosScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TopFreshScore" component={TopFreshScoreScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TopBarbers" component={TopCoiffeusesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NearbyAvailable" component={NearbyAvailableScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SalonPublic" component={SalonPublicScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PhotoConsent" component={PhotoConsentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NearbySalons" component={NearbySalonsScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  </SafeAreaProvider>
);
}

const styles = StyleSheet.create({
  screen: { flex:1, backgroundColor:'#FAF4F8', alignItems:'center', justifyContent:'center' },
  screenText: { fontSize:24, fontWeight:'700', color:'#1C1C1E' },
});

const glassStyles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  tabBarInner: {
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  slidingPill: {
    position: 'absolute',
    left: 3,
    top: 4,
    bottom: 4,
    width: TAB_W - 6,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(28,28,30,0.1)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 1,
  },
  tabImg: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(28,28,30,0.4)',
  },
  tabAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: 'cover',
    opacity: 0.5,
  },
  tabAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(168,133,42,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  tabAvatarActive: {
    opacity: 1,
    borderWidth: 2,
    borderColor: 'rgba(168,133,42,0.6)',
  },
  tabAvatarInitial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A8852A',
  },
  tabLabelActive: {
    color: '#1C1C1E',
    fontWeight: '700',
  },
});
