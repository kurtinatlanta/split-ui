import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('\n🔍 Checking Bearer Token Configuration:\n');

// Check environment variables
const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
const accessKey = process.env.VITE_AWS_ACCESS_KEY_ID;
const secretKey = process.env.VITE_AWS_SECRET_ACCESS_KEY;

if (bearerToken) {
  console.log('✓ AWS_BEARER_TOKEN_BEDROCK found');
  console.log(`  Length: ${bearerToken.length} characters`);
  console.log(`  Preview: ${bearerToken.substring(0, 20)}...`);
  console.log('');
} else {
  console.log('✗ AWS_BEARER_TOKEN_BEDROCK not found');
  console.log('');
}

if (accessKey) {
  console.log('✓ AWS Access Key found:', accessKey.substring(0, 10) + '...');
}

if (secretKey) {
  console.log('✓ AWS Secret Key found');
}

console.log('\n💡 Bearer Token Type:');
console.log('  - If it starts with "ey": Likely a JWT token');
console.log('  - If from AWS SSO: Need to exchange for temp credentials');
console.log('  - If from custom system: Need custom authentication\n');

if (bearerToken && bearerToken.startsWith('ey')) {
  console.log('This looks like a JWT token.');
  console.log('You may need to decode it or exchange it for AWS credentials.\n');
}
