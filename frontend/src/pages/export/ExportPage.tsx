import { useState } from 'react';
import { Download, FileText, FolderArchive, Loader2, CheckCircle, FileCode2 } from 'lucide-react';
import apiClient from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import toast from 'react-hot-toast';

type ExportStatus = 'idle' | 'generating' | 'ready' | 'error';

export function ExportPage() {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [rawStatus, setRawStatus] = useState<ExportStatus>('idle');
  const [rawFileName, setRawFileName] = useState<string>('');

  const handleExport = async () => {
    setStatus('generating');

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
      
      setFileName(extractedFileName);
      setStatus('ready');
      toast.success('Export ready for download');

      const link = document.createElement('a');
      link.href = url;
      link.download = extractedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setStatus('error');
      toast.error('Failed to generate export');
    }
  };

  const handleRawExport = async () => {
    setRawStatus('generating');

    try {
      const response = await apiClient.post('/export/gedcom-raw', {}, {
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let extractedFileName = 'genealogy_export.ged';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) {
          extractedFileName = match[1];
        }
      }

      // Create download URL
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      setRawFileName(extractedFileName);
      setRawStatus('ready');
      toast.success('Raw export ready for download');

      const link = document.createElement('a');
      link.href = url;
      link.download = extractedFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setRawStatus('error');
      toast.error('Failed to generate raw export');
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-4 space-y-6 bg-white">
          <Card>
            <div className="text-center py-8 flex flex-col items-center justify-between min-h-[360px]">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                  <FolderArchive className="w-8 h-8 text-emerald-600" />
                </div>
                
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  GEDCOM Export
                </h2>
                
                <p className="text-gray-600 mb-6 max-w-md mx-auto min-h-[48px]">
                  Export your complete genealogy database as a GEDCOM 5.5.1 file, 
                  along with all associated media files, packaged in a ZIP archive.
                </p>
              </div>

              {status === 'idle' && (
                <div>
                  <Button onClick={handleExport} size="lg">
                    <Download className="w-5 h-5 mr-2" />
                    Generate Export
                  </Button>
                </div>
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
                <div className="w-full mt-auto">
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
                      <Button onClick={handleExport} size="lg">
                        <Download className="w-5 h-5 mr-2" />
                        Export Again
                      </Button>
                    </div>
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

        <div className="border border-gray-200 rounded-lg p-4 space-y-6 bg-white">
          <Card>
            <div className="text-center py-8 flex flex-col items-center justify-between min-h-[360px]">
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <FileCode2 className="w-8 h-8 text-blue-600" />
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Raw GEDCOM (Debug)
                </h2>

                <p className="text-gray-600 mb-6 max-w-md mx-auto min-h-[48px]">
                  Download a plain GEDCOM 5.5.1 text file without media files or ZIP archive.
                </p>
              </div>

              {rawStatus === 'idle' && (
                <div>
                  <Button onClick={handleRawExport} size="lg">
                    <Download className="w-5 h-5 mr-2" />
                    Generate Raw Export
                  </Button>
                </div>
              )}

              {rawStatus === 'generating' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-gray-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating raw export...</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    This should be quick for debugging workflows.
                  </p>
                </div>
              )}

              {rawStatus === 'ready' && (
                <div className="w-full mt-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-blue-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Raw export ready!</span>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-gray-600 bg-gray-50 rounded-lg p-4">
                      <FileText className="w-5 h-5" />
                      <span className="font-mono text-sm">{rawFileName}</span>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={handleRawExport} size="lg">
                        <Download className="w-5 h-5 mr-2" />
                        Export Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {rawStatus === 'error' && (
                <div className="space-y-4">
                  <p className="text-red-600">
                    Failed to generate raw export. Please try again.
                  </p>
                  <Button onClick={handleRawExport}>
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card title="What's Included">
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>Plain GEDCOM 5.5.1 text file with all individuals, families, and events</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>No media files included</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>No ZIP archive; direct .ged download</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

