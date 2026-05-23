import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MOCK_COMPANY } from '../mocks/dummy-data';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly auth = inject(AuthService);

  readonly company = signal(MOCK_COMPANY);
  readonly tenantId = computed(() => MOCK_COMPANY.id);
  readonly isReady = computed(() => this.auth.isAuthenticated());
  readonly role = this.auth.role;
  readonly isAdmin = this.auth.isAdmin;
  readonly isOperator = this.auth.isOperator;
}
