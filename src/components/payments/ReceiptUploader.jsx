import React, { useState, useRef, useEffect } from 'react';
import { MdCloudUpload, MdDeleteOutline, MdImage, MdAddPhotoAlternate } from 'react-icons/md';
import { toast } from 'react-toastify';

const MAX_FILES = 5;
const MAX_SIZE  = 5 * 1024 * 1024;

const ReceiptUploader = ({ onFileChange }) => {
  const [items, setItems] = useState([]);
  const fileInputRef      = useRef(null);
  const canAddMore        = items.length < MAX_FILES;

  // ✅ اینجا onFileChange صدا زده میشه، نه داخل setItems
  useEffect(() => {
    onFileChange(items.filter((i) => i.url).map((i) => i.url));
  }, [items]); // eslint-disable-line

  const uploadFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('لطفاً فقط فایل تصویر بارگذاری کنید.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('حجم فایل نباید بیشتر از ۵ مگابایت باشد.');
      return;
    }

    const id = crypto.randomUUID();

    const preview = await new Promise((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(file);
    });

    // اضافه کردن placeholder
    setItems((prev) => [...prev, { id, preview, url: null, uploading: true }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'receipts');

      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'خطا در آپلود');

      // ✅ فقط state آپدیت میشه، onFileChange از useEffect صدا میشه
      setItems((prev) =>
        prev.map((i) => i.id === id ? { ...i, url: data.url, uploading: false } : i),
      );

      toast.success('رسید با موفقیت آپلود شد ✅');
    } catch (err) {
      console.error(err);
      toast.error('آپلود ناموفق بود ❌');
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleFileChange = async (e) => {
    const files     = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_FILES - items.length;
    const toProcess = files.slice(0, remaining);

    if (files.length > remaining) {
      toast.warning(`حداکثر ${MAX_FILES} تصویر مجاز است. فقط ${remaining} فایل اول پردازش شد.`);
    }

    await Promise.all(toProcess.map(uploadFile));

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = (id) => {
    // ✅ فقط state آپدیت میشه، onFileChange از useEffect صدا میشه
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-white rounded-[6px] border border-gray-200 p-6 shadow-md mb-6">

      <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
        <MdImage className="text-[var(--color-primary)] text-2xl" />
        <h2 className="text-lg font-bold">بارگذاری فیش واریزی</h2>
        <span className="mr-auto text-xs text-gray-400">
          {items.length} / {MAX_FILES}
        </span>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative rounded-[6px] overflow-hidden border border-gray-200 aspect-square bg-gray-50"
            >
              <img
                src={item.preview}
                alt="رسید"
                className="w-full h-full object-cover"
              />

              {item.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {!item.uploading && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shadow"
                >
                  <MdDeleteOutline className="text-base" />
                </button>
              )}
            </div>
          ))}

          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-[6px] border-2 border-dashed border-gray-300 hover:border-[var(--color-primary)]/50 bg-gray-50 hover:bg-[var(--color-primary)]/5 flex flex-col items-center justify-center gap-1 transition text-gray-400 hover:text-[var(--color-primary)]"
            >
              <MdAddPhotoAlternate className="text-2xl" />
              <span className="text-xs">افزودن</span>
            </button>
          )}
        </div>
      )}

      {items.length === 0 && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 hover:border-[var(--color-primary)]/40 rounded-[6px] p-8 bg-gray-50 hover:bg-[var(--color-primary)]/5 cursor-pointer transition flex flex-col items-center justify-center gap-4"
        >
          <div className="p-4 bg-white rounded-full shadow-sm text-[var(--color-primary)]">
            <MdCloudUpload className="text-4xl" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-700">برای انتخاب فایل کلیک کنید</p>
            <p className="text-xs text-gray-400 mt-1">
              JPG، PNG — حداکثر ۵ مگابایت هر فایل، تا {MAX_FILES} تصویر
            </p>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        multiple
      />
    </div>
  );
};

export default ReceiptUploader;