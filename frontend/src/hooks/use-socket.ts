'use client';

import { useContext } from 'react';
import { SocketContext } from '@/components/socket-provider';

/**
 * Returns the socket instance and connection status from the SocketProvider context.
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a <SocketProvider>');
  }
  return context;
}
