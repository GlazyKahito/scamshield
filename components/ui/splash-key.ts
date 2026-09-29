/**
 * sessionStorage key marking that the loading screen has played this session.
 * Kept out of splash-screen.tsx: constants exported from a "use client" module
 * reach server components as client references, not values.
 */
export const SPLASH_SEEN_KEY = "scamshield:splash-seen";
