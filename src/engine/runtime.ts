import type { GameCommand, MonotonicClock } from './contracts';

export interface QueuedCommand extends GameCommand {
  timestamp: number;
  sequence: number;
}

export class RuntimeClock implements MonotonicClock {
  now(): number {
    return performance.now();
  }
}

export class CommandQueue {
  private sequence = 0;
  private readonly commands: QueuedCommand[] = [];

  enqueue(command: GameCommand, timestamp: number): QueuedCommand {
    const queued: QueuedCommand = {
      ...command,
      timestamp,
      sequence: this.sequence++,
    };
    this.commands.push(queued);
    this.commands.sort(
      (left, right) => left.timestamp - right.timestamp || left.sequence - right.sequence,
    );
    return queued;
  }

  drainUntil(timestamp: number): QueuedCommand[] {
    const due: QueuedCommand[] = [];
    while (this.commands.length > 0 && this.commands[0]!.timestamp <= timestamp) {
      due.push(this.commands.shift()!);
    }
    return due;
  }

  clear(): void {
    this.commands.length = 0;
    this.sequence = 0;
  }
}

export class PauseTracker {
  private pausedAt: number | null = null;
  private totalPausedMs = 0;

  pause(at: number): void {
    if (this.pausedAt === null) this.pausedAt = at;
  }

  resume(at: number): number {
    if (this.pausedAt === null) return 0;
    const delta = Math.max(0, at - this.pausedAt);
    this.totalPausedMs += delta;
    this.pausedAt = null;
    return delta;
  }

  isPaused(): boolean {
    return this.pausedAt !== null;
  }

  get totalOffset(): number {
    return this.totalPausedMs;
  }
}
