#!/usr/bin/env node
/**
 * Migration script to convert old .nock-fixtures.json to new organized structure
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import type {Definition} from 'nock';

const OLD_FIXTURES_PATH = './.nock-fixtures.json';
const FIXTURES_DIR = './fixtures';

interface FixtureMetadata {
  path: string;
  recordedAt: string;
  requestCount: number;
  model?: string;
  checksum: string;
}

interface MetadataFile {
  version: string;
  lastUpdated: string;
  provider: string;
  fixtures: Record<string, FixtureMetadata>;
}

// Mapping of test names based on request patterns
const TEST_MAPPING = [
  // Responses API tests
  {pattern: /Responses mode works/, name: 'text-generation-responses', mode: 'responses'},
  {pattern: /Mode responses streaming works/, name: 'streaming-responses', mode: 'responses'},
  {pattern: /pirate/, name: 'system-messages', mode: 'responses'},
  {pattern: /get_current_weather/, name: 'tool-calls-inline-responses', mode: 'responses'},
  {pattern: /get_temperature/, name: 'multi-turn-tool-calling-responses', mode: 'responses'},
  {pattern: /default mode/, name: 'default-mode', mode: 'responses'},
  {pattern: /headers work/, name: 'custom-headers', mode: 'responses'},
  {pattern: /3\+3/, name: 'text-only-responses', mode: 'responses'},
  {pattern: /sync_tool/, name: 'sync-tool-function', mode: 'responses'},
  {pattern: /failing_tool/, name: 'tool-error-handling', mode: 'responses'},
  {pattern: /Count to 3/, name: 'multi-turn-history-responses', mode: 'responses'},

  // Completions API tests
  {pattern: /Completions mode works/, name: 'text-generation-completions', mode: 'completions'},
  {pattern: /Mode completions streaming works/, name: 'streaming-completions', mode: 'completions'},
  {pattern: /\badd\b.*tool/, name: 'tool-calls-callback-completions', mode: 'completions'},
  {pattern: /get_number/, name: 'multi-turn-tool-calling-completions', mode: 'completions'},
  {pattern: /get_secret_data/, name: 'missing-tool-handler', mode: 'completions'},
  {pattern: /Hello from instructions/, name: 'instructions-only-completions', mode: 'completions'},
  {pattern: /2\+2/, name: 'text-only-completions', mode: 'completions'},
  {pattern: /Hello.*What did I just say/, name: 'multi-turn-history-completions', mode: 'completions'},

  // Error tests
  {pattern: /invalid-url/, name: 'api-errors', mode: 'responses'},
];

function identifyTest(fixtures: Definition[]): {name: string; mode: string} | null {
  // Combine all request bodies to match against patterns
  const combinedInput = fixtures.map(f => {
    const body = typeof f.body === 'string' ? f.body : JSON.stringify(f.body);
    return body;
  }).join(' ');

  for (const mapping of TEST_MAPPING) {
    if (mapping.pattern.test(combinedInput)) {
      return {name: mapping.name, mode: mapping.mode};
    }
  }

  return null;
}

function groupFixturesByTest(allFixtures: Definition[]): Map<string, {fixtures: Definition[]; mode: string}> {
  const groups = new Map<string, {fixtures: Definition[]; mode: string}>();
  const used = new Set<number>();

  // Track current test being built
  let currentTest: {name: string; mode: string; fixtures: Definition[]} | null = null;

  for (let i = 0; i < allFixtures.length; i++) {
    if (used.has(i)) continue;

    const fixture = allFixtures[i];
    const isRequest = fixture.method === 'POST';

    if (isRequest) {
      // Start of a new test interaction
      // Find all consecutive fixtures that belong to this request (including responses)
      const testFixtures: Definition[] = [fixture];
      used.add(i);

      // Look ahead to find response fixtures
      for (let j = i + 1; j < allFixtures.length && j < i + 20; j++) {
        if (allFixtures[j].method === 'POST') break; // Next request
        testFixtures.push(allFixtures[j]);
        used.add(j);
      }

      // Try to identify which test this is
      const identified = identifyTest(testFixtures);

      if (identified) {
        // Check if we're continuing an existing test (multi-turn)
        if (currentTest && currentTest.name === identified.name) {
          currentTest.fixtures.push(...testFixtures);
        } else {
          // Save previous test if exists
          if (currentTest) {
            if (!groups.has(currentTest.name)) {
              groups.set(currentTest.name, {fixtures: [], mode: currentTest.mode});
            }
            groups.get(currentTest.name)!.fixtures.push(...currentTest.fixtures);
          }

          // Start new test
          currentTest = {
            name: identified.name,
            mode: identified.mode,
            fixtures: testFixtures
          };
        }
      }
    }
  }

  // Save last test
  if (currentTest) {
    if (!groups.has(currentTest.name)) {
      groups.set(currentTest.name, {fixtures: [], mode: currentTest.mode});
    }
    groups.get(currentTest.name)!.fixtures.push(...currentTest.fixtures);
  }

  return groups;
}

function migrateFixtures() {
  console.log('🔄 Migrating fixtures from .nock-fixtures.json to organized structure...\n');

  // Check if old fixtures exist
  if (!existsSync(OLD_FIXTURES_PATH)) {
    console.log('⚠️  No .nock-fixtures.json found. Skipping migration.');
    return;
  }

  // Read old fixtures
  const oldFixtures: Definition[] = JSON.parse(readFileSync(OLD_FIXTURES_PATH, 'utf8'));
  console.log(`📦 Loaded ${oldFixtures.length} HTTP fixtures from ${OLD_FIXTURES_PATH}`);

  // Group by test
  const groups = groupFixturesByTest(oldFixtures);
  console.log(`🔍 Identified ${groups.size} test groups\n`);

  // Create directories
  mkdirSync(join(FIXTURES_DIR, 'responses-api'), {recursive: true});
  mkdirSync(join(FIXTURES_DIR, 'completions-api'), {recursive: true});
  mkdirSync(join(FIXTURES_DIR, 'edge-cases'), {recursive: true});

  // Initialize metadata
  const metadata: MetadataFile = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    provider: 'openrouter',
    fixtures: {}
  };

  // Write each test's fixtures
  for (const [testName, {fixtures, mode}] of groups.entries()) {
    const subdir = mode === 'completions' ? 'completions-api' :
                   mode === 'responses' ? 'responses-api' :
                   'edge-cases';

    const fixturePath = join(FIXTURES_DIR, subdir, `${testName}.json`);

    // Write fixture file
    writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));

    // Calculate checksum
    const fixtureData = JSON.stringify(fixtures);
    const checksum = createHash('sha256').update(fixtureData).digest('hex').substring(0, 16);

    // Add to metadata
    metadata.fixtures[testName] = {
      path: `${subdir}/${testName}.json`,
      recordedAt: new Date().toISOString(),
      requestCount: fixtures.length,
      checksum
    };

    console.log(`✅ ${testName}: ${fixtures.length} fixtures → ${subdir}/${testName}.json`);
  }

  // Write metadata
  const metadataPath = join(FIXTURES_DIR, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`\n📝 Wrote metadata to ${metadataPath}`);

  console.log(`\n✨ Migration complete! ${groups.size} test fixtures organized.`);
  console.log(`\n💡 You can now delete ${OLD_FIXTURES_PATH} if desired.`);
}

// Run migration
migrateFixtures();
