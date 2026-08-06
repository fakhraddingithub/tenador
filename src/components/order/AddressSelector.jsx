import { FiMapPin, FiChevronLeft, FiEdit2 } from 'react-icons/fi';

const AddressSelector = ({ selectedAddress, onOpenModal }) => {
  return (
    <div className="bg-white rounded-[8px] border border-gray-200 p-5 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#0d0d0d]">
          <FiMapPin className="w-5 h-5 text-[#aa4725]" />
          آدرس تحویل
        </h2>

        {selectedAddress && (
          <button
            onClick={onOpenModal}
            className="
              text-sm text-[#aa4725]
              hover:underline
              flex items-center gap-1
            "
          >
            <FiEdit2 className="w-4 h-4" />
            تغییر
          </button>
        )}
      </div>

      {selectedAddress ? (
        <div
          className="
            relative rounded-[6px] border border-[#aa4725]/30
            bg-[#ffbf00]/10
            p-4
          "
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ffbf00]/30 text-[#aa4725] font-medium">
              {selectedAddress.title}
            </span>

            <span className="text-sm font-medium text-[#0d0d0d]">
              {selectedAddress.fullName}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2 leading-relaxed">
            {[selectedAddress.city, selectedAddress.addressLine].filter(Boolean).join('، ')}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span>تلفن: {selectedAddress.phone}</span>
            {selectedAddress.postalCode && (
              <span>کد پستی: {selectedAddress.postalCode}</span>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={onOpenModal}
          className="
            w-full py-4
            border-2 border-dashed border-gray-300
            rounded-[6px]
            text-sm text-gray-600
            hover:border-[#aa4725]
            hover:text-[#aa4725]
            transition
            flex items-center justify-center gap-2
          "
        >
          <FiMapPin className="w-5 h-5" />
          انتخاب آدرس تحویل
          <FiChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AddressSelector;
