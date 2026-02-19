'use client';

import React, { createContext, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { socketClient } from '@/lib/socket/socket-client';
import { useAuthStore } from '@/lib/stores/auth.store';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

/**
 * Wraps the app and manages the Socket.IO connection lifecycle.
 *
 * - Connects automatically when the user has an accessToken.
 * - Disconnects when the user logs out (accessToken becomes null).
 * - Tracks connection state reactively.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    // No token — make sure we're disconnected
    if (!accessToken) {
      if (prevTokenRef.current) {
        socketClient.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      prevTokenRef.current = null;
      return;
    }

    // Token hasn't changed — nothing to do
    if (accessToken === prevTokenRef.current) return;

    prevTokenRef.current = accessToken;

    const sock = socketClient.connect(accessToken);
    setSocket(sock);

    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);

    // If the socket is already connected by the time we attach listeners
    if (sock.connected) {
      setIsConnected(true);
    }

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
    };
  }, [accessToken]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      socketClient.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
