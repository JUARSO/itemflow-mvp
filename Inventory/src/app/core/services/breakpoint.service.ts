import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly _width = signal<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  readonly width = this._width.asReadonly();
  readonly isMobile = computed(() => this._width() < 768);
  readonly isTablet = computed(() => this._width() >= 768 && this._width() < 1200);
  readonly isDesktop = computed(() => this._width() >= 1200);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this._width.set(window.innerWidth));
    }
  }
}
