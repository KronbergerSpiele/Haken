import type { InputService } from './contracts';

export class DomInputService implements InputService {
  private root: HTMLElement | null = null;
  private readonly captures = new Set<number>();

  attach(root: HTMLElement): void {
    this.root = root;
  }

  detach(): void {
    this.releaseAllCaptures();
    this.root = null;
  }

  releaseAllCaptures(): void {
    if (!this.root) {
      this.captures.clear();
      return;
    }
    for (const pointerId of this.captures) {
      if (this.root.hasPointerCapture(pointerId)) {
        this.root.releasePointerCapture(pointerId);
      }
    }
    this.captures.clear();
  }

  trackCapture(pointerId: number): void {
    this.captures.add(pointerId);
  }

  releaseCapture(pointerId: number): void {
    if (this.root?.hasPointerCapture(pointerId)) {
      this.root.releasePointerCapture(pointerId);
    }
    this.captures.delete(pointerId);
  }
}

export function createInputService(): DomInputService {
  return new DomInputService();
}
