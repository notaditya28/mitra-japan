import { playPortal } from '../../lib/portal';
import { navigate } from '../../lib/router';
import { useAppStore } from '../../store/useAppStore';

/** "Build my trip": fly through the portal to sign-in, or straight to the planner if already signed in. */
export function startTrip(): void {
  const signedIn = useAppStore.getState().user !== null;
  playPortal(() => navigate(signedIn ? 'plan' : 'login'));
}
