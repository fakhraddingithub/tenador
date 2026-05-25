"use client";

import { useEffect, useState } from "react";
import { FaMars, FaVenus, FaRunning, FaFlag } from "react-icons/fa";

export default function ShowcaseAthletes() {
  const [data, setData] = useState({ men: [], women: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const res = await fetch("/api/athletes/showcase");

        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAthletes();
  }, []);

  const AthleteCard = ({ athlete, index }) => {
    const sponsors = athlete.sponsors?.slice(0, 2) || [];

    return (
      <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-all duration-300 hover:border-[var(--color-primary)]/30 hover:bg-white/[0.05]">
        {/* rank */}
        <div className="w-6 shrink-0 text-center">
          <span className="text-sm font-bold italic text-white/20 transition-colors duration-300 group-hover:text-[var(--color-primary)]">
            0{index + 1}
          </span>
        </div>

        {/* avatar */}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10">
          <img
            src={athlete.photo || "/default-avatar.png"}
            alt={athlete.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>

        {/* sponsors */}
        {sponsors.length > 0 && (
          <div className="flex shrink-0 items-center -space-x-2 -space-x-reverse">
            {sponsors.map((sponsor, i) => (
              <div
                key={sponsor._id || i}
                className="h-7 w-7 overflow-hidden rounded-full border border-white/10 bg-white p-1 shadow-sm"
                title={sponsor.name}
              >
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ))}
          </div>
        )}

        {/* info */}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-bold text-white">
            {athlete.title}
          </h4>

          <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
            {athlete.sport && (
              <span className="flex items-center gap-1">
                <FaRunning className="text-[var(--color-primary)]" size={10} />
                {athlete.sport.name}
              </span>
            )}

            {athlete.nationality && (
              <>
                <span className="text-white/10">•</span>
                <span className="flex items-center gap-1">
                  <FaFlag size={9} />
                  {athlete.nationality}
                </span>
              </>
            )}
          </div>
        </div>

        {/* hover glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/0 via-[var(--color-primary)]/[0.03] to-[var(--color-primary)]/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>
    );
  };

  if (loading) {
    return (
      <section className="bg-[#1a1c22] py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 h-8 w-52 animate-pulse rounded-xl bg-white/10" />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2].map((col) => (
              <div key={col} className="space-y-3">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-[#1a1c22] py-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-white/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-col items-center justify-between gap-4 text-center lg:flex-row lg:text-right">
          <div>
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]">
              Featured Athletes
            </span>

            <h2 className="text-2xl font-bold text-white md:text-3xl">
              ستارگان منتخب ورزش
            </h2>
          </div>

          <p className="max-w-md text-sm leading-7 text-gray-400">
            برترین ورزشکارانی که با عملکرد، شخصیت و استایل خود در مرکز توجه قرار گرفته‌اند.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/5 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                <FaMars size={16} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">بخش مردان</h3>
                <span className="text-xs text-gray-500">Top Male Athletes</span>
              </div>
            </div>

            <div className="space-y-3">
              {data.men.length > 0 ? (
                data.men.map((athlete, index) => (
                  <AthleteCard key={athlete._id} athlete={athlete} index={index} />
                ))
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">
                  موردی یافت نشد
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400">
                <FaVenus size={16} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">بخش زنان</h3>
                <span className="text-xs text-gray-500">Top Female Athletes</span>
              </div>
            </div>

            <div className="space-y-3">
              {data.women.length > 0 ? (
                data.women.map((athlete, index) => (
                  <AthleteCard key={athlete._id} athlete={athlete} index={index} />
                ))
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">
                  موردی یافت نشد
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}