#!/usr/bin/env node

/**
 * Environment Validation Script
 * Run this to check if your .env.local is properly configured
 * 
 * Usage: node scripts/validate-env.js
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(process.cwd(), '.env.local');

function validateEnv() {
  console.log('🔍 Validating environment configuration...\n');

  // Check if .env.local exists
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ .env.local file not found!');
    console.log('📝 Please copy .env.local.example to .env.local and fill in your values');
    process.exit(1);
  }

  // Read and parse .env.local
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });

  let hasErrors = false;

  // Required variables
  const required = {
    'MONGODB_URI': 'Database connection string',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': 'Clerk publishable key',
    'CLERK_SECRET_KEY': 'Clerk secret key'
  };

  // Optional but recommended
  const recommended = {
    'GROQ_API_KEY': 'Groq API key (free & fast)',
    'HUGGINGFACE_API_KEY': 'Hugging Face API key (free)',
    'OPENAI_API_KEY': 'OpenAI API key (premium)'
  };

  console.log('📋 Required Configuration:');
  for (const [key, description] of Object.entries(required)) {
    if (!envVars[key] || envVars[key].includes('your_') || envVars[key].includes('username')) {
      console.log(`❌ ${key}: Missing or using placeholder value`);
      console.log(`   Description: ${description}`);
      hasErrors = true;
    } else {
      console.log(`✅ ${key}: Configured`);
    }
  }

  console.log('\n🔧 Recommended Configuration:');
  let hasAnyAI = false;
  for (const [key, description] of Object.entries(recommended)) {
    if (envVars[key] && !envVars[key].includes('your_')) {
      console.log(`✅ ${key}: Configured`);
      hasAnyAI = true;
    } else {
      console.log(`⚠️  ${key}: Not configured`);
      console.log(`   Description: ${description}`);
    }
  }

  if (!hasAnyAI) {
    console.log('\n❌ No AI provider configured! At least one is required for chat functionality.');
    hasErrors = true;
  }

  // MongoDB URI validation
  if (envVars['MONGODB_URI']) {
    const uri = envVars['MONGODB_URI'];
    if (uri.startsWith('mongodb://localhost') || uri.startsWith('mongodb+srv://')) {
      console.log('\n✅ MongoDB URI format looks correct');
    } else {
      console.log('\n❌ MongoDB URI format may be incorrect');
      console.log('   Expected: mongodb://localhost:27017/... or mongodb+srv://...');
      hasErrors = true;
    }
  }

  // Clerk keys validation
  if (envVars['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] && !envVars['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'].startsWith('pk_')) {
    console.log('\n❌ Clerk publishable key should start with "pk_"');
    hasErrors = true;
  }

  if (envVars['CLERK_SECRET_KEY'] && !envVars['CLERK_SECRET_KEY'].startsWith('sk_')) {
    console.log('\n❌ Clerk secret key should start with "sk_"');
    hasErrors = true;
  }

  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('❌ Configuration has issues. Please fix the above problems.');
    console.log('📖 See .env.setup.md for detailed setup instructions.');
    process.exit(1);
  } else {
    console.log('✅ Environment configuration looks good!');
    console.log('🚀 You can now run: npm run dev');
  }
}

if (require.main === module) {
  validateEnv();
}

module.exports = { validateEnv };
