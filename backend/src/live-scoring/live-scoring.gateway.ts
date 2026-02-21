import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@prisma/client';
import { LiveScoringService } from './live-scoring.service';
import { CreateMatchEventDto } from './dto/create-match-event.dto';
import { OwnershipService } from '../common/ownership.service';

/**
 * Socket.IO WebSocket gateway for real-time match scoring.
 *
 * Namespace: /live
 *
 * Authentication:
 *   Clients must provide a JWT in `client.handshake.auth.token`.
 *   On connection the token is verified; userId and role are stored
 *   on `client.data` for subsequent message handlers.
 *
 * Rooms:
 *   Each match has a room named `match:{matchId}`.
 *   Clients join via the `match:join` message and leave via `match:leave`.
 *
 * Organizer-only messages:
 *   match:start, match:event, match:undo-event, match:period-start,
 *   match:period-end, match:end
 *
 * Ownership validation:
 *   All organizer-only handlers verify that the connected user
 *   actually owns the match (via Match → Tournament → Event → organizerId).
 */
@WebSocketGateway({
  namespace: '/live',
  cors: { origin: '*' },
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class LiveScoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveScoringGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly liveScoringService: LiveScoringService,
    private readonly ownershipService: OwnershipService,
  ) { }

  // -------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.headers?.authorization as string)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        this.logger.warn(
          `Client ${client.id} connected without a token – disconnecting`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.data.email = payload.email;

      this.logger.log(
        `Client ${client.id} authenticated as user ${payload.sub} (${payload.role})`,
      );
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} failed authentication: ${(error as Error).message}`,
      );
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  // -------------------------------------------------------------------
  // Room management
  // -------------------------------------------------------------------

  @SubscribeMessage('match:join')
  async handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;

    if (!matchId) {
      throw new WsException('matchId is required');
    }

    const room = `match:${matchId}`;
    await client.join(room);

    this.logger.log(
      `Client ${client.id} joined room ${room}`,
    );

    // Send the current match state to the joining client.
    try {
      const state = await this.liveScoringService.getMatchState(matchId);
      client.emit('match:state', state);
    } catch (error) {
      client.emit('error', {
        message: `Failed to load match state: ${(error as Error).message}`,
      });
    }
  }

  @SubscribeMessage('match:leave')
  async handleLeaveMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;

    if (!matchId) {
      throw new WsException('matchId is required');
    }

    const room = `match:${matchId}`;
    await client.leave(room);

    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  // -------------------------------------------------------------------
  // Match lifecycle (organizer only — with ownership check)
  // -------------------------------------------------------------------

  @SubscribeMessage('match:start')
  async handleStartMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const state = await this.liveScoringService.startMatch(matchId);
      this.server.to(`match:${matchId}`).emit('match:state', state);
    } catch (error) {
      throw new WsException(
        `Failed to start match: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:end')
  async handleEndMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const state = await this.liveScoringService.endMatch(matchId);
      this.server.to(`match:${matchId}`).emit('match:state', state);
    } catch (error) {
      throw new WsException(
        `Failed to end match: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Period management (organizer only — with ownership check)
  // -------------------------------------------------------------------

  @SubscribeMessage('match:period-start')
  async handlePeriodStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; period: number },
  ): Promise<void> {
    const { matchId, period } = payload;
    if (!matchId || !period) throw new WsException('matchId and period are required');

    await this.assertMatchOwner(client, matchId);

    try {
      const state = await this.liveScoringService.updatePeriod(
        matchId,
        period,
        'start',
      );
      this.server.to(`match:${matchId}`).emit('match:state', state);
    } catch (error) {
      throw new WsException(
        `Failed to start period: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:period-end')
  async handlePeriodEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; period: number },
  ): Promise<void> {
    const { matchId, period } = payload;
    if (!matchId || !period) throw new WsException('matchId and period are required');

    await this.assertMatchOwner(client, matchId);

    try {
      const state = await this.liveScoringService.updatePeriod(
        matchId,
        period,
        'end',
      );
      this.server.to(`match:${matchId}`).emit('match:state', state);
    } catch (error) {
      throw new WsException(
        `Failed to end period: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Match events (organizer only — with ownership check)
  // -------------------------------------------------------------------

  @SubscribeMessage('match:event')
  async handleMatchEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string } & CreateMatchEventDto,
  ): Promise<void> {
    const { matchId, ...eventDto } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const { state, result, playerInfo } = await this.liveScoringService.processMatchEvent(
        matchId,
        eventDto as CreateMatchEventDto,
      );

      const room = `match:${matchId}`;

      // Broadcast the new event to all clients in the room, including player info.
      this.server.to(room).emit('match:new-event', {
        ...result.matchEvent,
        player: playerInfo ?? null,
      });

      // If the score changed, broadcast the updated score.
      if (result.scoreChanged) {
        this.server.to(room).emit('match:score-update', {
          score: result.newScore,
          matchId,
        });
      }
    } catch (error) {
      throw new WsException(
        `Failed to process event: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:undo-event')
  async handleUndoEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const { state, removedEvent } =
        await this.liveScoringService.undoLastEvent(matchId);

      const room = `match:${matchId}`;

      this.server.to(room).emit('match:event-undone', {
        removedEvent,
        score: state.score,
        matchId,
      });

      this.server.to(room).emit('match:score-update', {
        score: state.score,
        matchId,
      });
    } catch (error) {
      throw new WsException(
        `Failed to undo event: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Timer controls (organizer only — with ownership check)
  // -------------------------------------------------------------------

  @SubscribeMessage('match:timer-start')
  async handleTimerStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const timerState = await this.liveScoringService.startTimer(matchId);
      this.server.to(`match:${matchId}`).emit('match:timer', timerState);
    } catch (error) {
      throw new WsException(
        `Failed to start timer: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:timer-pause')
  async handleTimerPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string },
  ): Promise<void> {
    const { matchId } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const timerState = await this.liveScoringService.pauseTimer(matchId);
      this.server.to(`match:${matchId}`).emit('match:timer', timerState);
    } catch (error) {
      throw new WsException(
        `Failed to pause timer: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:timer-set-added-time')
  async handleTimerSetAddedTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; seconds: number },
  ): Promise<void> {
    const { matchId, seconds } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const timerState = await this.liveScoringService.setAddedTime(
        matchId,
        seconds ?? 0,
      );
      this.server.to(`match:${matchId}`).emit('match:timer', timerState);
    } catch (error) {
      throw new WsException(
        `Failed to set added time: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:timer-set-direction')
  async handleTimerSetDirection(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; direction: 'up' | 'down' },
  ): Promise<void> {
    const { matchId, direction } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const timerState = await this.liveScoringService.setTimerDirection(
        matchId,
        direction,
      );
      this.server.to(`match:${matchId}`).emit('match:timer', timerState);
    } catch (error) {
      throw new WsException(
        `Failed to set timer direction: ${(error as Error).message}`,
      );
    }
  }

  @SubscribeMessage('match:timer-adjust')
  async handleTimerAdjust(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; elapsedSeconds: number },
  ): Promise<void> {
    const { matchId, elapsedSeconds } = payload;
    if (!matchId) throw new WsException('matchId is required');

    await this.assertMatchOwner(client, matchId);

    try {
      const timerState = await this.liveScoringService.adjustTimer(
        matchId,
        elapsedSeconds ?? 0,
      );
      this.server.to(`match:${matchId}`).emit('match:timer', timerState);
    } catch (error) {
      throw new WsException(
        `Failed to adjust timer: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Penalty shootout (organizer only — with ownership check)
  // -------------------------------------------------------------------

  @SubscribeMessage('match:set-penalty-score')
  async handleSetPenaltyScore(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { matchId: string; homePenaltyScore: number; awayPenaltyScore: number },
  ): Promise<void> {
    const { matchId, homePenaltyScore, awayPenaltyScore } = payload;
    if (!matchId) throw new WsException('matchId is required');
    if (homePenaltyScore == null || awayPenaltyScore == null) {
      throw new WsException('homePenaltyScore and awayPenaltyScore are required');
    }

    await this.assertMatchOwner(client, matchId);

    try {
      const result = await this.liveScoringService.setPenaltyScore(
        matchId,
        homePenaltyScore,
        awayPenaltyScore,
      );
      this.server.to(`match:${matchId}`).emit('match:penalty-score', {
        matchId,
        ...result,
      });
    } catch (error) {
      throw new WsException(
        `Failed to set penalty score: ${(error as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  /**
   * Assert that the connected client owns the match
   * (via Match → Tournament → Event → organizerId).
   *
   * ADMINs bypass the ownership check.
   *
   * @throws WsException if the user is not authenticated, is not an
   *         ORGANIZER/ADMIN, or does not own the match.
   */
  private async assertMatchOwner(
    client: Socket,
    matchId: string,
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    const role = client.data?.role as UserRole | undefined;

    if (!userId || !role) {
      throw new WsException('Authentication required');
    }

    if (role !== UserRole.ORGANIZER && role !== UserRole.ADMIN) {
      throw new WsException(
        'Forbidden: only organizers and admins can perform this action',
      );
    }

    try {
      await this.ownershipService.assertMatchOwner(matchId, userId, role);
    } catch {
      throw new WsException(
        'Forbidden: you do not own this match',
      );
    }
  }
}
