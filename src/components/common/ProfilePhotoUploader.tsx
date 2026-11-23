import { useState, useRef, useEffect } from 'react'
import { Camera, Check, Trash2, Upload, X, AlertCircle } from 'lucide-react'
import { Avatar } from '@/components/common/Avatar'
import {
  removeUserProfilePhoto,
  uploadUserProfilePhoto,
  validateProfilePhotoFile,
} from '@/lib/profilePhoto'

interface ProfilePhotoUploaderProps {
  uid: string
  name: string
  currentPhotoURL?: string
  isEditing: boolean
  onPhotoSaved: (newPhotoUrl: string) => Promise<void> | void
}

export function ProfilePhotoUploader({
  uid,
  name,
  currentPhotoURL,
  isEditing,
  onPhotoSaved,
}: ProfilePhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isBusyRef = useRef(false)

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Clean up object URL when preview changes or unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Clear pending preview if user exits edit mode
  useEffect(() => {
    if (!isEditing) {
      setPendingFile(null)
      setPreviewUrl(null)
      setErrorMsg(null)
      setStatusMsg(null)
    }
  }, [isEditing])

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setErrorMsg(null)
    setStatusMsg(null)

    const check = validateProfilePhotoFile(file)
    if (!check.valid) {
      setErrorMsg(check.error || 'Invalid image file.')
      return
    }

    const nextPreview = URL.createObjectURL(file)
    setPendingFile(file)
    setPreviewUrl(nextPreview)
  }

  const handleCancelPreview = () => {
    if (isBusyRef.current) return
    setPendingFile(null)
    setPreviewUrl(null)
    setErrorMsg(null)
  }

  const handleConfirmUpload = async () => {
    if (!pendingFile || !uid || isBusyRef.current) return
    isBusyRef.current = true
    setUploading(true)
    setErrorMsg(null)
    setStatusMsg(null)

    try {
      const downloadUrl = await uploadUserProfilePhoto(uid, pendingFile)
      await onPhotoSaved(downloadUrl)
      setPendingFile(null)
      setPreviewUrl(null)
      setStatusMsg('Profile photo saved!')
      window.setTimeout(() => setStatusMsg(null), 4000)
    } catch (err) {
      console.error('Failed to upload profile photo:', err)
      const code = (err as { code?: string })?.code
      if (code === 'storage/unauthorized') {
        setErrorMsg(
          'Upload rejected by Firebase Storage rules (storage/unauthorized). Ensure storage.rules is published.'
        )
      } else if (
        code === 'storage/timeout' ||
        code === 'storage/canceled' ||
        code === 'storage/retry-limit-exceeded'
      ) {
        setErrorMsg(
          `Upload timed out (${code}). Check Firebase Storage bucket/CORS configuration and try again.`
        )
      } else {
        setErrorMsg(
          `Could not upload profile photo${code ? ` (${code})` : ''}. Your existing photo was kept.`
        )
      }
    } finally {
      isBusyRef.current = false
      setUploading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!uid || isBusyRef.current || !currentPhotoURL) return
    isBusyRef.current = true
    setRemoving(true)
    setErrorMsg(null)
    setStatusMsg(null)

    try {
      await removeUserProfilePhoto(uid)
      await onPhotoSaved('')
      setPendingFile(null)
      setPreviewUrl(null)
      setStatusMsg('Profile photo removed.')
      window.setTimeout(() => setStatusMsg(null), 4000)
    } catch (err) {
      console.error('Failed to remove profile photo:', err)
      const code = (err as { code?: string })?.code
      setErrorMsg(`Could not remove profile photo${code ? ` (${code})` : ''}. Please try again.`)
    } finally {
      isBusyRef.current = false
      setRemoving(false)
    }
  }

  const displayedPhotoUrl = previewUrl || currentPhotoURL || ''

  return (
    <div className="flex flex-col items-center sm:items-start gap-2.5 shrink-0">
      <div className="relative group">
        <Avatar
          src={displayedPhotoUrl}
          name={name}
          size="xl"
          className="ring-4 ring-slate-100"
        />
        {isEditing && !pendingFile && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            title={currentPhotoURL ? 'Change profile photo' : 'Upload profile photo'}
            id="avatar-camera-overlay-btn"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm border-2 border-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <Camera size={14} />
          </button>
        )}
      </div>

      {isEditing && (
        <div className="flex flex-col items-center sm:items-start gap-2 max-w-[240px]">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleSelectFile}
            className="hidden"
            id="profile-photo-file-input"
          />

          {pendingFile ? (
            <div className="space-y-1.5 text-center sm:text-left">
              <p className="text-[11px] font-medium text-slate-600 truncate max-w-[220px]">
                Preview: <strong className="text-slate-800">{pendingFile.name}</strong> (
                {(pendingFile.size / 1024).toFixed(0)} KB)
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={uploading}
                  id="confirm-profile-photo-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Check size={12} />
                  <span>{uploading ? 'Uploading…' : 'Confirm Upload'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  id="cancel-profile-photo-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  <X size={12} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || removing}
                id="select-profile-photo-btn"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload size={11} />
                <span>{currentPhotoURL ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
              {currentPhotoURL && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading || removing}
                  id="remove-profile-photo-btn"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  <span>{removing ? 'Removing…' : 'Remove'}</span>
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400">JPG, PNG, or WebP • Max 5 MB</p>

          {statusMsg && (
            <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
              <Check size={12} />
              <span>{statusMsg}</span>
            </p>
          )}

          {errorMsg && (
            <p className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
