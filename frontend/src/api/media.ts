import apiClient from './client';
import type { Media, MediaCreate, MediaUpdate } from '../types/models';

export interface MediaListParams {
  skip?: number;
  limit?: number;
  individual_id?: number;
  family_id?: number;
}

export interface PhotoUploadParams {
  file: Blob;
  individual_id: number;
  age_on_photo: number;
  is_default: boolean;
}

export const mediaApi = {
  list: async (params: MediaListParams = {}): Promise<Media[]> => {
    const response = await apiClient.get<Media[]>('/media', { params });
    return response.data;
  },

  get: async (id: number): Promise<Media> => {
    const response = await apiClient.get<Media>(`/media/${id}`);
    return response.data;
  },

  uploadPhoto: async (params: PhotoUploadParams): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', params.file, 'photo.jpg');
    formData.append('individual_id', String(params.individual_id));
    formData.append('age_on_photo', String(params.age_on_photo));
    formData.append('is_default', String(params.is_default));

    const response = await apiClient.post<Media>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  upload: async (
    file: File,
    metadata: Omit<MediaCreate, 'file_path'>
  ): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await apiClient.post<Media>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  setDefault: async (id: number): Promise<Media> => {
    const response = await apiClient.put<Media>(`/media/${id}/set-default`);
    return response.data;
  },

  update: async (id: number, data: MediaUpdate): Promise<Media> => {
    const response = await apiClient.put<Media>(`/media/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/media/${id}`);
  },

  getFileUrl: (id: number): string => {
    return `/api/media/${id}/file`;
  },
};
