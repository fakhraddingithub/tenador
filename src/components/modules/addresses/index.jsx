'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  FaMapMarkerAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaStar,
} from 'react-icons/fa'
import { FiHome, FiMapPin, FiPhone, FiUser } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import { joinAddressName, splitAddressName } from '@/lib/addressName.mjs'

const AddressesModule = () => {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    firstName: '',
    lastName: '',
    city: '',
    phone: '',
    postalCode: '',
    addressLine: '',
    isDefault: false,
  })

  useEffect(() => {
    fetchUserProfile()
    fetchAddresses()
  }, [])

  const fetchUserProfile = async () => {
    const res = await fetch('/api/auth/profile')
    if (res.ok) {
      const data = await res.json()
      setUser(data.user)
    }
  }

  const fetchAddresses = async () => {
    const res = await fetch('/api/addresses')
    if (res.ok) {
      const data = await res.json()
      setAddresses(
        [...data.addresses].sort(
          (a, b) => Number(b.isDefault) - Number(a.isDefault)
        )
      )
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url = editingAddress
      ? `/api/addresses/${editingAddress._id}`
      : '/api/addresses'

    const method = editingAddress ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        fullName: joinAddressName(formData.firstName, formData.lastName),
        firstName: undefined,
        lastName: undefined,
        user: user.id,
      }),
    })

    if (res.ok) {
      fetchAddresses()
      closeModal()
      toast.success('ذخیره شد')
    }
  }

  const setAsDefault = async (id) => {
    const res = await fetch(`/api/addresses/${id}/set-default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user.id }),
    })
    if (res.ok) fetchAddresses()
  }

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'حذف آدرس؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'حذف',
      cancelButtonText: 'لغو',
    })
    if (result.isConfirmed) {
      await fetch(`/api/addresses/${id}`, { method: 'DELETE' })
      fetchAddresses()
    }
  }

  const handleEdit = (address) => {
    setFormData({ ...address, ...splitAddressName(address.fullName) })
    setEditingAddress(address)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAddress(null)
    setFormData({
      title: '',
      firstName: '',
      lastName: '',
      city: '',
      phone: '',
      postalCode: '',
      addressLine: '',
      isDefault: false,
    })
  }

  if (loading) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between">
        <h1 className="flex items-center gap-2 font-semibold">
          <FaMapMarkerAlt />
          آدرس‌های من
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[hsl(var(--primary))] text-white px-3 py-2 rounded"
        >
          <FaPlus /> آدرس جدید
        </button>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {addresses.map((address) => (
     <motion.div
     key={address._id}
     initial={{ opacity: 0, y: 6 }}
     animate={{ opacity: 1, y: 0 }}
     className="
       relative
       rounded-[var(--radius)]
       border border-[hsl(var(--border))]
       bg-white
       p-4
       space-y-4
     "
   >
     {/* Default badge */}
     {address.isDefault && (
       <span
         className="
           absolute top-3 left-3
           rounded-md
           bg-[hsl(var(--primary))]
           px-2 py-1
           text-[11px]
           font-medium
           text-white
         "
       >
         پیش‌فرض
       </span>
     )}
   
     {/* Header */}
     <div className="space-y-0.5">
       <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
         {address.title}
       </p>
       <p className="text-xs text-[hsl(var(--muted-foreground))]">
         {address.fullName}
       </p>
     </div>
   
     {/* Info */}
     <div className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
       <div className="flex gap-2">
         <span className="w-16 shrink-0 opacity-60">شهر</span>
         <span>{address.city}</span>
       </div>
   
       <div className="flex gap-2">
         <span className="w-16 shrink-0 opacity-60">تلفن</span>
         <span>{address.phone}</span>
       </div>
   
       {address.postalCode && (
         <div className="flex gap-2">
           <span className="w-16 shrink-0 opacity-60">کد پستی</span>
           <span>{address.postalCode}</span>
         </div>
       )}
   
       <div className="flex gap-2">
         <span className="w-16 shrink-0 opacity-60">آدرس</span>
         <span className="leading-relaxed text-[hsl(var(--foreground))]">
           {address.addressLine}
         </span>
       </div>
     </div>
   
     {/* Actions */}
     <div className="flex items-center justify-end gap-3 pt-2">
       {!address.isDefault && (
         <button
           onClick={() => setAsDefault(address._id)}
           className="
             group
             flex items-center gap-1.5
             cursor-pointer
             rounded-md
             border border-[hsl(var(--border))]
             px-3 py-1.5
             text-xs
             text-[hsl(var(--foreground))]
             transition
             hover:bg-[hsl(var(--primary)/0.08)]
           "
         >
           <FaMapMarkerAlt className="text-[12px] opacity-70 group-hover:opacity-100" />
           پیش‌فرض
         </button>
       )}
   
       <button
         onClick={() => handleEdit(address)}
         className="
           group
           flex items-center gap-1.5
           cursor-pointer
           rounded-md
           border border-[hsl(var(--border))]
           px-3 py-1.5
           text-xs
           text-[hsl(var(--foreground))]
           transition
           hover:bg-[hsl(var(--muted))]
         "
       >
         <FaEdit className="text-[12px] opacity-70 group-hover:opacity-100" />
         ویرایش
       </button>
   
       <button
         onClick={() => handleDelete(address._id)}
         className="
           group
           flex items-center gap-1.5
           cursor-pointer
           rounded-md
           border border-red-200
           px-3 py-1.5
           text-xs
           text-red-500
           transition
           hover:bg-red-50
         "
       >
         <FaTrash className="text-[12px] opacity-70 group-hover:opacity-100" />
         حذف
       </button>
     </div>
   </motion.div>
   
     
       
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
       <motion.div
       className="fixed inset-0 z-50 flex items-center justify-center"
       initial={{ opacity: 0 }}
       animate={{ opacity: 1 }}
       exit={{ opacity: 0 }}
     >
       {/* Overlay */}
       <div
         className="absolute inset-0 bg-black/40 backdrop-blur-sm"
         onClick={closeModal}
       />
     
       {/* Modal */}
       <motion.div
         initial={{ scale: 0.95, y: 30 }}
         animate={{ scale: 1, y: 0 }}
         exit={{ scale: 0.95, y: 30 }}
         transition={{ type: "spring", stiffness: 300, damping: 25 }}
         className="
           relative z-10
           w-full max-w-2xl
           rounded-lg
           bg-white
           p-6
           shadow-xl
         "
       >
         <h2 className="mb-4 text-base font-semibold text-[hsl(var(--foreground))]">
           {editingAddress ? "ویرایش آدرس" : "افزودن آدرس جدید"}
         </h2>
     
         <form onSubmit={handleSubmit} className="space-y-4 text-sm">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-xs text-gray-500">
                 عنوان آدرس
                 <span className="text-gray-400 mr-1">(اختیاری)</span>
               </label>
               <div className="relative">
                 <FiHome className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input
                   type="text"
                   placeholder="مثلاً خانه"
                   value={formData.title}
                   onChange={(e) =>
                     setFormData({ ...formData, title: e.target.value })
                   }
                   className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                 />
               </div>
             </div>
           </div>

           <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
             نام و نام خانوادگی را به فارسی وارد کنید
           </p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-xs text-gray-500">نام</label>
               <div className="relative">
                 <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input
                   type="text"
                   name="firstName"
                   autoComplete="given-name"
                   placeholder="نام تحویل گیرنده"
                   value={formData.firstName}
                   onChange={(e) =>
                     setFormData({ ...formData, firstName: e.target.value })
                   }
                   required
                   className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                 />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-xs text-gray-500">نام خانوادگی</label>
               <div className="relative">
                 <FiUser className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input
                   type="text"
                   name="lastName"
                   autoComplete="family-name"
                   placeholder="نام خانوادگی تحویل گیرنده"
                   value={formData.lastName}
                   onChange={(e) =>
                     setFormData({ ...formData, lastName: e.target.value })
                   }
                   required
                   className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                 />
               </div>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-xs text-gray-500">شماره موبایل</label>
               <div className="relative">
                 <FiPhone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input
                   type="tel"
                   placeholder="09xxxxxxxxx"
                   value={formData.phone}
                   onChange={(e) =>
                     setFormData({ ...formData, phone: e.target.value })
                   }
                   className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                 />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-xs text-gray-500">شهر</label>
               <div className="relative">
                 <FiMapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input
                   type="text"
                   placeholder="نام شهر"
                   value={formData.city}
                   onChange={(e) =>
                     setFormData({ ...formData, city: e.target.value })
                   }
                   className="w-full border border-gray-300 rounded-[6px] py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
                 />
               </div>
             </div>
           </div>

           <div className="space-y-1">
             <label className="text-xs text-gray-500">کد پستی</label>
             <input
               type="text"
               placeholder="۱۰ رقم"
               value={formData.postalCode}
               onChange={(e) =>
                 setFormData({ ...formData, postalCode: e.target.value })
               }
               className="w-full border border-gray-300 rounded-[6px] py-2.5 px-3 text-sm focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
             />
           </div>

           <div className="space-y-1">
             <label className="text-xs text-gray-500">آدرس کامل</label>
             <textarea
               rows={3}
               placeholder="خیابان، کوچه، پلاک، واحد ..."
               value={formData.addressLine}
               onChange={(e) =>
                 setFormData({ ...formData, addressLine: e.target.value })
               }
               className="w-full border border-gray-300 rounded-[6px] py-2.5 px-3 text-sm resize-none focus:outline-none focus:border-[#aa4725] focus:ring-2 focus:ring-[#aa4725]/20 transition"
             />
           </div>
     
           {/* Default checkbox */}
           <label className="flex items-center gap-2 text-xs cursor-pointer">
             <input
               type="checkbox"
               className="accent-[hsl(var(--primary))]"
               checked={formData.isDefault}
               onChange={(e) =>
                 setFormData({ ...formData, isDefault: e.target.checked })
               }
             />
             آدرس پیش‌فرض
           </label>
     
           {/* Actions */}
           <div className="flex justify-end gap-3 pt-3">
             <button
               type="button"
               onClick={closeModal}
               className="
                 rounded-md
                 border border-[hsl(var(--border))]
                 px-4 py-2
                 text-xs
                 cursor-pointer
                 hover:bg-[hsl(var(--muted))]
               "
             >
               لغو
             </button>
     
             <button
               type="submit"
               className="
                 rounded-md
                 bg-[hsl(var(--primary))]
                 px-5 py-2
                 text-xs
                 text-white
                 cursor-pointer
                 transition
                 hover:opacity-90
               "
             >
               ذخیره
             </button>
           </div>
         </form>
       </motion.div>
     </motion.div>
     
        )}
      </AnimatePresence>
    </div>
  )
}

export default AddressesModule
