'use client'

/**
 * AttachmentUploader — آپلودر پیوستِ تیکت (تصویر + PDF)
 *
 * از مکانیزم موجودِ POST /api/upload استفاده می‌کند (ImageKit، سقف ۵ مگابایت،
 * PDF به‌صورت private). خروجی: آرایه‌ای از {url, type, filename, size}
 * هم‌شکل با AttachmentSchema در models/TicketMessage.js.
 */

import { useRef, useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { Paperclip, FileText, X, Loader2 } from 'lucide-react'

const MAX_FILES = 6
const MAX_SIZE = 5 * 1024 * 1024 // هم‌راستا با /api/upload

function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
}

function isAllowedFile(file) {
  return file.type.startsWith('image/') || isPdfFile(file)
}

// برای پاک‌شدن پیوست‌ها بعد از ارسال، والد با تغییر prop `key` این کامپوننت را remount می‌کند
const AttachmentUploader = ({ onChange, disabled = false, compact = false }) => {
  const [items, setItems] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    onChange(
      items
        .filter((i) => i.url)
        .map((i) => ({
          url: i.url,
          type: i.isPdf ? 'pdf' : 'image',
          filename: i.filename,
          size: i.size,
        })),
    )
  }, [items]) // eslint-disable-line

  const uploading = items.some((i) => i.uploading)

  const uploadFile = async (file) => {
    if (!isAllowedFile(file)) {
      toast.error('فقط تصویر (JPG/PNG/WebP) یا PDF مجاز است')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('حجم فایل نباید بیشتر از ۵ مگابایت باشد')
      return
    }

    const id = crypto.randomUUID()
    const isPdf = isPdfFile(file)

    const preview = isPdf
      ? null
      : await new Promise((res) => {
          const reader = new FileReader()
          reader.onloadend = () => res(reader.result)
          reader.readAsDataURL(file)
        })

    setItems((prev) => [
      ...prev,
      {
        id,
        preview,
        isPdf,
        filename: file.name,
        size: file.size,
        url: null,
        uploading: true,
      },
    ])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'tickets')

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در آپلود')

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, url: data.url, uploading: false } : i)),
      )
    } catch (err) {
      console.error(err)
      toast.error('آپلود پیوست ناموفق بود')
      setItems((prev) => prev.filter((i) => i.id !== id))
    }
  }

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remaining = MAX_FILES - items.length
    if (remaining <= 0) {
      toast.warning(`حداکثر ${MAX_FILES} پیوست مجاز است`)
    } else {
      if (files.length > remaining) {
        toast.warning(`حداکثر ${MAX_FILES} پیوست مجاز است؛ فقط ${remaining} فایل اول اضافه شد`)
      }
      await Promise.all(files.slice(0, remaining).map(uploadFile))
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[6px] pr-2 pl-7 py-1.5 max-w-[200px]"
            >
              {item.isPdf ? (
                <FileText className="text-[#aa4725] flex-shrink-0" size={16} />
              ) : (
                <img
                  src={item.preview}
                  alt=""
                  className="w-7 h-7 rounded object-cover flex-shrink-0"
                />
              )}
              <span className="text-[11px] text-gray-600 truncate" dir="ltr">
                {item.filename}
              </span>
              {item.uploading ? (
                <Loader2
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                  size={13}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="حذف پیوست"
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 transition"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled || uploading || items.length >= MAX_FILES}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#aa4725] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Paperclip size={14} />
        {compact ? 'پیوست' : 'افزودن پیوست (تصویر یا PDF — حداکثر ۵ مگابایت)'}
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,.pdf,application/pdf"
        multiple
      />
    </div>
  )
}

export default AttachmentUploader
