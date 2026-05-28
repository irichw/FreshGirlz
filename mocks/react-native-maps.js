import { View } from 'react-native';

const MapView = (props) => null;
MapView.Animated = (props) => null;

export default MapView;
export const Marker = (props) => null;
export const Callout = (props) => null;
export const Circle = (props) => null;
export const Polygon = (props) => null;
export const Polyline = (props) => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;
export const AnimatedRegion = class {
  constructor(region) { Object.assign(this, region); }
  timing() { return { start: () => {} }; }
};
