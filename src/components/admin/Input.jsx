'use client';

import AdminInput from './AdminInput';

export default function Input({
  label,
  name,
  type = 'text',
  formatNumber = false,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  hint,
  icon: Icon,
  className = '',
  ...props
}) {
  const InputComponent = formatNumber ? AdminInput : 'input';

  return (
    <div className="mb-5">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-bold text-gray-700 mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--color-primary)] mr-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        <InputComponent
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`
            w-full px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all duration-200 outline-none
            bg-gray-50 text-gray-900 placeholder-gray-400
            focus:bg-white focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10
            ${error ? 'border-red-400 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
            ${Icon ? 'pr-10' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-400 font-medium">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500 font-bold flex items-center gap-1">
          <span>!</span> {error}
        </p>
      )}
    </div>
  );
}
