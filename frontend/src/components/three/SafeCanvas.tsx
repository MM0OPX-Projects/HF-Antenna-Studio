import {
  Canvas,
  events as createPointerEvents,
  type CanvasProps,
  type EventManager,
  type RootStore,
} from "@react-three/fiber";

type SafeCanvasProps = Omit<CanvasProps, "events">;

/**
 * React Three Fiber configures a Canvas asynchronously. A route can unmount
 * before that setup finishes, leaving its internal event target null. Guarding
 * the event connection prevents the stale setup task from throwing while still
 * using the standard pointer-event manager for every mounted canvas.
 */
function createSafePointerEvents(store: RootStore): EventManager<HTMLElement> {
  const manager = createPointerEvents(store);
  const connect = manager.connect;

  return {
    ...manager,
    connect(target) {
      if (target) connect?.(target);
    },
  };
}

export function SafeCanvas(props: SafeCanvasProps) {
  return <Canvas {...props} events={createSafePointerEvents} />;
}
