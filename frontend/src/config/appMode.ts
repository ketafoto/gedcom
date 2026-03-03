const mode = (import.meta.env.VITE_APP_MODE ?? 'admin').toLowerCase();

export const appMode = mode === 'public' ? 'public' : 'admin';
export const isPublicApp = appMode === 'public';
