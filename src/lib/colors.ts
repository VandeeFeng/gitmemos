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

export function getLabelStyles(color: string) {
  return {
    backgroundColor: `#${color}20`,
    color: `#${color}`,
    border: `1px solid #${color}40`,
  };
}

export function getTextColorForBackground(bgColor: string): string {
  // 将十六进制颜色转换为 RGB
  const r = parseInt(bgColor.slice(0, 2), 16);
  const g = parseInt(bgColor.slice(2, 4), 16);
  const b = parseInt(bgColor.slice(4, 6), 16);
  
  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // 如果亮度大于 128，返回黑色，否则返回白色
  return brightness > 128 ? 'text-black' : 'text-white';
}

// 状态颜色
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