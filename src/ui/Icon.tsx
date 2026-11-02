import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Stroke icons from the interface prototype (24×24 grid).
export const ICONS = {
  logo: 'M4.5 4.5l11 4.6-4.6 1.6-1.7 4.8zM14.5 3a7 7 0 0 1 6.5 6.5M14.5 6.5a3.5 3.5 0 0 1 3 3',
  play: 'M7 4.5v15l12-7.5z',
  home: 'M4 10.5L12 4l8 6.5V20H4zM10 20v-5h4v5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  sliders: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 18l-6-6 6-6',
  heart:
    'M12 20.5c-.4 0-7.5-4.4-9.3-8.6C1.4 8.6 3.4 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.8 0 5.8 4.1 4.5 7.4-1.8 4.2-8.9 8.6-9.3 8.6z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8v.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  checkCircle: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12.5l3 3 5-6',
  x: 'M6 6l12 12M18 6L6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-4-4',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16a8 8 0 0 0 0 16z',
  stop: 'M7 7h10v10H7z',
  pause: 'M8 5v14M16 5v14',
  cpu: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z',
  bug: 'M8 9h8v7a4 4 0 0 1-8 0zM9 9V7a3 3 0 0 1 6 0v2M4 13h4M16 13h4M5 8l3 2M19 8l-3 2M5 19l3-2M19 19l-3-2',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8a4 4 0 0 0 0 8z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const;
export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Filled shape instead of a stroke. */
  fill?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color = '#FFFFFF', fill = false, strokeWidth = 1.9 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d={ICONS[name]}
        fill={fill ? color : 'none'}
        stroke={fill ? 'none' : color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
