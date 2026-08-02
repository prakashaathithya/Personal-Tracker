import { Injectable } from '@angular/core';
import { MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/** Marker the adapter recognises as "render/parse as dd-MM-yyyy". */
const DMY = { appFormat: 'dd-MM-yyyy' } as const;

/**
 * Native adapter with the day-first format the app already displayed when
 * the fields were native `<input type="date">`. The default native adapter
 * defers to the browser locale, which flips to MM/dd on an en-US machine.
 */
@Injectable()
export class AppDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    if (displayFormat === DMY) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${d}-${m}-${date.getFullYear()}`;
    }
    return super.format(date, displayFormat);
  }

  override parse(value: any, parseFormat?: any): Date | null {
    if (typeof value === 'string' && parseFormat === DMY) {
      const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value.trim());
      if (!m) return super.parse(value, parseFormat);
      return this.createDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    return super.parse(value, parseFormat);
  }
}

export const APP_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: DMY },
  display: {
    dateInput: DMY,
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

/** `yyyy-MM-dd` (as stored and sent to the API) → local `Date`. */
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Local `Date` → `yyyy-MM-dd`, without the UTC shift `toISOString()` adds. */
export function dateToIso(date: Date | null | undefined): string {
  if (!date) return '';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
