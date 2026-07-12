import type { FeedbackService } from '../engine/contracts';

export class DomFeedbackService implements FeedbackService {
  private audioContext: AudioContext | null = null;
  muted = false;

  vibrate(pattern: number | number[]): void {
    navigator.vibrate?.(pattern);
  }

  playTone(kind: 'hit' | 'block' | 'finished' | 'neutral'): void {
    if (this.muted || kind === 'neutral') return;
    this.audioContext ??= new AudioContext();
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = kind === 'hit' ? 'sawtooth' : 'square';
    oscillator.frequency.value = kind === 'finished' ? 220 : kind === 'hit' ? 105 : 280;
    gain.gain.setValueAtTime(0.06, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.12);
  }
}

export function createFeedbackService(): DomFeedbackService {
  return new DomFeedbackService();
}

export function feedbackFromEvents(
  feedback: FeedbackService,
  events: Array<{ type: string }>,
): void {
  if (events.some((event) => event.type === 'hit' || event.type === 'blocked')) {
    feedback.vibrate(events.some((event) => event.type === 'hit') ? 45 : 20);
  }
  const important = events.find((event) => ['hit', 'blocked', 'finished'].includes(event.type));
  if (!important) return;
  if (important.type === 'hit') feedback.playTone('hit');
  else if (important.type === 'blocked') feedback.playTone('block');
  else if (important.type === 'finished') feedback.playTone('finished');
}
