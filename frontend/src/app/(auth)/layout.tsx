import React from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Trophy className="h-8 w-8 text-blue-600" />
        <Link href="/" className="text-3xl font-bold text-gray-900">
          Sport<span className="text-blue-600">Score</span>
        </Link>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-8 shadow-lg">
        {children}
      </div>
    </div>
  );
}
