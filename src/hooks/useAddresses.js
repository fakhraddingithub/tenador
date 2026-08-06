import { useState, useEffect, useCallback } from 'react';

export const useAddresses = () => {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch addresses
  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/addresses');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'خطا در دریافت آدرس‌ها');
      }
      setAddresses(data.addresses || []);
    } catch (err) {
      setError(err.message || 'خطا در دریافت آدرس‌ها');
      console.error('Error fetching addresses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    let isActive = true;

    fetch('/api/addresses')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'خطا در دریافت آدرس‌ها');
        }
        if (isActive) setAddresses(data.addresses || []);
      })
      .catch((err) => {
        if (isActive) setError(err.message || 'خطا در دریافت آدرس‌ها');
        console.error('Error fetching addresses:', err);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);
  
  // Add new address
  const addAddress = useCallback(async (newAddress) => {
    try {
      let address;

      if (newAddress.saveAddress) {
        // ۱. مقدار خروجی fetch را در متغیر res ذخیره می‌کنیم
        const res = await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newAddress, user: 'current-user-id' })
        });
        
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'خطا در ثبت آدرس');
        }
    
        address = data.address;
      } else {
        // ۲. اگر کاربر نخواهد آدرس ذخیره شود، یک آبجکت موقت با شناسه منحصربه‌فرد می‌سازیم
        address = {
          ...newAddress,
          _id: `temp_${Date.now()}`
        };
      }

      // اضافه کردن آدرس جدید به لیست حالت (State)
      setAddresses((prev) => [...prev, address]);
      
      return address;
    } catch (err) {
      console.error('Error adding address:', err);
      throw err;
    }
  }, []);
  
  return {
    addresses,
    isLoading,
    error,
    addAddress,
    refetch: fetchAddresses
  };
};
