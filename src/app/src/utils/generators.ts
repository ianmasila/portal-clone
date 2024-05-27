import { v4 as uuidv4 } from 'uuid';

type GeneratorType = 'increment' | 'random';

export class NumberGenerator {
  private last: number;
  private generatorType: GeneratorType;

  constructor(generatorType: GeneratorType = 'increment', start: number = 0) {
    this.last = start;
    this.generatorType = generatorType;
  }

  public next() {
    if (this.generatorType === 'increment') {
      this.last += 1;
      return { value: this.last, done: false };
    } else if (this.generatorType === 'random') {
      const random = Math.floor(Math.random() * 1000000);
      return { value: random, done: false };
    }
  }

  public setLastId(id: number) {
    if (this.generatorType === 'increment') {
      this.last = id;
    } else {
      console.warn('setLastId is only applicable for increment generator type.');
    }
  }
}

export class StringGenerator {
  public next() {
    return { value: uuidv4(), done: false };
  }
}
