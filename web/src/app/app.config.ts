import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { APP_DATE_FORMATS, AppDateAdapter } from './core/date';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideNativeDateAdapter(APP_DATE_FORMATS),
    // Must follow provideNativeDateAdapter() — it wins the DateAdapter token.
    { provide: DateAdapter, useClass: AppDateAdapter },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
