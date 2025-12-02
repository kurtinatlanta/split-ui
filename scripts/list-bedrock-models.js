import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand
} from "@aws-sdk/client-bedrock";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = new BedrockClient({
  region: process.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.VITE_AWS_SESSION_TOKEN,
  },
});

async function listInferenceProfiles() {
  try {
    console.log('\n🔍 Checking Inference Profiles (RECOMMENDED for Bedrock):\n');

    const command = new ListInferenceProfilesCommand({});
    const response = await client.send(command);

    const claudeProfiles = response.inferenceProfileSummaries
      ?.filter(profile =>
        profile.inferenceProfileName?.toLowerCase().includes('claude') ||
        profile.inferenceProfileId?.toLowerCase().includes('anthropic')
      );

    if (claudeProfiles && claudeProfiles.length > 0) {
      claudeProfiles.forEach(profile => {
        console.log(`  ✓ ${profile.inferenceProfileId}`);
        console.log(`    Name: ${profile.inferenceProfileName}`);
        console.log(`    Type: ${profile.type}`);
        console.log(`    Status: ${profile.status}`);
        console.log('');
      });

      console.log('💡 Use one of these inference profile IDs in VITE_BEDROCK_MODEL\n');
    } else {
      console.log('  ⚠️  No Claude inference profiles found.');
      console.log('  You may need to enable model access in AWS Bedrock Console.\n');
    }
  } catch (error) {
    console.error('Error listing inference profiles:', error.message);
  }
}

async function listModels() {
  try {
    console.log('\n📋 Available Anthropic Foundation Models:\n');

    const command = new ListFoundationModelsCommand({
      byProvider: 'Anthropic',
    });

    const response = await client.send(command);

    response.modelSummaries
      ?.filter(model => model.modelId.includes('claude'))
      .forEach(model => {
        console.log(`  ${model.modelId}`);
        console.log(`    Name: ${model.modelName}`);
        if (model.inferenceTypesSupported) {
          console.log(`    Supports: ${model.inferenceTypesSupported.join(', ')}`);
        }
        console.log('');
      });

    console.log('⚠️  Note: Some models require inference profiles for on-demand access\n');
  } catch (error) {
    console.error('Error listing models:', error.message);
  }
}

async function checkAccess() {
  console.log('Checking AWS Bedrock access...');
  console.log('Region:', process.env.VITE_AWS_REGION || 'us-east-1');
  console.log('');

  await listInferenceProfiles();
  await listModels();

  console.log('\n💡 Quick Tips:');
  console.log('  1. Use an inference profile ID (top list) for best results');
  console.log('  2. If no profiles shown, enable model access in AWS Console:');
  console.log('     https://console.aws.amazon.com/bedrock/home#/modelaccess');
  console.log('  3. Inference profiles provide better availability and throughput\n');
}

checkAccess();
