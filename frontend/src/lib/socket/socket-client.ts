import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

/**
 * Singleton Socket.IO client for the /live namespace.
 *
 * The socket is created lazily on first connect() call and reused
 * throughout the application lifetime. Auth is provided via the
 * handshake `auth.token` field.
 */
class SocketClient {
  private socket: Socket | null = null;
  private currentToken: string | null = null;

  /**
   * Connect to the /live namespace with JWT authentication.
   * If already connected with the same token, this is a no-op.
   * If the token changed, disconnects and reconnects.
   */
  connect(token: string): Socket {
    // SSR guard
    if (typeof window === 'undefined') {
      throw new Error('SocketClient.connect() must only be called client-side');
    }

    // Already connected with the same token
    if (this.socket?.connected && this.currentToken === token) {
      return this.socket;
    }

    // Token changed or not connected yet — tear down old socket if any
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentToken = token;

    this.socket = io(`${WS_URL}/live`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      autoConnect: true,
    });

    return this.socket;
  }

  /**
   * Disconnect and destroy the socket instance.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentToken = null;
    }
  }

  /**
   * Return the current socket instance (may be null if not connected).
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

/** Singleton instance exported for use across the app. */
export const socketClient = new SocketClient();
