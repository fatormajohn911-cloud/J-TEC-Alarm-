import React from 'react';
import logoUrl from '../../../assets/logo.svg';

interface AppLogoProps {
  className?: string;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = 'h-16 w-16',
  alt = 'AI Wake logo',
}) => {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={`${className} select-none object-contain`}
      draggable={false}
    />
  );
};
