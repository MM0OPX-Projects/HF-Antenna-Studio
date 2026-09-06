/** In-memory hand-off used when a saved specialist module is reopened. */
let pending: { moduleId: string; state: unknown } | null = null;

export function setPendingModuleProject(moduleId: string, state: unknown): void {
  pending = { moduleId, state: structuredClone(state) };
}

export function consumePendingModuleProject<T>(moduleId: string): T | null {
  if (!pending || pending.moduleId !== moduleId) return null;
  const state = structuredClone(pending.state) as T;
  pending = null;
  return state;
}
