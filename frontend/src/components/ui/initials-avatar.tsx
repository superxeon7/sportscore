'use client';

import Image from 'next/image';

interface InitialsAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  className?: string;
}

const SIZE_MAP = {
  xs: { px: 24, text: 'text-[9px]', cls: 'w-6 h-6' },
  sm: { px: 32, text: 'text-xs', cls: 'w-8 h-8' },
  md: { px: 40, text: 'text-sm', cls: 'w-10 h-10' },
  lg: { px: 56, text: 'text-base', cls: 'w-14 h-14' },
  xl: { px: 80, text: 'text-xl', cls: 'w-20 h-20' },
};

// Deterministic color from name hash
function getColorFromName(name: string): string {
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-green-600',
    'bg-red-600',
    'bg-orange-500',
    'bg-teal-600',
    'bg-pink-600',
    'bg-indigo-600',
    'bg-yellow-600',
    'bg-cyan-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function InitialsAvatar({
  name,
  imageUrl,
  size = 'md',
  shape = 'circle',
  className = '',
}: InitialsAvatarProps) {
  const { px, text, cls } = SIZE_MAP[size];
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-md';

  if (imageUrl) {
    return (
      <div className={`${cls} ${rounded} overflow-hidden flex-shrink-0 ${className}`}>
        <Image
          src={imageUrl}
          alt={name}
          width={px}
          height={px}
          className="object-cover w-full h-full"
          unoptimized
        />
      </div>
    );
  }

  const bg = getColorFromName(name || 'X');
  const initials = getInitials(name || '?');

  return (
    <div
      className={`${cls} ${rounded} ${bg} flex items-center justify-center flex-shrink-0 ${text} font-bold text-white select-none ${className}`}
    >
      {initials}
    </div>
  );
}
