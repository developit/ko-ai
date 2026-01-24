#!/usr/bin/env node
import {createFixtureManager} from './record-replay.ts';

async function validateFixtures() {
  const manager = createFixtureManager();

  console.log('🔍 Validating fixtures...\n');

  const results = manager.validateAll();
  const entries = Object.entries(results);

  if (entries.length === 0) {
    console.log('⚠️  No fixtures found to validate');
    process.exit(0);
  }

  let validCount = 0;
  let invalidCount = 0;

  for (const [testName, result] of entries) {
    if (!result.valid) {
      console.error(`❌ ${testName}: ${result.error}`);
      invalidCount++;
    } else {
      console.log(`✅ ${testName}`);
      if (result.metadata) {
        console.log(`   📅 Recorded: ${new Date(result.metadata.recordedAt).toLocaleDateString()}`);
        console.log(`   📊 Requests: ${result.metadata.requestCount}`);
        console.log(`   🔒 Checksum: ${result.metadata.checksum}`);
      }
      validCount++;
    }
  }

  console.log(`\n📈 Summary: ${validCount} valid, ${invalidCount} invalid`);

  if (invalidCount > 0) {
    console.error('\n⚠️  Some fixtures are invalid. Re-record them with:');
    console.error('   KOAI_TEST_MODE=record OPENROUTER_API_KEY=your-key npm test');
    process.exit(1);
  } else {
    console.log('\n✨ All fixtures are valid!');
  }
}

validateFixtures().catch((error) => {
  console.error('Error validating fixtures:', error);
  process.exit(1);
});
