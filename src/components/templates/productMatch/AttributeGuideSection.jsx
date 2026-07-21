'use client';

import { MdDescription } from 'react-icons/md';

// راهنمای شاخص‌های فنی دسته — بدون هیچ درخواست شبکه؛ از دادهٔ دسته که قبلا واکشی شده استفاده می‌کند
export default function AttributeGuideSection({ category }) {
    return (
        <div className="mt-16">
            <h3 className="text-2xl font-bold mb-8 border-r-4 border-[var(--color-primary)] pr-3">
                راهنمای شاخص‌های {category?.title}
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category?.technicalStats?.map((stat) => (
                    <div key={stat.name} className="bg-white p-6 rounded-[var(--radius)] border border-neutral-100 shadow-sm hover:shadow-md transition">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold">
                                <MdDescription />
                            </div>
                            <h4 className="font-bold text-lg">{stat.label}</h4>
                        </div>
                        <p className="text-sm text-neutral-600 leading-relaxed text-justify">
                            {stat.description || 'توضیحاتی برای این شاخص ثبت نشده است.'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
