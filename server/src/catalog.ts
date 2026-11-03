export interface Product {
  id: string;
  name: string;
  category: 'monitor' | 'seating' | 'audio' | 'lighting';
  price: number;
  tier: 'budget' | 'recommended' | 'pro';
  description: string;
}

export const CATALOG: Product[] = [
  // Monitors
  { id: 'mon-1080', name: 'UltraClear 24" 1080p IPS Monitor', category: 'monitor', price: 130.00, tier: 'budget', description: '75Hz Full HD display with low blue light' },
  { id: 'mon-2k', name: 'ProView 27" QHD 1440p USB-C Monitor', category: 'monitor', price: 260.00, tier: 'recommended', description: 'Sharp 1440p IPS display with 65W USB-C power delivery' },
  { id: 'mon-4k', name: 'StudioMaster 32" 4K UHD HDR Display', category: 'monitor', price: 440.00, tier: 'pro', description: 'Factory-calibrated 4K display with 90W Thunderbolt hub' },
  { id: 'mon-oled', name: 'CinePro 38" Dual-4K Reference OLED', category: 'monitor', price: 780.00, tier: 'pro', description: '10-bit reference OLED for color grading and studio mastering' },

  // Ergonomic Seating
  { id: 'chair-mesh', name: 'ErgoFlex Breathable Mesh Task Chair', category: 'seating', price: 110.00, tier: 'budget', description: 'Lightweight mesh back with fixed lumbar support' },
  { id: 'chair-pro', name: 'AeroPosture Pro Ergonomic Chair', category: 'seating', price: 210.00, tier: 'recommended', description: '4D adjustable armrests and dynamic weight-activated lumbar' },
  { id: 'chair-exec', name: 'Sovereign Studio Executive Chair', category: 'seating', price: 480.00, tier: 'pro', description: 'Full-grain leather headrest and multi-tilt synchro mechanism' },

  // Audio & Microphones
  { id: 'mic-usb', name: 'SoloMic Compact USB Condenser', category: 'audio', price: 45.00, tier: 'budget', description: 'Plug-and-play cardioid USB mic with mute tap' },
  { id: 'mic-pod', name: 'VocalCast Dynamic XLR/USB Broadcast Mic', category: 'audio', price: 135.00, tier: 'recommended', description: 'Broadcast voice isolation capsule with built-in DSP' },
  { id: 'mic-studio', name: 'ProAir Studio XLR Mic + Dual Preamp Interface', category: 'audio', price: 320.00, tier: 'pro', description: 'Studio broadcast vocal chain with boom arm and 24-bit interface' },

  // Lighting & Desk
  { id: 'light-bar', name: 'ScreenBar Glare-Free LED Monitor Lamp', category: 'lighting', price: 35.00, tier: 'budget', description: 'Asymmetrical optical design eliminates screen reflection' },
  { id: 'light-key', name: 'GlowStream Bi-Color Key Light Panel', category: 'lighting', price: 75.00, tier: 'recommended', description: 'Wi-Fi controlled edge-lit LED panel for video calls' },
  { id: 'light-studio', name: 'Dual-Point Softbox Key & Fill Lighting Kit', category: 'lighting', price: 180.00, tier: 'pro', description: 'Two 45W CRI 97+ softboxes with desk C-stands' }
];