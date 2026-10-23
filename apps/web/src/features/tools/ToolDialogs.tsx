import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { useTools, type Tool } from './useTools';

const ScannerPanel = lazy(() => import('../scanner/ScannerPanel'));
const RestaurantDirectory = lazy(() => import('../restaurants/RestaurantDirectory'));
const VisaPanel = lazy(() => import('../visa/VisaPanel'));
const TripsPanel = lazy(() => import('../trips/TripsPanel'));
const BookingPanel = lazy(() => import('../booking/BookingPanel'));

const PANELS: Record<Tool, React.LazyExoticComponent<() => JSX.Element>> = {
  trips: TripsPanel,
  scan: ScannerPanel,
  eat: RestaurantDirectory,
  visa: VisaPanel,
  book: BookingPanel,
};

/** The planner's tool dialogs (scanner, restaurants, visa). Each panel is its own lazy chunk. */
export function ToolDialogs() {
  const { t } = useTranslation();
  const tool = useTools((s) => s.tool);
  const close = useTools((s) => s.close);
  const Panel = tool ? PANELS[tool] : null;

  return (
    <Dialog
      open={tool !== null}
      onClose={close}
      eyebrow={tool ? t(`tools.${tool}.eyebrow`) : undefined}
      title={tool ? t(`tools.${tool}.title`) : ''}
    >
      {Panel ? (
        <Suspense
          fallback={
            <p role="status" className="py-10 text-center text-sm text-mist">
              {t('tools.loading')}
            </p>
          }
        >
          <Panel />
        </Suspense>
      ) : null}
    </Dialog>
  );
}
