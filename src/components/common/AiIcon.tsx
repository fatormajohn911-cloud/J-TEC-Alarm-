import React from 'react';
import { AudioWaveform } from 'lucide-react';

interface AiIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}

/**
 * Reusable AI Icon component for AI Wake.
 * Represents voice intelligence and wake assistant features across the application.
 */
export const AiIcon: React.FC<AiIconProps> = ({
  className = 'h-5 w-5',
  size,
  style,
}) => {
  return <AudioWaveform className={className} size={size} style={style} />;
};

export default AiIcon;
