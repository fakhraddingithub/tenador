'use client';

import { useState } from 'react';

export default function ImageUpload({
  label,
  value,
  onChange,
  folder = 'product',
  required = false,
  multiple = false,
  accept = 'image/*',
  className = '',
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || (multiple ? [] : null));

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          uploadedUrls.push(data.url);
        } else {
          throw new Error(data.error || 'خطا در آپلود فایل');
        }
      }

      if (multiple) {
        const newUrls = [...(preview || []), ...uploadedUrls];
        setPreview(newUrls);
        onChange(newUrls);
      } else {
        setPreview(uploadedUrls[0]);
        onChange(uploadedUrls[0]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.message || 'خطا در آپلود فایل');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    if (multiple) {
      const newUrls = preview.filter((_, i) => i !== index);
      setPreview(newUrls);
      onChange(newUrls);
    } else {
      setPreview(null);
      onChange('');
    }
  };

  return (
    <div className={`mb-6 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      
      <div className="space-y-4">
        <div className="relative">
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            multiple={multiple}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {uploading && (
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg
                className="animate-spin h-5 w-5 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          )}
        </div>

        {uploading && (
          <p className="text-sm text-gray-500">در حال آپلود...</p>
        )}

        {preview && (
          <div className={`grid gap-4 ${multiple ? 'grid-cols-2 md:grid-cols-4' : ''}`}>
            {multiple ? (
              preview.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="relative group">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-w-md h-64 object-contain rounded-lg border border-gray-300 bg-white p-2"
                />
                <button
                  type="button"
                  onClick={() => removeImage()}
                  className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}














