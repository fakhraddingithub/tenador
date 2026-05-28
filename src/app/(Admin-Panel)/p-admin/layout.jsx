import '@/app/globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from "@/components/admin/Layout"

export const metadata = {
  title: 'فروشگاه ورزشی تنادور | پنل مدیریت',
  description: 'پنل مدیریت یکپارچه فروشگاه ورزشی تنادور',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa-IR" dir="rtl" className="scroll-smooth">
      <body 
        className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased selection:bg-[var(--color-primary)] selection:text-white"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <main className="min-h-screen overflow-x-hidden">
          <AdminLayout>{children}</AdminLayout>
        </main>
        
        <ToastContainer
           position="top-left"
           autoClose={3000}
           hideProgressBar={false}
           newestOnTop={true}
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