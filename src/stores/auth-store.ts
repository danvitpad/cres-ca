/** --- YAML
 * name: Auth Store
 * description: Zustand store for current user session, role, and subscription tier
 * --- */

import { create } from 'zustand';
import type { UserRole, SubscriptionTier } from '@/types';

interface AuthState {
  userId: string | null;
  role: UserRole | null;
  tier: SubscriptionTier | null;
  fullName: string | null;
  isLoading: boolean;
  setAuth: (userId: string, role: UserRole, tier: SubscriptionTier | null, fullName?: string | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role: null,
  tier: null,
  fullName: null,
  isLoading: true,
  setAuth: (userId, role, tier, fullName) => set({ userId, role, tier, fullName: fullName ?? null, isLoading: false }),
  clearAuth: () => set({ userId: null, role: null, tier: null, fullName: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
