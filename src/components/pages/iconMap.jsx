/**
 * نگاشت نام آیکون (که مدیر از فهرست انتخاب می‌کند) به آیکونِ lucide-react.
 * نام‌ها در ادیتورِ پنل (blockSchema) و در محتوای پیش‌فرض استفاده می‌شوند.
 */
import {
  Shield,
  Heart,
  Sparkles,
  Check,
  X,
  User,
  MessageCircle,
  Truck,
  Package,
  Globe,
  Lock,
  CreditCard,
  Calendar,
  Wallet,
  Star,
  Award,
  Clock,
  MapPin,
  Phone,
  Mail,
  Zap,
  Gift,
  ThumbsUp,
  RefreshCw,
} from "lucide-react";

export const ICONS = {
  shield: Shield,
  heart: Heart,
  sparkles: Sparkles,
  check: Check,
  x: X,
  user: User,
  message: MessageCircle,
  truck: Truck,
  package: Package,
  globe: Globe,
  lock: Lock,
  card: CreditCard,
  calendar: Calendar,
  wallet: Wallet,
  star: Star,
  award: Award,
  clock: Clock,
  pin: MapPin,
  phone: Phone,
  mail: Mail,
  zap: Zap,
  gift: Gift,
  thumbsup: ThumbsUp,
  refresh: RefreshCw,
};

// فهرستِ نام‌ها برای dropdown پنل مدیریت
export const ICON_NAMES = Object.keys(ICONS);

export function getIcon(name) {
  return ICONS[name] || Sparkles;
}
