'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api/client';
import { Match, Event, Sport } from '@/lib/types';
import MatchCard from '@/components/match-card';
import EventCard from '@/components/event-card';
import { Trophy, Radio, Users, BarChart3, ArrowRight, Zap } from 'lucide-react';

const features = [
  {
    icon: <Radio className="h-6 w-6" />,
    title: 'Skor Langsung',
    description: 'Pembaruan skor real-time dengan integrasi WebSocket',
    color: 'from-red-500/20 to-red-500/5 text-red-400 border-red-500/20',
  },
  {
    icon: <Trophy className="h-6 w-6" />,
    title: 'Manajemen Turnamen',
    description: 'Buat liga, sistem gugur, dan fase grup',
    color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Manajemen Tim',
    description: 'Kelola daftar pemain, formasi, dan statistik',
    color: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Klasemen & Statistik',
    description: 'Perhitungan klasemen dan statistik otomatis',
    color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  },
];

export default function HomePage() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSports, setLoadingSports] = useState(true);

  useEffect(() => {
    async function fetchLiveMatches() {
      try {
        const response = await apiGet<any>('/matches?status=LIVE');
        setLiveMatches(Array.isArray(response) ? response : (response?.data || []));
      } catch {
        setLiveMatches([]);
      } finally {
        setLoadingLive(false);
      }
    }

    async function fetchUpcomingEvents() {
      try {
        const response = await apiGet<any>('/events?status=PUBLISHED&limit=4');
        setUpcomingEvents(Array.isArray(response) ? response : (response?.data || []));
      } catch {
        setUpcomingEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }

    async function fetchSports() {
      try {
        const response = await apiGet<any>('/sports');
        setSports(Array.isArray(response) ? response : (response?.data || []));
      } catch {
        setSports([]);
      } finally {
        setLoadingSports(false);
      }
    }

    fetchLiveMatches();
    fetchUpcomingEvents();
    fetchSports();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#0a0f1c] hero-mesh">
        <div className="pattern-dots absolute inset-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-8 animate-slide-up">
              <Zap className="h-4 w-4" />
              Platform Olahraga #1
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 animate-slide-up text-white">
              Skor Olahraga{' '}
              <span className="gradient-text">Langsung</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed animate-slide-up max-w-2xl mx-auto">
              Pantau pertandingan, kelola turnamen, dan ikuti skor langsung di semua cabang olahraga
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02]"
              >
                Jelajahi Acara
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-3.5 rounded-xl border border-white/[0.12] text-white font-bold text-lg hover:bg-white/[0.06] transition-all"
              >
                Mulai Sekarang
              </Link>
            </div>
          </div>
        </div>
        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0f1c] to-transparent" />
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass-card p-6 text-center group hover:scale-[1.03] transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-b ${feature.color} border mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="font-bold text-white mb-1.5">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Now Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Sedang Berlangsung</h2>
        </div>

        {loadingLive ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 h-40 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
              />
            ))}
          </div>
        ) : liveMatches.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
            {liveMatches.map((match) => (
              <div key={match.id} className="flex-shrink-0 w-72 snap-start">
                <MatchCard match={match} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 glass-card">
            <Radio className="mx-auto h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 font-semibold">Tidak ada pertandingan langsung saat ini</p>
            <p className="text-sm text-slate-500 mt-1">Cek kembali nanti untuk aksi langsung</p>
          </div>
        )}
      </section>

      {/* Upcoming Events Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Acara Mendatang</h2>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Lihat semua
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingEvents ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-56 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
                />
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 glass-card">
              <p className="text-slate-400 font-semibold">Tidak ada acara mendatang</p>
            </div>
          )}
        </div>
      </section>

      {/* Featured Sports Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-extrabold text-white tracking-tight mb-8">Cabang Olahraga</h2>

        {loadingSports ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-skeleton-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
              />
            ))}
          </div>
        ) : sports.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {sports.map((sport) => (
              <div
                key={sport.id}
                className="group glass-card flex flex-col items-center justify-center p-5 cursor-pointer hover:scale-[1.05] transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mb-2.5 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-all">
                  <span className="text-lg font-bold text-emerald-400">
                    {sport.icon || sport.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-slate-300 text-center group-hover:text-white transition-colors">
                  {sport.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 glass-card">
            <p className="text-slate-400 font-semibold">Tidak ada cabang olahraga tersedia</p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 hero-mesh" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-5 tracking-tight">Siap untuk memulai?</h2>
          <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
            Buat akun untuk mengelola turnamen, memantau tim, dan mencatat skor pertandingan secara real-time.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-lg hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02]"
          >
            Daftar Gratis
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
