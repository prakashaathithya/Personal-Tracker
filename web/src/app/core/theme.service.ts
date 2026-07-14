import { Injectable, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ft-theme';

/**
 * Controls the app color scheme. The Material theme is built with
 * `color-scheme: light dark`, so forcing `color-scheme` on the root
 * element flips every `light-dark()` token. 'system' clears the
 * override and falls back to the OS preference.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStored());

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = document.documentElement;
      if (mode === 'system') {
        root.style.removeProperty('color-scheme');
      } else {
        root.style.colorScheme = mode;
      }
      localStorage.setItem(STORAGE_KEY, mode);
    });
  }

  /** Whether dark pixels are currently on screen (resolves 'system'). */
  isDark(): boolean {
    const mode = this.mode();
    if (mode === 'system') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
    return mode === 'dark';
  }

  /** Toggle between an explicit light and dark scheme. */
  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }
}

function readStored(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  // Calm Indigo is light-first; dark remains available via the toggle.
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'light';
}
