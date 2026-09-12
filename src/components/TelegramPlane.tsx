import Svg, { G, Path } from 'react-native-svg';

/**
 * 3D paper plane like Telegram’s logo (folded faces),
 * tip pointing down-left as requested.
 */
export function TelegramPlane({
  size = 28,
}: {
  size?: number;
  /** ignored — faces use Telegram white / blue-grey */
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Drawn NE like Telegram, then spun 180° → tip down-left */}
      <G transform="rotate(180 12 12)">
        {/* Under-fold (depth / shadow) */}
        <Path
          d="M10.2 12.6 L21.6 3.9 L13.4 19.2 Z"
          fill="#8EADC8"
        />
        {/* Main top wing */}
        <Path
          d="M2.6 11.1 L21.6 3.9 L10.2 12.6 Z"
          fill="#FFFFFF"
        />
        {/* Inner fold / fuselage strip */}
        <Path
          d="M10.2 12.6 L13.4 19.2 L11.5 13.4 Z"
          fill="#C5D8E8"
        />
        {/* Soft edge highlight on top wing */}
        <Path
          d="M4.2 11.0 L19.8 4.6 L10.6 12.2 Z"
          fill="#FFFFFF"
          opacity={0.35}
        />
      </G>
    </Svg>
  );
}
