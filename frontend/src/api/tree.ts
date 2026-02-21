import apiClient from './client';
import type { TreeData } from '../types/models';

export interface TreeParams {
  ancestor_depth?: number;
  descendant_depth?: number;
}

export const treeApi = {
  /**
   * Get family tree data centered on an individual
   */
  getTree: async (individualId: number, params: TreeParams = {}): Promise<TreeData> => {
    const response = await apiClient.get<TreeData>(
      `/individuals/${individualId}/tree`,
      { params },
    );
    return response.data;
  },
};
