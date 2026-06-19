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
        className={`
          relative flex flex-col items-center justify-center gap-4
          rounded-2xl border-2 border-dashed p-12 cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-violet-400 bg-violet-500/10'
            : 'border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className={`
          w-16 h-16 rounded-2xl flex items-center justify-center
          ${isDragging ? 'bg-violet-500/20' : 'bg-slate-700'}
          transition-colors duration-200
        `}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-violet-400' : 'text-slate-400'}`} />
        </div>

        {selectedFile ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-slate-200 font-medium truncate max-w-xs">{selectedFile.name}</span>
            <span className="text-slate-500 shrink-0">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-200 font-medium">Drop your PDF here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse</p>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!selectedFile || isUploading}
        onClick={handleSubmit}
        className={`
          flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl
          font-medium text-sm transition-all duration-200
          ${selectedFile && !isUploading
            ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer shadow-lg shadow-violet-500/20'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }
        `}
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
