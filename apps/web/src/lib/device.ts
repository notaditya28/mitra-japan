/**
 * Rough device capability tier so we can keep 60fps on mid laptops and fall
 * back gracefully on weak phones. Deliberately conservative.
 */
export type DeviceTier = 'high' | 'mid' | 'low';

export interface DeviceProfile {
  tier: DeviceTier;
  webgl: boolean;
  /** Max devicePixelRatio for the WebGL canvas. */
  dpr: number;
  /** Number of falling petals to render. */
  petals: number;
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

let cached: DeviceProfile | null = null;

export function getDeviceProfile(): DeviceProfile {
  if (cached) return cached;
  const nav = navigator as NavigatorWithHints;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const saveData = nav.connection?.saveData ?? false;
  const small = window.matchMedia('(max-width: 768px)').matches;
  const webgl = hasWebGL();

  let tier: DeviceTier = 'high';
  if (!webgl || saveData || cores <= 2 || memory <= 2) tier = 'low';
  else if (small || cores <= 4 || memory <= 4) tier = 'mid';

  const deviceDpr = window.devicePixelRatio || 1;
  cached = {
    tier,
    webgl,
    dpr: Math.min(deviceDpr, tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1),
    petals: tier === 'high' ? 140 : tier === 'mid' ? 70 : 24,
  };
  return cached;
}
