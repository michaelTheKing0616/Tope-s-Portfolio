/** Shuffled index deck for endless sessions without repeats until the pool is exhausted. */

export function shuffleIndices(size: number, startAt = 0): number[] {
  const order = Array.from({ length: size }, (_, i) => i + startAt);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export class IndexDeck {
  private readonly order: number[];
  private position = 0;

  constructor(size: number, startAt = 0) {
    this.order = shuffleIndices(size, startAt);
  }

  next(): number | undefined {
    if (this.position >= this.order.length) return undefined;
    return this.order[this.position++]!;
  }

  get round(): number {
    return this.position;
  }

  get total(): number {
    return this.order.length;
  }

  get remaining(): number {
    return this.order.length - this.position;
  }

  get hasMore(): boolean {
    return this.position < this.order.length;
  }
}

export class IdDeck<T extends { id: string }> {
  private readonly items: T[];
  private readonly order: number[];
  private position = 0;

  constructor(items: T[]) {
    this.items = items;
    this.order = shuffleIndices(items.length);
  }

  next(): T | undefined {
    if (this.position >= this.order.length) return undefined;
    const idx = this.order[this.position++]!;
    return this.items[idx];
  }

  get round(): number {
    return this.position;
  }

  get total(): number {
    return this.items.length;
  }

  get hasMore(): boolean {
    return this.position < this.items.length;
  }
}
