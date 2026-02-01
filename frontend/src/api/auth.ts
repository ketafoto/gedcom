import apiClient from './client';
import type { User } from '../types/models';

// Authentication is disabled - only the /me endpoint is used
export const authApi = {
  /**
   * Get current user info
   */
  me: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};

