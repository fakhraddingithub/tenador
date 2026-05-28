'use client';

export default function Select({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'انتخاب کنید',
  required = false,
  error,
  hint,
  className = '',
  ...props
}) {
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
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`
          w-full px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all duration-200 outline-none
          bg-gray-50 text-gray-900 cursor-pointer appearance-none
          focus:bg-white focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10
          ${error ? 'border-red-400 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
          ${className}
        `}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option
            key={typeof option === 'object' ? option.value : option}
            value={typeof option === 'object' ? option.value : option}
          >
            {typeof option === 'object' ? option.label : option}
          </option>
        ))}
      </select>
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