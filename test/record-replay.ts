import {test, before, after} from 'node:test';
import nock from 'nock';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {createHash} from 'node:crypto';

export type TestMode = 'record' | 'replay' | 'auto';
export type ApiMode = 'completions' | 'responses';

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

interface RecordReplayOptions {
  mode: TestMode;
  fixtureDir: string;
  apiKey?: string;
  provider?: string;
  updateFixtures?: string[];  // List of test names to re-record
}

export class FixtureManager {
  private mode: TestMode;
  private fixtureDir: string;
  private apiKey?: string;
  private provider: string;
  private updateFixtures: Set<string>;
  private metadataPath: string;
  private metadata: MetadataFile;
  private activeRecordings: Map<string, nock.Definition[]> = new Map();

  constructor(options: RecordReplayOptions) {
    this.mode = options.mode;
    this.fixtureDir = options.fixtureDir;
    this.apiKey = options.apiKey;
    this.provider = options.provider || 'openrouter';
    this.updateFixtures = new Set(options.updateFixtures || []);
    this.metadataPath = join(this.fixtureDir, 'metadata.json');

    // Load or initialize metadata
    if (existsSync(this.metadataPath)) {
      this.metadata = JSON.parse(readFileSync(this.metadataPath, 'utf8'));
    } else {
      this.metadata = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        provider: this.provider,
        fixtures: {}
      };
    }
  }

  /**
   * Get the effective mode for a specific test
   */
  private getEffectiveMode(testName: string, apiMode: ApiMode): TestMode {
    // If user wants to update this specific fixture, use record mode
    if (this.updateFixtures.has(testName)) {
      return 'record';
    }

    if (this.mode === 'auto') {
      // Auto mode: record if fixture doesn't exist, replay if it does
      const fixtureExists = this.exists(testName, apiMode);
      if (!fixtureExists && !this.apiKey) {
        throw new Error(
          `Fixture not found for "${testName}" and no API key provided. ` +
          `Set OPENROUTER_API_KEY to record fixtures, or use KOAI_TEST_MODE=replay to skip missing fixtures.`
        );
      }
      return fixtureExists ? 'replay' : 'record';
    }

    return this.mode;
  }

  /**
   * Get the fixture file path for a test
   */
  private getFixturePath(testName: string, apiMode: ApiMode): string {
    const subdir = apiMode === 'completions' ? 'completions-api' :
                   apiMode === 'responses' ? 'responses-api' :
                   'edge-cases';
    return join(this.fixtureDir, subdir, `${testName}.json`);
  }

  /**
   * Check if a fixture exists and has content
   */
  exists(testName: string, apiMode: ApiMode): boolean {
    const fixturePath = this.getFixturePath(testName, apiMode);
    if (!existsSync(fixturePath)) return false;

    try {
      const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));
      return Array.isArray(fixtures) && fixtures.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Load fixtures for a test
   */
  load(testName: string, apiMode: ApiMode): nock.Definition[] {
    const fixturePath = this.getFixturePath(testName, apiMode);

    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }

    const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));

    // Remove authorization headers from fixtures so nock doesn't match on them
    return fixtures.map((fixture: nock.Definition) => {
      if (fixture.reqheaders) {
        const { authorization, ...otherHeaders } = fixture.reqheaders as any;
        return {
          ...fixture,
          reqheaders: Object.keys(otherHeaders).length > 0 ? otherHeaders : undefined
        };
      }
      return fixture;
    });
  }

  /**
   * Save fixtures for a test
   */
  save(testName: string, apiMode: ApiMode, fixtures: nock.Definition[]): void {
    const fixturePath = this.getFixturePath(testName, apiMode);
    const dir = dirname(fixturePath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, {recursive: true});
    }

    // Sanitize fixtures: replace actual API keys with placeholder
    const sanitized = fixtures.map(fixture => {
      const sanitizedFixture = { ...fixture };
      if (sanitizedFixture.reqheaders) {
        sanitizedFixture.reqheaders = { ...sanitizedFixture.reqheaders };
        // Replace authorization header with placeholder
        if (sanitizedFixture.reqheaders.authorization) {
          sanitizedFixture.reqheaders.authorization = 'Bearer REDACTED_API_KEY';
        }
      }
      return sanitizedFixture;
    });

    // Write fixture file
    writeFileSync(fixturePath, JSON.stringify(sanitized, null, 2));

    // Update metadata (use sanitized fixtures for checksum)
    const fixtureData = JSON.stringify(sanitized);
    const checksum = createHash('sha256').update(fixtureData).digest('hex');

    const subdir = apiMode === 'completions' ? 'completions-api' :
                   apiMode === 'responses' ? 'responses-api' :
                   'edge-cases';

    this.metadata.fixtures[testName] = {
      path: `${subdir}/${testName}.json`,
      recordedAt: new Date().toISOString(),
      requestCount: fixtures.length,
      checksum: checksum.substring(0, 16)  // Short checksum
    };

    this.metadata.lastUpdated = new Date().toISOString();
  }

  /**
   * Get metadata for a fixture
   */
  getMetadata(testName: string): FixtureMetadata | undefined {
    return this.metadata.fixtures[testName];
  }

  /**
   * Validate a fixture
   */
  validate(testName: string, apiMode: ApiMode): {valid: boolean; error?: string} {
    try {
      if (!this.exists(testName, apiMode)) {
        return {valid: false, error: 'Fixture file does not exist'};
      }

      const fixtures = this.load(testName, apiMode);

      if (!Array.isArray(fixtures)) {
        return {valid: false, error: 'Fixture is not an array'};
      }

      if (fixtures.length === 0) {
        return {valid: false, error: 'Fixture is empty'};
      }

      // Validate checksum
      const metadata = this.getMetadata(testName);
      if (metadata) {
        const fixtureData = JSON.stringify(fixtures);
        const checksum = createHash('sha256').update(fixtureData).digest('hex').substring(0, 16);

        if (checksum !== metadata.checksum) {
          return {valid: false, error: 'Checksum mismatch - fixture may be corrupted'};
        }
      }

      return {valid: true};
    } catch (error: any) {
      return {valid: false, error: error.message};
    }
  }

  /**
   * Validate all fixtures
   */
  validateAll(): Record<string, {valid: boolean; error?: string; metadata?: FixtureMetadata}> {
    const results: Record<string, {valid: boolean; error?: string; metadata?: FixtureMetadata}> = {};

    for (const [testName, metadata] of Object.entries(this.metadata.fixtures)) {
      // Determine API mode from path
      const apiMode: ApiMode = metadata.path.includes('completions-api') ? 'completions' : 'responses';
      const validation = this.validate(testName, apiMode);

      results[testName] = {
        ...validation,
        metadata
      };
    }

    return results;
  }

  /**
   * Save metadata to disk
   */
  saveMetadata(): void {
    const dir = dirname(this.metadataPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, {recursive: true});
    }
    writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }

  /**
   * Setup nock for a test (called in before hook)
   */
  setupTest(testName: string, apiMode: ApiMode): void {
    const effectiveMode = this.getEffectiveMode(testName, apiMode);

    if (effectiveMode === 'replay') {
      // Check if fixture has content
      if (!this.exists(testName, apiMode)) {
        throw new Error(
          `Fixture not found or empty for "${testName}". ` +
          `Set OPENROUTER_API_KEY and use KOAI_TEST_MODE=record or auto to record fixtures.`
        );
      }
      // Load and define fixtures (auth headers are stripped in load())
      const fixtures = this.load(testName, apiMode);
      nock.define(fixtures);
    } else if (effectiveMode === 'record') {
      // Start recording - we need to restore and reactivate to reset recorder state
      if (nock.isActive()) {
        nock.restore();
      }
      nock.activate();

      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
        enable_reqheaders_recording: true,
      });
    }
  }

  /**
   * Teardown nock for a test (called in after hook)
   */
  teardownTest(testName: string, apiMode: ApiMode): void {
    const effectiveMode = this.getEffectiveMode(testName, apiMode);

    if (effectiveMode === 'record') {
      // Stop recording and get fixtures
      const recordings = nock.recorder.play() as nock.Definition[];

      // Store for this test
      this.activeRecordings.set(testName, recordings);

      // Save to disk
      this.save(testName, apiMode, recordings);

      console.log(`\n✅ Recorded ${recordings.length} HTTP fixtures for "${testName}"`);

      // MUST call restore() to reset recorder state
      // Note: recorder.play() deactivates nock (isActive() = false),
      // but restore() still needs to be called to reset recordingInProgress flag
      nock.restore();

      // Clean up any pending interceptors after recording
      nock.cleanAll();
    }
    // In replay mode, don't clean interceptors - just consume them
  }

  /**
   * Global cleanup (called after all tests)
   */
  cleanup(): void {
    if (this.activeRecordings.size > 0) {
      // Save metadata after recording
      this.saveMetadata();
      console.log(`\n📝 Updated metadata with ${this.activeRecordings.size} fixtures`);
    }

    nock.restore();
    nock.cleanAll();
  }
}

/**
 * Wrapper for test() that handles record/replay for a specific test
 */
export function recordReplayTest(
  fixtureManager: FixtureManager,
  testName: string,
  apiMode: ApiMode,
  testFn: () => Promise<void>
): void {
  test(testName, async () => {
    // Setup before test
    fixtureManager.setupTest(testName, apiMode);

    try {
      // Run the actual test
      await testFn();
    } finally {
      // Teardown after test
      fixtureManager.teardownTest(testName, apiMode);
    }
  });
}

/**
 * Create a fixture manager from environment variables
 */
export function createFixtureManager(): FixtureManager {
  const mode = (process.env.KOAI_TEST_MODE || 'auto') as TestMode;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fixtureDir = process.env.KOAI_FIXTURE_DIR || './fixtures';
  const updateFixtures = process.env.KOAI_UPDATE_FIXTURES?.split(',').map(s => s.trim()).filter(Boolean);

  // Validate mode
  if (mode === 'record' && !apiKey) {
    throw new Error('OPENROUTER_API_KEY is required for record mode');
  }

  return new FixtureManager({
    mode,
    fixtureDir,
    apiKey,
    updateFixtures
  });
}
