import { FiCreditCard, FiDollarSign, FiCalendar, FiCheck } from 'react-icons/fi';

const paymentOptions = [
  {
    method: 'ONLINE',
    title: 'پرداخت آنلاین',
    description: 'پرداخت امن از طریق درگاه بانکی',
    icon: 'credit-card',
    disabled: true,
    disabledLabel: 'در حال حاضر غیرفعال'
  },
  {
    method: 'BANK_RECEIPT',
    title: 'پرداخت بانکی',
    description: 'واریز به حساب و ارسال فیش',
    icon: 'dollar'
  },
  {
    method: 'INSTALLMENT',
    title: 'پرداخت اقساطی',
    description: 'پرداخت در چند قسط با چک',
    icon: 'calendar'
  }
];

const getIcon = (iconName) => {
  switch (iconName) {
    case 'credit-card':
      return FiCreditCard;
    case 'dollar':
      return FiDollarSign;
    case 'calendar':
      return FiCalendar;
    default:
      return FiCreditCard;
  }
};

const PaymentMethods = ({ selectedMethod, onSelectMethod }) => {
  return (
    <section
      className="
        rounded-2xl border border-slate-200
        bg-white p-5 md:p-6
        shadow-lg shadow-slate-200/40
        space-y-5
      "
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-50">
          <FiCreditCard className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <h2 className="text-base md:text-lg font-bold text-slate-800">
          روش پرداخت
        </h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {paymentOptions.map((option, index) => {
          const Icon = getIcon(option.icon);
          const isSelected = selectedMethod === option.method;
          const isDisabled = option.disabled === true;

          return (
            <button
              key={option.method}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelectMethod(option.method)}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`
                text-right w-full
                rounded-xl border
                p-4
                transition-all duration-200
                animate-slide-up
                ${isDisabled
                  ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                  : isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-md active:scale-[0.98]'
                    : 'border-slate-200 bg-white hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 active:scale-[0.98]'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`
                    w-11 h-11 rounded-xl
                    flex items-center justify-center
                    flex-shrink-0
                    transition-colors
                    ${isSelected && !isDisabled
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-slate-100 text-slate-500'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3
                      className={`
                        text-sm font-bold
                        ${isDisabled
                          ? 'text-slate-400'
                          : isSelected
                            ? 'text-[var(--color-primary)]'
                            : 'text-slate-800'
                        }
                      `}
                    >
                      {option.title}
                    </h3>

                    {isSelected && !isDisabled && (
                      <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                        <FiCheck className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {isDisabled ? (
                    <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                      {option.disabledLabel || 'در حال حاضر غیرفعال'}
                    </span>
                  ) : (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PaymentMethods;
