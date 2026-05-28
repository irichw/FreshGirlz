import React from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function FreshScoreRing({ score, color }) {
  const SIZE = 56;
  const STROKE = 4.5;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUM = 2 * Math.PI * RADIUS;

  const animVal = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animVal, {
      toValue: score,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUM, 0],
  });

  const trackColor = `${color}22`;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS}
          stroke={trackColor} strokeWidth={STROKE} fill="none" />
      </Svg>
      <Svg width={SIZE} height={SIZE}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <AnimatedCircle
          cx={SIZE/2} cy={SIZE/2} r={RADIUS}
          stroke={color} strokeWidth={STROKE} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUM} ${CIRCUM}`}
          strokeDashoffset={strokeDashoffset} />
      </Svg>
      <Text style={{ fontSize: 11, fontWeight: '800', color }}>{score}%</Text>
    </View>
  );
}
