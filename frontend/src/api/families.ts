import apiClient from './client';
import type { Family, FamilyCreate, FamilyUpdate } from '../types/models';
import type { ListParams } from './individuals';

export const familiesApi = {
  /**
   * List all families with pagination
   */
  list: async (params: ListParams = {}): Promise<Family[]> => {
    const response = await apiClient.get<Family[]>('/families', { params });
    return response.data;
  },

  /**
   * Get a single family by ID
   */
  get: async (id: number): Promise<Family> => {
    const response = await apiClient.get<Family>(`/families/${id}`);
    return response.data;
  },

  /**
   * Create a new family
   */
  create: async (data: FamilyCreate): Promise<Family> => {
    const response = await apiClient.post<Family>('/families', data);
    return response.data;
  },

  /**
   * Update a family
   */
  update: async (id: number, data: FamilyUpdate): Promise<Family> => {
    const response = await apiClient.put<Family>(`/families/${id}`, data);
    return response.data;
  },

  /**
   * Delete a family
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/families/${id}`);
  },
};

