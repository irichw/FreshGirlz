import { View, Text, StyleSheet } from 'react-native';
export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Moi</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0EDE7', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
});