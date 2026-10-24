import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBar, type SectionItem } from '../../components/SectionNav';
import { jumpTo, useSheetRequest } from '../../lib/sectionScroll';
import { useDesktopLayout, usePanelJump } from './panelJump';
import { useTools } from '../tools/useTools';
import { usePlannerStore } from './usePlannerStore';

/**
 * The planner's section bar (lazy, so the planner store stays out of first paint):
 * jump to the map, trip options, itinerary or map layers, or open a tool. Ask Mitra sits
 * next to the language switch instead (`AskMitraButton`).
 */
export default function PlannerSectionNav({ solid }: { solid: boolean }) {
  const { t } = useTranslation();
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  const openTool = useTools((s) => s.open);
  const tool = useTools((s) => s.tool);
  const request = useSheetRequest((s) => s.request);
  const [active, setActive] = useState<string | null>(null);
  const desktop = useDesktopLayout();
  const jump = usePanelJump();

  const inPanel = (id: string, fallback?: string) => () => {
    setActive(id);
    jump(id, fallback);
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
