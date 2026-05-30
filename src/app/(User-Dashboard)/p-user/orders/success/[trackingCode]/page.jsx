// app/payment/[trackingCode]/page.js
import React from 'react';
import PaymentSuccessPage from '@/components/payments/PaymentSuccessPage';

const Page = async ({ params }) => {
    const { trackingCode } = await params;

    return (
        <div >
            <PaymentSuccessPage trackingCode={trackingCode} />
        </div>
    );
};

export default Page;
