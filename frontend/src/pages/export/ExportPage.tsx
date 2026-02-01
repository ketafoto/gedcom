import { useState } from 'react';
import { Download, FileText, FolderArchive, Loader2, CheckCircle } from 'lucide-react';
import apiClient from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import toast from 'react-hot-toast';

type ExportStatus = 'idle' | 'generating' | 'ready' | 'error';

export function ExportPage() {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleExport = async () => {
    setStatus('generating');
    setDownloadUrl(null);

    try {
      const response = await apiClient.post('/export/gedcom', {}, {
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let extractedFileName = 'genealogy_export.zip';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) {
          extractedFileName = match[1];
        }
      }

      // Create download URL
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      
      setDownloadUrl(url);
      setFileName(extractedFileName);
      setStatus('ready');
      toast.success('Export ready for download');
    } catch (error) {
      setStatus('error');
      toast.error('Failed to generate export');
    }
  };

  const handleDownload = () => {
    if (!downloadUrl) return;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Download started');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export</h1>
        <p className="text-gray-600 mt-1">
          Export your genealogy database to GEDCOM format
        </p>
      </div>

      {/* Export Card */}
      <Card>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <FolderArchive className="w-8 h-8 text-emerald-600" />
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            GEDCOM Export
          </h2>
          
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Export your complete genealogy database as a GEDCOM 5.5.1 file, 
            along with all associated media files, packaged in a ZIP archive.
          </p>

          {status === 'idle' && (
            <Button onClick={handleExport} size="lg">
              <Download className="w-5 h-5 mr-2" />
              Generate Export
            </Button>
          )}

          {status === 'generating' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating export...</span>
              </div>
              <p className="text-sm text-gray-500">
                This may take a moment depending on the size of your database.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Export ready!</span>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-gray-600 bg-gray-50 rounded-lg p-4">
                <FileText className="w-5 h-5" />
                <span className="font-mono text-sm">{fileName}</span>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button onClick={handleDownload} size="lg">
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </Button>
                <Button variant="secondary" onClick={handleExport}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-red-600">
                Failed to generate export. Please try again.
              </p>
              <Button onClick={handleExport}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Info Card */}
      <Card title="What's Included">
        <ul className="space-y-3 text-gray-600">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>Complete GEDCOM 5.5.1 format file with all individuals, families, and events</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>All associated media files (photos, videos, audio)</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>Packaged as a single ZIP archive for easy sharing</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

