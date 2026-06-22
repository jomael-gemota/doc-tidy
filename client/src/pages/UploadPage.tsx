import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSearch } from 'lucide-react'
import UploadZone from '../components/UploadZone'

export default function UploadPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
      }

      const { jobId } = await res.json() as { jobId: string }
      navigate(`/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      setIsUploading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ backgroundColor: 'var(--bg-100)' }}
    >
      <div className="flex flex-col items-center gap-8 w-full max-w-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(255, 102, 0, 0.08)',
              boxShadow: '0 0 0 1px rgba(255, 102, 0, 0.2)',
            }}
          >
            <FileSearch className="w-8 h-8" style={{ color: 'var(--primary-100)' }} />
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: 'var(--text-100)' }}
            >
              Doc Tidy
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--accent-200)' }}>
              Upload a PDF and let Tidy extract structured JSON for you
            </p>
          </div>
        </div>

        <UploadZone onUpload={handleUpload} isUploading={isUploading} />

        {error && (
          <div
            className="w-full rounded-xl px-4 py-3 text-sm"
            style={{
              backgroundColor: 'rgba(255, 102, 0, 0.06)',
              border: '1px solid rgba(255, 102, 0, 0.2)',
              color: 'var(--primary-100)',
            }}
          >
            {error}
          </div>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--bg-300)' }}>
          PDF files only · Your documents are processed securely
        </p>
      </div>
    </div>
  )
}
