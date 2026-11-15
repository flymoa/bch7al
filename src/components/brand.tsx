// The bch7al? mark: a speech bubble (the app is a question) holding a 7 whose stem
// ends in the dot of a "?". Same drawing as the app icon.
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';

export const BUBBLE = 'M30 6h40a24 24 0 0 1 24 24v32a24 24 0 0 1-24 24H36L16 97l3-14A24 24 0 0 1 6 62V30A24 24 0 0 1 30 6z';
export const SEVEN = 'M33 30h34c2 0 3 2 2 3.6L52.5 58';
export const SEVEN_LENGTH = 70;

export function Mark({ size = 40, fill, stroke }: { size?: number; fill?: string; stroke?: string }) {
  const f = fill ?? colors.blue;
  const s = stroke ?? '#FFFFFF';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={BUBBLE} fill={f} />
      <Path d={SEVEN} fill="none" stroke={s} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={50} cy={73.5} r={6.2} fill={s} />
    </Svg>
  );
}
