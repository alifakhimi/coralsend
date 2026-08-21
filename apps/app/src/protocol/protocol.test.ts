import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateClientWireMessage } from './index';

interface ProtocolFixture {
  name: string;
  valid: boolean;
  joined: boolean;
  currentRoom?: string;
  members?: string[];
  message: unknown;
}

const fixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../testdata/protocol/v1.json'), 'utf8'),
) as ProtocolFixture[];

describe('shared wire protocol v1 fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const validate = () => validateClientWireMessage(fixture.message, {
        joined: fixture.joined,
        currentRoom: fixture.currentRoom,
        members: new Set(fixture.members ?? []),
      });
      if (fixture.valid) expect(validate).not.toThrow();
      else expect(validate).toThrow();
    });
  }
});
