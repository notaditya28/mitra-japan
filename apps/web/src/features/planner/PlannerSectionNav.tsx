import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBar, type SectionItem } from '../../components/SectionNav';
import { jumpTo, useSheetRequest } from '../../lib/sectionScroll';
import { useTools } from '../tools/useTools';
import { usePlannerStore } from './usePlannerStore';

/**
 * The planner's section bar (lazy, so the planner store stays out of first paint):
 * jump to the map, trip options, itinerary, Ask Mitra or map layers, or open a tool.
 * On phones the panel is a bottom sheet, so it opens before the jump.
 */
export default function PlannerSectionNav({ solid }: { solid: boolean }) {
  const { t } = useTranslation();
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  const openTool = useTools((s) => s.open);
  const tool = useTools((s) => s.tool);
  const request = useSheetRequest((s) => s.request);
  const [active, setActive] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);

  const inPanel = (id: string, fallback?: string) => () => {
    setActive(id);
    const go = () => {
      if (!jumpTo(id) && fallback) jumpTo(fallback);
    };
    if (desktop) return go();
    request('full');
    // Let the sheet finish opening first.
    window.setTimeout(go, 350);
  };

  const tools = [
    ['scan', 'tools.scan.title'],
    ['eat', 'tools.eat.title'],
    ['visa', 'tools.visa.title'],
    ...(hasPlan ? ([['schedule', 'tools.schedule.title']] as const) : []),
    ['trips', 'tools.trips.title'],
  ] as const;

  const items: SectionItem[] = [
    {
      id: 'planner-map',
      label: t('sections.map'),
      go: () => {
        setActive('planner-map');
        if (!desktop) request('peek');
        jumpTo('planner-map');
      },
    },
    {
      id: 'trip-options',
      label: t('sections.planTrip'),
      go: inPanel('trip-options', 'trip-guide'),
    },
    ...(hasPlan
      ? [{ id: 'itinerary', label: t('sections.itinerary'), go: inPanel('itinerary') }]
      : []),
    { id: 'ask-mitra', label: t('sections.ask'), go: inPanel('ask-mitra') },
    { id: 'map-layers', label: t('sections.layers'), go: inPanel('map-layers') },
    ...tools.map(([k, key]) => ({
      id: `tool-${k}`,
      label: t(key),
      dialog: true,
      go: () => openTool(k),
    })),
  ];

  return (
    <SectionBar
      items={items}
      active={tool ? `tool-${tool}` : active}
      solid={solid}
      label={t('sections.plannerLabel')}
    />
  );
}
