import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'

interface UploadZoneProps {
  onUpload: (file: File) => void
  isUploading: boolean
}

export default function UploadZone({ onUpload, isUploading }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file?.type === 'application/pdf') {
        setSelectedFile(file)
      }
    },
    [],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleSubmit = () => {
    if (selectedFile) onUpload(selectedFile)
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      <div
        className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200"
        style={{
          borderColor: isDragging ? 'var(--primary-100)' : 'var(--bg-300)',
          backgroundColor: isDragging
            ? 'rgba(255, 102, 0, 0.04)'
            : 'var(--bg-200)',
          opacity: isUploading ? 0.6 : 1,
          pointerEvents: isUploading ? 'none' : 'auto',
        }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={e => {
          if (!isDragging && !isUploading) {
            e.currentTarget.style.borderColor = 'var(--accent-200)'
            e.currentTarget.style.backgroundColor = 'var(--bg-200)'
          }
        }}
        onMouseLeave={e => {
          if (!isDragging) {
            e.currentTarget.style.borderColor = 'var(--bg-300)'
            e.currentTarget.style.backgroundColor = 'var(--bg-200)'
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200"
          style={{
            backgroundColor: isDragging
              ? 'rgba(255, 102, 0, 0.1)'
              : 'var(--bg-300)',
          }}
        >
          <Upload
            className="w-8 h-8"
            style={{ color: isDragging ? 'var(--primary-100)' : 'var(--accent-200)' }}
          />
        </div>

        {selectedFile ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText
              className="w-4 h-4 shrink-0"
              style={{ color: 'var(--primary-100)' }}
            />
            <span className="font-semibold truncate max-w-xs" style={{ color: 'var(--text-100)' }}>
              {selectedFile.name}
            </span>
            <span className="shrink-0" style={{ color: 'var(--accent-200)' }}>
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-semibold" style={{ color: 'var(--text-100)' }}>
              Drop your PDF here
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--accent-200)' }}>
              or click to browse
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!selectedFile || isUploading}
        onClick={handleSubmit}
        className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200"
        style={
          selectedFile && !isUploading
            ? {
                backgroundColor: 'var(--primary-100)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255, 102, 0, 0.25)',
              }
            : {
                backgroundColor: 'var(--bg-300)',
                color: 'var(--accent-200)',
                cursor: 'not-allowed',
              }
        }
        onMouseEnter={e => {
          if (selectedFile && !isUploading) {
            e.currentTarget.style.backgroundColor = 'var(--primary-200)'
          }
        }}
        onMouseLeave={e => {
          if (selectedFile && !isUploading) {
            e.currentTarget.style.backgroundColor = 'var(--primary-100)'
          }
        }}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Process Document
          </>
        )}
      </button>
    </div>
  )
}
