/**
 * X (formerly Twitter) Logo Component
 * Official X logo as an SVG for use in social link displays
 */

import React from "react";
import Svg, { Path } from "react-native-svg";

interface XLogoProps {
  size?: number;
  color?: string;
}

/**
 * Official X logo SVG component
 * @param size - Width and height of the icon (default: 20)
 * @param color - Fill color of the icon (default: '#000')
 */
export function XLogo({ size = 20, color = "#000" }: XLogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      accessibilityRole="image"
      accessibilityLabel="X logo"
    >
      <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </Svg>
  );
}

export default XLogo;
