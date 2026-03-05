import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, FolderArchive, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react';
import apiClient from '../../api/client';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

type ImportStatus = 'idle' | 'uploading' | 'success' | 'error';

export function ImportPage() {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setStatus('idle');
    setErrorMessage('');
    setResultMessage('');
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setStatus('idle');
    setErrorMessage('');
    setResultMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setStatus('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiClient.post('/import/gedcom', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      setStatus('success');
      const msg = response.data.media_files_copied != null
        ? `${response.data.message} (${response.data.media_files_copied} media files copied)`
        : response.data.message;
      setResultMessage(msg);
      toast.success('Import completed successfully');

      queryClient.invalidateQueries();
    } catch (error: unknown) {
      setStatus('error');
      let detail = 'Import failed. Please check the file and try again.';
      if (error && typeof error === 'object' && 'response' in error) {
        const resp = (error as { response?: { data?: { detail?: string } } }).response;
        if (resp?.data?.detail) detail = resp.data.detail;
      }
      setErrorMessage(detail);
      toast.error('Import failed');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isZip = selectedFile?.name.toLowerCase().endsWith('.zip') ||
    selectedFile?.type === 'application/zip' ||
    selectedFile?.type === 'application/x-zip-compressed';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import</h1>
        <p className="text-gray-600 mt-1">
          Import a GEDCOM file to replace the current database
        </p>
      </div>

      <Card>
        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <Upload className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              GEDCOM Import
            </h2>
            <p className="text-gray-600 text-center max-w-md">
              Upload a GEDCOM file (any extension) or a ZIP archive containing a GEDCOM file
              and an optional <code className="text-sm bg-gray-100 px-1 rounded">media/</code> folder.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragOver
                ? 'border-amber-400 bg-amber-50'
                : selectedFile
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleInputChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                {isZip ? (
                  <FolderArchive className="w-8 h-8 text-emerald-500" />
                ) : (
                  <FileText className="w-8 h-8 text-emerald-500" />
                )}
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearFile();
                  }}
                  className="ml-2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  Drop a file here or click to browse
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  ZIP archive or plain GEDCOM text file
                </p>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">This will replace all existing data</p>
              <p className="mt-1">
                Importing will clear the current database and replace it with data from the uploaded file.
                A backup of the current database will be created automatically.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {status === 'idle' && (
            <div className="flex justify-center">
              <Button onClick={handleImport} size="lg" disabled={!selectedFile}>
                <Upload className="w-5 h-5 mr-2" />
                Import
              </Button>
            </div>
          )}

          {status === 'uploading' && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Importing data...</span>
              </div>
              <p className="text-sm text-gray-500">
                This may take a moment depending on file size.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Import successful!</span>
              </div>
              {resultMessage && (
                <p className="text-sm text-gray-600">{resultMessage}</p>
              )}
              <Button onClick={handleClearFile} variant="secondary">
                Import Another File
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Import failed</span>
              </div>
              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}
              <div className="flex justify-center gap-3">
                <Button onClick={handleImport} disabled={!selectedFile}>
                  Try Again
                </Button>
                <Button onClick={handleClearFile} variant="secondary">
                  Choose Different File
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="ZIP Archive">
          <ul className="space-y-3 text-gray-600 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Contains a GEDCOM text file (any extension)</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Optional <code className="bg-gray-100 px-1 rounded">media/</code> folder with photos and documents</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Compatible with the full ZIP export from this app</span>
            </li>
          </ul>
        </Card>

        <Card title="Plain GEDCOM File">
          <ul className="space-y-3 text-gray-600 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>Standard GEDCOM 5.5.1 text file</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>Any file extension accepted (.ged, .txt, etc.)</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>No media files — data only</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
