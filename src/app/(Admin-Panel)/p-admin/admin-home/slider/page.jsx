"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMove,
  FiSave,
  FiLoader,
} from "react-icons/fi";
import Image from "next/image";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Link from "next/link";
import Swal from 'sweetalert2';

export default function SliderManagement() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ۱. دریافت اسلایدها
  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      const res = await fetch("/api/slides?position=home");
      const data = await res.json();
      setSlides(data);
    } catch (error) {
      toast.error("خطا در بارگذاری اطلاعات!", {
        position: "top-center",
        rtl: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // ۲. هندل کردن جابجایی و Reorder
  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(slides);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSlides(items);

    setIsSaving(true);
    try {
      const res = await fetch("/api/slides/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: "home",
          orderedIds: items.map((s) => s._id),
        }),
      });

      if (res.ok) {
        toast.success("ترتیب با موفقیت بروزرسانی شد", {
          toastId: "reorder-success", // ای‌دی ثابت برای جلوگیری از تکرار
          position: "top-left",
          rtl: true,
          theme: "colored",
          autoClose: 2000,
          style: { backgroundColor: "var(--color-primary)" },
        });
      }
    } catch (error) {
      toast.error("خطا در ذخیره‌سازی ترتیب جدید");
      fetchSlides();
    } finally {
      setIsSaving(false);
    }
  };

const handleDelete = async (id) => {
  // ۱. نمایش پنجره تایید با استایل سفارشی
  const result = await Swal.fire({
    title: 'آیا مطمئن هستید؟',
    text: "این اسلاید برای همیشه پاک خواهد شد و قابل بازیابی نیست!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#aa4725', // استفاده از متغیر رنگی سایت شما
    cancelButtonColor: '#d33',
    confirmButtonText: 'بله، حذفش کن!',
    cancelButtonText: 'انصراف',
    reverseButtons: true, // برای اینکه در فارسی دکمه تایید سمت راست باشد
    background: '#ffffff',
    color: '#0d0d0d',
    customClass: {
      popup: 'rounded-[var(--radius)]', // هماهنگی با شعاع لبه‌های سایت شما
    }
  });

  // ۲. اگر کاربر تایید کرد
  if (result.isConfirmed) {
    // نمایش لودینگ روی دکمه یا کل صفحه
    Swal.fire({
      title: 'در حال حذف...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch(`/api/slides/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // حذف موفقیت‌آمیز از استیت
        setSlides((prev) => prev.filter((slide) => slide._id !== id));

        // اطلاع‌رسانی نهایی
        Swal.fire({
          title: 'حذف شد!',
          text: 'اسلاید با موفقیت از سیستم حذف گردید.',
          icon: 'success',
          confirmButtonColor: '#aa4725',
          confirmButtonText: 'تایید',
          customClass: {
            popup: 'rounded-[var(--radius)]',
          }
        });
      } else {
        throw new Error("خطا در حذف از دیتابیس");
      }
    } catch (error) {
      Swal.fire({
        title: 'خطا!',
        text: 'مشکلی در عملیات حذف پیش آمد. دوباره تلاش کنید.',
        icon: 'error',
        confirmButtonColor: '#aa4725',
      });
    }
  }
};

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-10 " dir="rtl">
      {/* کامپوننت توستیفای */}
      <ToastContainer />

      <div className="max-w-5xl mx-auto">
        {/* هدر صفحه */}
        <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-[var(--radius)] shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              مدیریت اسلایدر
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              ترتیب نمایش را با کشیدن و رها کردن تغییر دهید
            </p>
          </div>
          <Link href={"/p-admin/admin-home/slider/create"}>
            <button className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-6 py-3 rounded-[var(--radius)] font-bold hover:scale-105 transition-all shadow-lg shadow-[var(--color-primary)]/20">
              <FiPlus size={22} />
              افزودن اسلاید
            </button>
          </Link>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <FiLoader className="animate-spin text-4xl text-[var(--color-primary)]" />
            <span className="text-gray-400 font-bold">
              در حال بارگذاری اسلایدها...
            </span>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="slides">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3"
                >
                  {slides.map((slide, index) => (
                    <Draggable
                      key={slide._id}
                      draggableId={slide._id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-white p-3 rounded-[var(--radius)] border-2 transition-all flex items-center gap-4 ${
                            snapshot.isDragging
                              ? "border-[var(--color-primary)] shadow-2xl scale-[1.02] z-50"
                              : "border-gray-50 shadow-sm"
                          }`}
                        >
                          {/* دستگیره جابجایی */}
                          <div
                            {...provided.dragHandleProps}
                            className="text-gray-300 hover:text-[var(--color-primary)] p-2"
                          >
                            <FiMove size={20} />
                          </div>

                          {/* تصویر بندانگشتی */}
                          <div className="relative w-24 h-14 rounded-[4px] overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                            <Image
                              src={slide.image || "/images/placeholder.jpg"}
                              alt={slide.title}
                              fill
                              className="object-cover"
                            />
                          </div>

                          {/* اطلاعات اسلاید */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[var(--color-text)] truncate text-base">
                              {slide.title}
                            </h3>
                            <p className="text-[10px] text-gray-400 truncate mt-1 font-mono">
                              {slide.link || "بدون لینک هدایت کننده"}
                            </p>
                          </div>

                          {/* دکمه‌های کنترلی */}
                          <div className="flex items-center gap-1">
                            {/* دکمه ویرایش - هدایت به صفحه ادیت با آی‌دی اسلاید */}
                            <Link
                              href={`/p-admin/admin-home/slider/edit/${slide._id}`}
                              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[var(--color-text)] rounded-[var(--radius)] transition-all"
                            >
                              <FiEdit2 size={16} />
                            </Link>

                            {/* دکمه حذف - فراخوانی تابع حذف */}
                            <button
                              onClick={() => handleDelete(slide._id)}
                              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-[var(--radius)] transition-all"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {/* فیدبک ذخیره‌سازی ترتیب */}
        {isSaving && (
          <div className="fixed bottom-8 left-8 bg-[var(--color-text)] text-white px-5 py-3 rounded-[var(--radius)] flex items-center gap-3 shadow-2xl z-50 border border-white/10">
            <FiLoader className="animate-spin text-[var(--color-secondary)]" />
            <span className="text-xs font-bold tracking-tighter">
              در حال ذخیره چیدمان...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
