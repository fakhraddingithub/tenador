/**
 * models/registerModels.js
 *
 * ثبت مرکزی همه‌ی اسکیماهای Mongoose.
 *
 * هر فایل مدل، اسکیمای خود را فقط هنگام «ارزیابی ماژول» ثبت می‌کند
 * (mongoose.models.X || mongoose.model(...)). اگر فایلی یک مدل را صرفاً برای
 * populate ایمپورت کند ولی به آن ارجاع مستقیم ندهد، باندلر می‌تواند آن ایمپورت
 * را حذف (tree-shake) کند و در نتیجه اسکیما ثبت نشود؛ این باعث خطای متناوب
 * «MissingSchemaError» در populate می‌شود.
 *
 * این ماژول فقط شامل side-effect import هاست. باندلرها (webpack/Turbopack)
 * این نوع ایمپورت‌ها را هرگز tree-shake نمی‌کنند، بنابراین با ایمپورت این فایل
 * در connectToDB، همه‌ی مدل‌ها قبل از هر کوئری ثبت شده‌اند و این خطا حذف می‌شود.
 *
 * هنگام افزودن مدل جدید، یک خط import برای آن به این فایل اضافه کنید.
 */

import "base/models/Address";
import "base/models/Admin";
import "base/models/AdminRole";
import "base/models/Athlete";
import "base/models/Ban";
import "base/models/Banner";
import "base/models/Brand";
import "base/models/Category";
import "base/models/CoachCredit";
import "base/models/Comment";
import "base/models/ContactMessage";
import "base/models/Coupon";
import "base/models/Department";
import "base/models/PageContent";
import "base/models/DiscountRule";
import "base/models/ExchangeRate";
import "base/models/FlashSale";
import "base/models/HealthCard";
import "base/models/Installment";
import "base/models/LimitedEdition";
import "base/models/Newsletter";
import "base/models/Notification";
import "base/models/Order";
import "base/models/OrderFlow";
import "base/models/Otp";
import "base/models/Payment";
import "base/models/PriceCache";
import "base/models/Product";
import "base/models/QuantityDiscount";
import "base/models/Serie";
import "base/models/SiteSetting";
import "base/models/Slide";
import "base/models/SlugRegistery";
import "base/models/Sport";
import "base/models/Ticket";
import "base/models/UsedProduct";
import "base/models/User";
import "base/models/UserNotification";
import "base/models/UserNotificationState";
import "base/models/Variant";
import "base/models/Event";
import "base/models/InstagramConversation";
import "base/models/InstagramMessage";
import "base/models/InstagramWebhookLog";
