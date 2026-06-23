import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import ReasoningStepper from '../components/ReasoningStepper'
import BatchTable from '../components/BatchTable'
import { useJobStream } from '../hooks/useJobStream'
import { useBatches } from '../hooks/useBatches'

// ---------------------------------------------------------------------------
// Compact inline file picker (no full drag-drop widget — just a slim bar)
// ---------------------------------------------------------------------------
interface CompactPickerProps {
  onUpload: (file: File) => void
  isUploading: boolean
}

function CompactPicker({ onUpload, isUploading }: CompactPickerProps) {
  const [selected, setSelected] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pick = (file: File | null | undefined) => {
    if (file?.type === 'application/pdf') setSelected(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    pick(e.dataTransfer.files[0])
  }, [])

  const handleSubmit = () => {
    if (selected) onUpload(selected)
  }

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex items-center gap-3">
      {/* Drop / click zone */}
      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors"
        style={{
          borderColor: isDragging ? 'var(--primary-100)' : 'var(--bg-300)',
          borderStyle: 'dashed',
          backgroundColor: isDragging ? 'rgba(255, 102, 0, 0.04)' : 'var(--bg-200)',
          opacity: isUploading ? 0.55 : 1,
          pointerEvents: isUploading ? 'none' : 'auto',
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => pick(e.target.files?.[0])}
        />
        <UploadCloud
          className="h-4 w-4 flex-shrink-0"
          style={{ color: selected ? 'var(--primary-100)' : 'var(--accent-200)' }}
        />
        {selected ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--primary-100)' }} />
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium"
              style={{ color: 'var(--text-100)' }}
            >
              {selected.name}
            </span>
            <span className="flex-shrink-0 text-xs" style={{ color: 'var(--accent-200)' }}>
              {(selected.size / 1024).toFixed(0)} KB
            </span>
            <button
              type="button"
              onClick={clear}
              className="flex-shrink-0 rounded p-0.5"
              style={{ color: 'var(--accent-200)' }}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-sm" style={{ color: 'var(--accent-200)' }}>
            Drop a PDF or <span style={{ color: 'var(--primary-100)' }}>browse</span>
          </span>
        )}
      </div>

      {/* Process button */}
      <button
        type="button"
        disabled={!selected || isUploading}
        onClick={handleSubmit}
        className="flex flex-shrink-0 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={
          selected && !isUploading
            ? {
                backgroundColor: 'var(--primary-100)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255, 102, 0, 0.25)',
              }
            : {
                backgroundColor: 'var(--bg-300)',
                color: 'var(--accent-200)',
                cursor: 'not-allowed',
              }
        }
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </>
        ) : (
          'Process'
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function IdpPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | undefined>(undefined)

  const { thinking, status } = useJobStream(activeJobId)
  const { batches, loading, error, refresh, deleteBatch, rerunBatch } = useBatches()

  const isActive = status === 'processing' || status === 'connecting'

  useEffect(() => {
    if (!activeJobId) return
    refresh()
  }, [status, activeJobId, refresh])

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }

      const { jobId } = (await res.json()) as { jobId: string }
      setActiveJobId(jobId)
      refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">

        {/* Upload + inline reasoning stepper */}
        <section
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{
            borderColor: 'var(--bg-300)',
            backgroundColor: 'var(--bg-100)',
            boxShadow: '0 8px 24px rgba(17, 24, 39, 0.06)',
          }}
        >
          {/* Compact header + picker row */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(255, 102, 0, 0.1)' }}
            >
              <UploadCloud className="h-4 w-4" style={{ color: 'var(--primary-100)' }} />
            </div>
            <span className="flex-shrink-0 text-sm font-semibold" style={{ color: 'var(--text-100)' }}>
              Upload document
            </span>

            <div className="min-w-0 flex-1">
              <CompactPicker onUpload={handleUpload} isUploading={isUploading} />
            </div>
          </div>

          {uploadError && (
            <div
              className="mx-5 mb-3 rounded-xl px-4 py-2.5 text-xs"
              style={{
                backgroundColor: 'rgba(255, 102, 0, 0.06)',
                border: '1px solid rgba(255, 102, 0, 0.2)',
                color: 'var(--primary-100)',
              }}
            >
              {uploadError}
            </div>
          )}

          {/* Inline reasoning stepper — only mounts when there is content or job is active */}
          <ReasoningStepper content={thinking} isActive={isActive} />
        </section>

        {/* Batches table */}
        <BatchTable
          batches={batches}
          loading={loading}
          error={error}
          onDelete={deleteBatch}
          onRerun={rerunBatch}
        />
      </div>
    </div>
  )
}
