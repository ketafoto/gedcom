import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Main pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { IndividualsListPage } from './pages/individuals/IndividualsListPage';
import { IndividualDetailPage } from './pages/individuals/IndividualDetailPage';
import { IndividualFormPage } from './pages/individuals/IndividualFormPage';
import { FamiliesListPage } from './pages/families/FamiliesListPage';
import { FamilyDetailPage } from './pages/families/FamilyDetailPage';
import { FamilyFormPage } from './pages/families/FamilyFormPage';
import { BulkEditIndividualsPage } from './pages/bulk-edit/BulkEditIndividualsPage';
import { BulkEditFamiliesPage } from './pages/bulk-edit/BulkEditFamiliesPage';
import { ExportPage } from './pages/export/ExportPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* All routes - no authentication required */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              
              {/* Individuals */}
              <Route path="individuals" element={<IndividualsListPage />} />
              <Route path="individuals/new" element={<IndividualFormPage />} />
              <Route path="individuals/:id" element={<IndividualDetailPage />} />
              <Route path="individuals/:id/edit" element={<IndividualFormPage />} />
              
              {/* Families */}
              <Route path="families" element={<FamiliesListPage />} />
              <Route path="families/new" element={<FamilyFormPage />} />
              <Route path="families/:id" element={<FamilyDetailPage />} />
              <Route path="families/:id/edit" element={<FamilyFormPage />} />
              
              {/* Bulk Edit */}
              <Route path="bulk-edit/individuals" element={<BulkEditIndividualsPage />} />
              <Route path="bulk-edit/families" element={<BulkEditFamiliesPage />} />
              
              {/* Export */}
              <Route path="export" element={<ExportPage />} />
              
              {/* Settings */}
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
