import { Injectable, signal, computed } from '@angular/core';
import { Member, UserRole } from '../models';
import { MOCK_MEMBERS } from '../mocks/dummy-data';

const STORAGE_KEY = 'itemflow_session_v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<Member | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isOperator = computed(() => this.role() === 'operator');

  constructor() {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try { this._user.set(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }

  async login(email: string, _password: string, roleHint: UserRole = 'admin'): Promise<Member> {
    await new Promise(r => setTimeout(r, 400));
    const existing = MOCK_MEMBERS.find(m => m.email.toLowerCase() === email.toLowerCase());
    const user: Member = existing ?? {
      uid: roleHint === 'admin' ? 'u-admin' : 'u-op-demo',
      email,
      displayName: email.split('@')[0],
      role: roleHint,
      active: true,
    };
    this._user.set(user);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  logout(): void {
    this._user.set(null);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  switchRole(role: UserRole): void {
    const u = this._user();
    if (!u) return;
    const updated = { ...u, role };
    this._user.set(updated);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
}
