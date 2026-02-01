import apiClient from './client';
import type { Event, EventCreate, EventUpdate } from '../types/models';

export interface EventListParams {
  skip?: number;
  limit?: number;
  individual_id?: number;
  family_id?: number;
}

export const eventsApi = {
  /**
   * List events with optional filtering
   */
  list: async (params: EventListParams = {}): Promise<Event[]> => {
    const response = await apiClient.get<Event[]>('/events', { params });
    return response.data;
  },

  /**
   * Get a single event by ID
   */
  get: async (id: number): Promise<Event> => {
    const response = await apiClient.get<Event>(`/events/${id}`);
    return response.data;
  },

  /**
   * Create a new event
   */
  create: async (data: EventCreate): Promise<Event> => {
    const response = await apiClient.post<Event>('/events', data);
    return response.data;
  },

  /**
   * Update an event
   */
  update: async (id: number, data: EventUpdate): Promise<Event> => {
    const response = await apiClient.put<Event>(`/events/${id}`, data);
    return response.data;
  },

  /**
   * Delete an event
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/events/${id}`);
  },
};

