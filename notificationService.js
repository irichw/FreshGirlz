import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Comportement quand une notif arrive en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('queue', {
      name: "File d'attente",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A8852A',
      sound: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  let token = null;
  try {
    // projectId requis pour builds EAS — ignoré en Expo Go (token simulé)
    const tokenData = await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch (e) {
    console.warn('Push token non disponible (Expo Go sans EAS) :', e.message);
    return null;
  }

  if (!token) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase
      .from('clientes')
      .update({ push_token: token })
      .eq('user_id', session.user.id);
  }

  return token;
}

export async function sendLocalNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === 'android' && { channelId: 'queue' }),
    },
    trigger: null,
  });
}

