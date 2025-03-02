export interface LabelColor {
  name: string;
  color: string;
  textColor: string;
}

export const LABEL_COLORS: LabelColor[] = [
  { name: 'Red', color: 'b60205', textColor: 'text-white' },
  { name: 'Orange', color: 'd93f0b', textColor: 'text-white' },
  { name: 'Yellow', color: 'fbca04', textColor: 'text-black' },
  { name: 'Green', color: '0e8a16', textColor: 'text-white' },
  { name: 'Mint', color: '98ff98', textColor: 'text-black' },
  { name: 'Teal', color: '006b75', textColor: 'text-white' },
  { name: 'Light Blue', color: 'c5def5', textColor: 'text-black' },
  { name: 'Blue', color: '0075ca', textColor: 'text-white' },
  { name: 'Purple', color: '6f42c1', textColor: 'text-white' },
  { name: 'Pink', color: 'ff69b4', textColor: 'text-black' },
  { name: 'Gray', color: 'bfdadc', textColor: 'text-black' },
];

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Convert hex to RGB
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function HSLToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c/2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const toHex = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getLabelStyles(color: string) {
  // Convert to HSL
  const hsl = hexToHSL(color);
  
  // Text color: reduce saturation for a grayish look and adjust brightness
  const textColor = HSLToHex(
    hsl.h,
    Math.max(hsl.s - 25, 0), // Significantly reduce saturation
    Math.min(hsl.l + 25, 100) // Increase brightness
  );
  
  // Border color: reduce both brightness and saturation
  const borderColor = HSLToHex(
    hsl.h, 
    Math.max(hsl.s - 35, 0), // Reduce saturation
    Math.max(hsl.l - 5, 0)   // Slightly reduce brightness
  );
  
  return {
    backgroundColor: `#${color}40`, // Background with 40% opacity
    color: textColor,
    border: `1px solid ${borderColor}`,
  };
}

export function getTextColorForBackground(bgColor: string): string {
  // Convert hex color to RGB
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  
  // Calculate brightness using weighted RGB values
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return black for light backgrounds, white for dark backgrounds
  return brightness > 128 ? 'text-black' : 'text-white';
}

// Status colors for different states
export const STATUS_COLORS = {
  open: {
    light: {
      style: {
        backgroundColor: '#dafbe1',
        color: '#1a7f37',
      },
      dotStyle: {
        backgroundColor: '#1a7f37',
      },
    },
    dark: {
      style: {
        backgroundColor: 'rgba(35, 134, 54, 0.2)',
        color: '#3fb950',
      },
      dotStyle: {
        backgroundColor: '#238636',
      },
    },
  },
  closed: {
    light: {
      style: {
        backgroundColor: '#faf2f8',
        color: '#8250df',
      },
      dotStyle: {
        backgroundColor: '#8250df',
      },
    },
    dark: {
      style: {
        backgroundColor: 'rgba(130, 80, 223, 0.2)',
        color: '#a371f7',
      },
      dotStyle: {
        backgroundColor: '#8250df',
      },
    },
  },
}; 