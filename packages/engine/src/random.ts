export interface SeededRandom {
  readonly state: number;
  nextUint32(): number;
  nextInt(max: number): number;
}

function randomStep(value: number): number {
  let x = value | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0 || 0x9e3779b9;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0 || 1;
  return {
    get state() {
      return state;
    },
    nextUint32() {
      state = randomStep(state);
      return state;
    },
    nextInt(max: number) {
      if (max <= 0) return 0;
      state = randomStep(state);
      return state % max;
    },
  };
}

export function shuffleWithRng<T>(items: readonly T[], rng: SeededRandom): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = rng.nextInt(index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}
