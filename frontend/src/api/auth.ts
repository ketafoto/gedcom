import apiClient from './client';
import type { Viewer } from '../types/models';

// Authentication is disabled - only the /me endpoint is used
export const authApi = {
  /**
   * Get current viewer info
   */
  me: async (): Promise<Viewer> => {
    const response = await apiClient.get<Viewer>('/auth/me');
    return response.data;
  },
};

