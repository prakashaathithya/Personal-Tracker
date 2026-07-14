import { Component, Input } from '@angular/core';

/**
 * MoneyMap brand mark — a map pin with a "$".
 *
 * Default: full mint gradient (white pin head, teal "$"), for use on dark/neutral
 * surfaces. `mono` renders a single-ink outline version meant to sit inside the
 * mint gradient brand square on the auth pages.
 */
@Component({
  selector: 'app-logo',
  template: `
    @if (mono) {
      <svg
        [attr.width]="size"
        [attr.height]="size"
        viewBox="0 0 48 48"
        fill="none"
        role="img"
        aria-label="MoneyMap logo"
      >
        <path
          d="M24 4C15.7 4 9 10.7 9 19c0 8 15 24 15 24s15-16 15-24C39 10.7 32.3 4 24 4z"
          [attr.stroke]="ink"
          stroke-width="2.6"
          stroke-linejoin="round"
        />
        <path
          d="M24 12.5v13M27 15.6c0-1.4-1.3-2.4-3-2.4s-3 1-3 2.3c0 1.3 1.1 2 3 2.3 1.9.3 3 1 3 2.3 0 1.3-1.3 2.4-3 2.4s-3-1-3-2.4"
          [attr.stroke]="ink"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    } @else {
      <svg
        [attr.width]="size"
        [attr.height]="size"
        viewBox="0 0 48 48"
        fill="none"
        role="img"
        aria-label="MoneyMap logo"
      >
        <defs>
          <linearGradient id="mm-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#34d399" />
            <stop offset="0.55" stop-color="#10b981" />
            <stop offset="1" stop-color="#0d9488" />
          </linearGradient>
        </defs>
        <path
          fill="url(#mm-grad)"
          d="M24 3C15.7 3 9 9.7 9 18c0 10.5 15 27 15 27s15-16.5 15-27C39 9.7 32.3 3 24 3z"
        />
        <circle cx="24" cy="18" r="9" fill="#ffffff" />
        <path
          d="M24 12.5v11M26.7 15.2c0-1.3-1.2-2.2-2.7-2.2s-2.7.9-2.7 2.1c0 1.2 1 1.8 2.7 2.1 1.7.3 2.7.9 2.7 2.1 0 1.2-1.2 2.2-2.7 2.2s-2.7-.9-2.7-2.2"
          stroke="#0d9488"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    }
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class LogoComponent {
  @Input() size = 32;
  /** Render a single-ink outline version (for the mint brand square). */
  @Input() mono = false;
  /** Ink color used by the mono variant. */
  @Input() ink = '#0c1410';
}
