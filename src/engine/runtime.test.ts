import { describe, expect, it } from 'vitest';
import { CommandQueue, PauseTracker } from './runtime';

describe('runtime', () => {
  it('orders commands by timestamp and sequence', () => {
    const queue = new CommandQueue();
    queue.enqueue({ type: 'a' }, 20);
    queue.enqueue({ type: 'b' }, 10);
    queue.enqueue({ type: 'c' }, 10);

    expect(queue.drainUntil(10).map((command) => command.type)).toEqual(['b', 'c']);
    expect(queue.drainUntil(20).map((command) => command.type)).toEqual(['a']);
  });

  it('tracks paused duration for resume offsets', () => {
    const tracker = new PauseTracker();
    tracker.pause(100);
    expect(tracker.isPaused()).toBe(true);
    expect(tracker.resume(450)).toBe(350);
    expect(tracker.totalOffset).toBe(350);
    expect(tracker.isPaused()).toBe(false);
  });
});
