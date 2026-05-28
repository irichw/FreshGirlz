import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  PanResponder, Animated, Dimensions, StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

const { width: W, height: H } = Dimensions.get('window');
const CLOSE_THRESHOLD = 80;
const SCALE_MAX = 5;
const SCALE_MIN = 1;

function dist(touches) {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(touches) {
  return {
    x: (touches[0].pageX + touches[1].pageX) / 2,
    y: (touches[0].pageY + touches[1].pageY) / 2,
  };
}

export default function PhotoViewer({
  visible,
  photos = [],
  initialIndex = 0,
  onClose,
  onIndexChange,
  renderActions,
}) {
  const [idx, setIdx] = useState(initialIndex);

  const slideX   = useRef(new Animated.Value(0)).current;
  const bgOp     = useRef(new Animated.Value(1)).current;
  const scale    = useRef(new Animated.Value(1)).current;
  const transX   = useRef(new Animated.Value(0)).current;
  const transY   = useRef(new Animated.Value(0)).current;

  // Tout l'état mutable dans un seul ref — zéro closure périmée
  const g = useRef({
    idx: initialIndex,
    total: photos.length,
    // état zoom/pan courant
    sc: 1,
    tx: 0,
    ty: 0,
    // état au début du geste
    startSc: 1,
    startTx: 0,
    startTy: 0,
    startDist: 1,
    startMid: { x: 0, y: 0 },
    // type de geste actif : 'pinch' | 'pan' | 'close' | null
    type: null,
    touches: 0,
  });

  const onCloseRef  = useRef(onClose);
  const onIdxRef    = useRef(onIndexChange);
  const photosRef   = useRef(photos);
  onCloseRef.current  = onClose;
  onIdxRef.current    = onIndexChange;
  photosRef.current   = photos;
  g.current.idx   = idx;
  g.current.total = photos.length;

  useEffect(() => {
    if (visible) resetAll(initialIndex);
  }, [visible, initialIndex]);

  // ── helpers ──────────────────────────────────────────────────────────

  function resetAll(newIdx) {
    g.current.sc = 1; g.current.tx = 0; g.current.ty = 0;
    g.current.type = null;
    g.current.idx = newIdx;
    setIdx(newIdx);
    scale.setValue(1); transX.setValue(0); transY.setValue(0);
    slideX.setValue(0); bgOp.setValue(1);
  }

  function resetZoom(animated = true) {
    g.current.sc = 1; g.current.tx = 0; g.current.ty = 0;
    if (animated) {
      Animated.parallel([
        Animated.spring(scale,  { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
        Animated.spring(transX, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
        Animated.spring(transY, { toValue: 0, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(1); transX.setValue(0); transY.setValue(0);
    }
  }

  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  // Plage de déplacement autorisée selon le niveau de zoom
  function maxPan(sc) {
    return { x: (sc - 1) * W / 2, y: (sc - 1) * H / 2 };
  }

  function doClose() {
    Animated.timing(bgOp, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      bgOp.setValue(1); resetZoom(false);
      onCloseRef.current?.();
    });
  }

  function navigateTo(newIdx) {
    if (newIdx < 0 || newIdx >= g.current.total) return;
    const cur = g.current.idx;
    resetZoom(false);
    const dir = newIdx > cur ? 1 : -1;
    Animated.timing(slideX, { toValue: -dir * W, duration: 200, useNativeDriver: true }).start(() => {
      g.current.idx = newIdx;
      setIdx(newIdx);
      onIdxRef.current?.(photosRef.current[newIdx], newIdx);
      slideX.setValue(dir * W * 0.25);
      Animated.spring(slideX, { toValue: 0, tension: 95, friction: 13, useNativeDriver: true }).start();
    });
  }

  // ── PanResponder ─────────────────────────────────────────────────────

  const pan = useRef(PanResponder.create({

    // Capture toujours : fiable pour pinch multi-touch
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      g.current.touches   = t.length;
      g.current.type      = null;
      g.current.startTx   = g.current.tx;
      g.current.startTy   = g.current.ty;
      g.current.startSc   = g.current.sc;

      if (t.length >= 2) {
        g.current.type      = 'pinch';
        g.current.startDist = dist(t);
        g.current.startMid  = midpoint(t);
      }
    },

    onPanResponderMove: (evt, gs) => {
      const t     = evt.nativeEvent.touches;
      const count = t.length;
      g.current.touches = count;

      // ── Pinch ──
      if (count >= 2) {
        if (g.current.type !== 'pinch') {
          // Passage de 1 à 2 doigts en cours de geste
          g.current.type      = 'pinch';
          g.current.startDist = dist(t);
          g.current.startMid  = midpoint(t);
          g.current.startSc   = g.current.sc;
          g.current.startTx   = g.current.tx;
          g.current.startTy   = g.current.ty;
        }
        const newSc = clamp(
          g.current.startSc * dist(t) / g.current.startDist,
          SCALE_MIN, SCALE_MAX
        );
        g.current.sc = newSc;
        scale.setValue(newSc);

        // Ajuster la translation pour que le point central du pinch soit fixe
        const mid    = midpoint(t);
        const origin = g.current.startMid;
        const { x: maxX, y: maxY } = maxPan(newSc);
        const nx = clamp(g.current.startTx + (mid.x - origin.x), -maxX, maxX);
        const ny = clamp(g.current.startTy + (mid.y - origin.y), -maxY, maxY);
        g.current.tx = nx; g.current.ty = ny;
        transX.setValue(nx); transY.setValue(ny);
        return;
      }

      // ── 1 doigt ──
      if (g.current.type === 'pinch') return; // relâcher correctement géré dans Release

      // Détecter le type de geste après dead zone
      if (!g.current.type && (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8)) {
        if (g.current.sc > 1.05) {
          g.current.type = 'pan';
        } else {
          g.current.type = 'close';
        }
      }

      if (g.current.type === 'pan') {
        const { x: maxX, y: maxY } = maxPan(g.current.sc);
        const nx = clamp(g.current.startTx + gs.dx, -maxX, maxX);
        const ny = clamp(g.current.startTy + gs.dy, -maxY, maxY);
        transX.setValue(nx); transY.setValue(ny);
      }
      // 'close' : image fixe, on détecte juste la direction au relâcher
    },

    onPanResponderRelease: (_, gs) => {
      const type = g.current.type;
      g.current.type = null;

      if (type === 'pinch') {
        if (g.current.sc < 1.05) resetZoom(true);
        return;
      }

      if (type === 'pan') {
        // Sauvegarder la position finale
        const { x: maxX, y: maxY } = maxPan(g.current.sc);
        g.current.tx = clamp(g.current.startTx + gs.dx, -maxX, maxX);
        g.current.ty = clamp(g.current.startTy + gs.dy, -maxY, maxY);
        return;
      }

      if (type === 'close') {
        if (Math.abs(gs.dy) > Math.abs(gs.dx) && gs.dy > CLOSE_THRESHOLD) {
          doClose();
        } else if (Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 50) {
          if (gs.dx < 0) navigateTo(g.current.idx + 1);
          else navigateTo(g.current.idx - 1);
        }
      }
    },

    onPanResponderTerminate: () => {
      g.current.type = null;
    },

  })).current;

  // ─────────────────────────────────────────────────────────────────────

  const photo = photos[idx];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={doClose}
      statusBarTranslucent>

      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: bgOp }]} />

      {/* Zone photo + gestes */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideX }] }]}
        {...pan.panHandlers}>
        <View style={styles.center}>
          {photo?.photo_url ? (
            <Animated.View style={{
              transform: [{ scale }, { translateX: transX }, { translateY: transY }],
            }}>
              <ExpoImage
                source={photo.photo_url}
                style={styles.photo}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </Animated.View>
          ) : (
            <Text style={{ fontSize: 60, opacity: 0.12, color: '#fff' }}>✂</Text>
          )}
        </View>
      </Animated.View>

      {/* UI overlay — ne bloque pas les gestes */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        <TouchableOpacity style={styles.closeBtn} onPress={doClose}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>

        {photos.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterTxt}>{idx + 1} / {photos.length}</Text>
          </View>
        )}

        {photos.length > 1 && idx > 0 && (
          <TouchableOpacity style={styles.arrowLeft} onPress={() => navigateTo(idx - 1)}>
            <Text style={styles.arrowTxt}>‹</Text>
          </TouchableOpacity>
        )}

        {photos.length > 1 && idx < photos.length - 1 && (
          <TouchableOpacity style={styles.arrowRight} onPress={() => navigateTo(idx + 1)}>
            <Text style={styles.arrowTxt}>›</Text>
          </TouchableOpacity>
        )}

        {photo && (
          <View style={styles.bottomBar} pointerEvents="box-none">
            {photo.service ? <Text style={styles.service}>{photo.service}</Text> : null}
            {(photo.views !== undefined || photo.likes !== undefined) && (
              <View style={styles.statsRow}>
                {photo.views !== undefined && <Text style={styles.statTxt}>👁 {photo.views ?? 0} vues</Text>}
                {photo.likes !== undefined && <Text style={styles.statTxt}>♥ {photo.likes ?? 0} likes</Text>}
              </View>
            )}
            <View pointerEvents="box-none">
              {renderActions?.(photo)}
            </View>
          </View>
        )}

        {photos.length > 1 && photos.length <= 14 && (
          <View style={styles.dots} pointerEvents="box-none">
            {photos.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => navigateTo(i)}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}>
                <View style={[styles.dot, i === idx && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photo:  { width: W, height: H * 0.78 },

  closeBtn: {
    position: 'absolute', top: 54, left: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  counter: {
    position: 'absolute', top: 58, right: 18,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  counterTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

  arrowLeft: {
    position: 'absolute', left: 12, top: H / 2 - 21,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowRight: {
    position: 'absolute', right: 12, top: H / 2 - 21,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowTxt: { color: '#fff', fontSize: 30, fontWeight: '200', lineHeight: 40 },

  bottomBar: {
    position: 'absolute', bottom: 44, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 24,
  },
  service:  { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 18, marginBottom: 14 },
  statTxt:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  dots: {
    position: 'absolute', bottom: 200, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotActive: { width: 20, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});

