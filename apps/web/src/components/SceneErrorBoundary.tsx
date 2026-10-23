import { Component, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Keeps the page alive if the 3D chunk fails to load or WebGL throws: the
 * journey falls back to its static backdrop instead of a blank screen.
 */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('3D journey failed, showing static backdrop instead.', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
