import apiClient from './client';
import type { LookupType } from '../types/models';

export const typesApi = {
  /**
   * Get sex types for dropdown
   */
  getSexTypes: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/sex');
    return response.data;
  },

  /**
   * Get event types for dropdown
   */
  getEventTypes: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/events');
    return response.data;
  },

  /**
   * Get media types for dropdown
   */
  getMediaTypes: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/media');
    return response.data;
  },

  /**
   * Get family member roles for dropdown
   */
  getFamilyRoles: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/family-roles');
    return response.data;
  },

  /**
   * Get individual name types for dropdown
   */
  getNameTypes: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/name-types');
    return response.data;
  },

  /**
   * Get approximate date types for dropdown
   */
  getDateApproxTypes: async (): Promise<LookupType[]> => {
    const response = await apiClient.get<LookupType[]>('/types/date-approx');
    return response.data;
  },
};

