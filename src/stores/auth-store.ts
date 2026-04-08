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
  isLoading: boolean;
  setAuth: (userId: string, role: UserRole, tier: SubscriptionTier) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role: null,
  tier: null,
  isLoading: true,
  setAuth: (userId, role, tier) => set({ userId, role, tier, isLoading: false }),
  clearAuth: () => set({ userId: null, role: null, tier: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
