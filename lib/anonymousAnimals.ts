export interface AnonymousAnimal {
  name: string;
  emoji: string;
}

export const ANONYMOUS_ANIMALS: readonly AnonymousAnimal[] = [
  { name: 'Alpaca', emoji: '🦙' },
  { name: 'Axolotl', emoji: '🦎' },
  { name: 'Badger', emoji: '🦡' },
  { name: 'Bat', emoji: '🦇' },
  { name: 'Beaver', emoji: '🦫' },
  { name: 'Bison', emoji: '🦬' },
  { name: 'Camel', emoji: '🐪' },
  { name: 'Dodo', emoji: '🦤' },
  { name: 'Dolphin', emoji: '🐬' },
  { name: 'Eagle', emoji: '🦅' },
  { name: 'Flamingo', emoji: '🦩' },
  { name: 'Fox', emoji: '🦊' },
  { name: 'Giraffe', emoji: '🦒' },
  { name: 'Hedgehog', emoji: '🦔' },
  { name: 'Hippo', emoji: '🦛' },
  { name: 'Kangaroo', emoji: '🦘' },
  { name: 'Koala', emoji: '🐨' },
  { name: 'Octopus', emoji: '🐙' },
  { name: 'Orangutan', emoji: '🦧' },
  { name: 'Otter', emoji: '🦦' },
  { name: 'Owl', emoji: '🦉' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Parrot', emoji: '🦜' },
  { name: 'Peacock', emoji: '🦚' },
  { name: 'Penguin', emoji: '🐧' },
  { name: 'Raccoon', emoji: '🦝' },
  { name: 'Seal', emoji: '🦭' },
  { name: 'Sloth', emoji: '🦥' },
  { name: 'Swan', emoji: '🦢' },
  { name: 'Whale', emoji: '🐳' },
];

export function pickRandomAnimals(n: number): AnonymousAnimal[] {
  const count = Math.max(0, Math.min(n, ANONYMOUS_ANIMALS.length));
  if (count === 0) return [];
  const pool = [...ANONYMOUS_ANIMALS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
