import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [posthog, consent, reliability, transfer] = await Promise.all([
  read('../src/lib/analytics/posthog.ts'),
  read('../src/lib/analytics/consent.ts'),
  read('../src/lib/analytics/reliability.ts'),
  read('../src/hooks/useWebRTC.ts'),
]);

const expectedSchemas = {
  transfer_attempted: ['schema_version', 'direction', 'size_bucket'],
  transfer_completed: ['schema_version', 'direction', 'size_bucket', 'duration_bucket'],
  transfer_failed: ['schema_version', 'direction', 'size_bucket', 'duration_bucket', 'failure_category'],
};

for (const [event, properties] of Object.entries(expectedSchemas)) {
  assert.match(posthog, new RegExp(`\\b${event}: new Set`));
  assert.match(reliability, new RegExp(`analytics\\.track\\('${event}'`));
  for (const property of properties) assert.match(posthog, new RegExp(`\\b${property}\\b`));
}

assert.match(posthog, /autocapture: false/);
assert.match(posthog, /disable_session_recording: true/);
assert.match(posthog, /person_profiles: 'never'/);
assert.match(posthog, /persistence: 'memory'/);
assert.match(posthog, /this\.consentGranted = hasAnalyticsConsent\(\)/);
assert.match(posthog, /!this\.consentGranted/);
assert.match(posthog, /identify\([^)]*\): void \{\}/);
assert.match(consent, /=== 'granted'/);
assert.match(transfer, /trackTransferAttempt\(file\.size\)/);
assert.match(reliability, /const SCHEMA_VERSION = 1/);
assert.match(transfer, /trackTransferCompleted\(incoming\.meta\.size, Date\.now\(\) - incoming\.startTime\)/);
assert.match(transfer, /'cancelled_by_recipient'/);
assert.match(transfer, /'connection_unavailable'/);

const schemaBlock = posthog.slice(
  posthog.indexOf('const ALLOWED_PROPERTIES'),
  posthog.indexOf('export class PostHogAdapter'),
);
const forbiddenSchemaTerms = [
  'file_name',
  'room_id',
  'transfer_id',
  'recipient',
  'device_id',
  'email',
  'name',
  'ip',
  'secret',
  'content',
  'session',
];
for (const term of forbiddenSchemaTerms) {
  assert.equal(schemaBlock.includes(`'${term}'`), false, `forbidden property ${term} found in allow-list`);
}

console.log('COR-10 reliability analytics acceptance checks passed');
