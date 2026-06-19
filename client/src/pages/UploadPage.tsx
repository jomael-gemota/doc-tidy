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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-8 w-full max-w-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center ring-1 ring-violet-500/30">
            <FileSearch className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Doc Tidy</h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Upload a PDF and let Tidy extract structured JSON for you
            </p>
          </div>
        </div>

        <UploadZone onUpload={handleUpload} isUploading={isUploading} />

        {error && (
          <div className="w-full rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center">
          PDF files only · Your documents are processed securely
        </p>
      </div>
    </div>
  )
}
