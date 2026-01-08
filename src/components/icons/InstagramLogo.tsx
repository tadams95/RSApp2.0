/**
 * Instagram Logo Component
 * Official Instagram glyph as an SVG for use in social link displays
 */

import React from "react";
import Svg, { Circle, Rect } from "react-native-svg";

interface InstagramLogoProps {
  size?: number;
  color?: string;
}

/**
 * Official Instagram glyph SVG component
 * @param size - Width and height of the icon (default: 20)
 * @param color - Fill/stroke color of the icon (default: '#000')
 */
export function InstagramLogo({
  size = 20,
  color = "#000",
}: InstagramLogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityRole="image"
      accessibilityLabel="Instagram logo"
    >
      {/* Outer rounded square */}
      <Rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
      {/* Center circle (camera lens) */}
      <Circle cx={12} cy={12} r={4} />
      {/* Top right dot (flash) */}
      <Circle cx={17.5} cy={6.5} r={1.5} fill={color} stroke="none" />
    </Svg>
  );
}

export default InstagramLogo;
