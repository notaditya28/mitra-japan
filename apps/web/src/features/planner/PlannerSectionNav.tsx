import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBar, type SectionItem } from '../../components/SectionNav';
import { usePanelJump } from './panelJump';
import { useTools } from '../tools/useTools';
import { usePlannerStore } from './usePlannerStore';

/**
 * The planner's section bar (lazy, so the planner store stays out of first paint):
 * jump to trip options or the itinerary, or open a tool. The map and its layers have
 * their own toolbar on the map, and Ask Mitra is the floating button at the bottom left
 * (owner request, 2026-10-25).
 */
export default function PlannerSectionNav({ solid }: { solid: boolean }) {
  const { t } = useTranslation();
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  const openTool = useTools((s) => s.open);
  const tool = useTools((s) => s.tool);
  const [active, setActive] = useState<string | null>(null);
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
      id: 'trip-options',
      label: t('sections.planTrip'),
      go: inPanel('trip-options', 'trip-guide'),
    },
    ...(hasPlan
      ? [{ id: 'itinerary', label: t('sections.itinerary'), go: inPanel('itinerary') }]
      : []),
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
