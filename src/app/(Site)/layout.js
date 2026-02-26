import "@/app/globals.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Navbar from "@/components/features/navbar/Navbar";
import WhatsAppSupport from "@/components/features/WhatsAppSupport/WhatsAppSupport";
import Footer from "@/components/features/footer/Footer";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import { getProfile } from "@/hooks/useProfile";
import User from "base/models/User";

export const metadata = {
  title: "فروشگاه ورزشی تنادور",
  description: "فروشگاه تخصصی محصولات تنیس، پدل، اسکواش، بدمینتون و پینگ‌پنگ",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  let user = false;

  if (token) {
    user = verifyToken(token);
    const profile = await User.findById(user.userId).select("name -_id");
    user = {...user,userName:profile.name}
  }

  return (
    <html lang="fa-IR" dir="rtl">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
          rel="stylesheet"
          type="text/css"
        />
      </head>
      <body className="bg-[var(--color-background)] text-[var(--color-text)]">
        <Navbar user={user} />
        <WhatsAppSupport />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={true}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}
