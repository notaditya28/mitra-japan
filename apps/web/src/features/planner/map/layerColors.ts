import { palette } from '../../../styles/tokens';
import type { MapLayer } from '../../../store/useAppStore';

/** Layer colours, shared by the 3D pins and the legend (kept free of three.js imports). */
export const LAYER_COLORS: Record<MapLayer, string> = {
  vegSafe: palette.matcha,
  heritage: palette.gold,
  anime: palette.sakura,
  regional: palette.torii,
};
