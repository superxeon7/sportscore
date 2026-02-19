'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const hasAutoFocused = useRef(false);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      hasAutoFocused.current = false;
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    if (!hasAutoFocused.current) {
      hasAutoFocused.current = true;
      setTimeout(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>(
          'input, select, textarea',
        );
        firstInput?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal content */}
      <div
        ref={modalRef}
        className={`relative z-10 w-full ${sizeClasses[size]} mx-4 rounded-xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/40 max-h-[90vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal'}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-3.5 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
