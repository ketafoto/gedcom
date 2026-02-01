import apiClient from './client';
import type { Media, MediaCreate, MediaUpdate } from '../types/models';

export interface MediaListParams {
  skip?: number;
  limit?: number;
  individual_id?: number;
  family_id?: number;
}

export const mediaApi = {
  /**
   * List media with optional filtering
   */
  list: async (params: MediaListParams = {}): Promise<Media[]> => {
    const response = await apiClient.get<Media[]>('/media', { params });
    return response.data;
  },

  /**
   * Get a single media by ID
   */
  get: async (id: number): Promise<Media> => {
    const response = await apiClient.get<Media>(`/media/${id}`);
    return response.data;
  },

  /**
   * Upload a media file
   */
  upload: async (
    file: File,
    metadata: Omit<MediaCreate, 'file_path'>
  ): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await apiClient.post<Media>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Update media metadata
   */
  update: async (id: number, data: MediaUpdate): Promise<Media> => {
    const response = await apiClient.put<Media>(`/media/${id}`, data);
    return response.data;
  },

  /**
   * Delete a media
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/media/${id}`);
  },

  /**
   * Get file URL for a media
   */
  getFileUrl: (id: number): string => {
    return `/api/media/${id}/file`;
  },
};

