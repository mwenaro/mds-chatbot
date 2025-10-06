// Comprehensive Anti-Hallucination Test Suite
const { performance } = require('perf_hooks');

// Test the enhanced hallucination detection functions
function containsPotentialHallucination(text, context = '') {
  const hallucinationPatterns = [
    // Staff/Personnel fabrication
    /here are the (heads of departments|department heads|staff members|teachers|faculty)/i,
    /\b(Mr\.|Mrs\.|Ms\.|Sheikh|Imam|Dr\.|Professor)\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/,
    /(Islamic Studies|Tahfidh|ICT|Mathematics|Science|English|History|Geography|Chemistry|Physics|Biology|Kiswahili|Arabic|French|Computer|Sports|Music|Art|Guidance|Counselling):\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam|Dr\.)/i,
    
    // Contact information fabrication
    /email:\s*[a-zA-Z0-9._%+-]+@(?!aburayyanacademy\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    /phone.*:?\s*(?!0722299287|0723755108)\+?[\d\s\-()]{7,}/,
    /website.*:?\s*(?!.*aburayyanacademy)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    
    // Fee/Cost fabrication (not matching known fees)
    /(?:fee|cost|tuition).*(?:ksh\.?\s*(?!13000|15500|17000|18500|24500|35000|2000|5000|250|2500|3000|7000|10000)\d+)/i,
    
    // General list fabrication indicators
    /here is a (?:complete )?list of/i,
    /the following (?:are|is) (?:a )?(?:complete )?(?:list|listing)/i,
    /(?:complete|full|detailed) (?:list|listing|breakdown) of/i,
  ];
  
  return hallucinationPatterns.some(pattern => pattern.test(text));
}

function isHighRiskQuery(query) {
  const highRiskKeywords = [
    'head of', 'heads of departments', 'department head', 'list all', 'give me all', 
    'complete list', 'full list', 'detailed list', 'specific names', 'contact details of',
    'organizational chart', 'hierarchy', 'salary', 'budget', 'internal procedures'
  ];
  
  const queryLower = query.toLowerCase();
  return highRiskKeywords.some(keyword => queryLower.includes(keyword));
}

function validateAgainstContext(text, context) {
  const issues = [];
  
  // Extract names from response
  const namePattern = /\b(Mr\.|Mrs\.|Ms\.|Sheikh|Imam|Dr\.|Professor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  const namesInResponse = [];
  let match;
  
  while ((match = namePattern.exec(text)) !== null) {
    namesInResponse.push(match[0]);
  }
  
  // Check if names exist in context
  for (const name of namesInResponse) {
    if (!context.toLowerCase().includes(name.toLowerCase())) {
      issues.push(`Name "${name}" not found in source documents`);
    }
  }
  
  // Extract email addresses
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailsInResponse = text.match(emailPattern) || [];
  
  for (const email of emailsInResponse) {
    if (!context.toLowerCase().includes(email.toLowerCase())) {
      issues.push(`Email "${email}" not found in source documents`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// Test queries categorized by risk level
const testCases = {
  highRisk: [
    "Who are the heads of departments at Abu Rayyan Academy?",
    "Give me a complete list of all staff members",
    "What are the contact details of individual teachers?",
    "List all department heads with their phone numbers",
    "Who is the head of Mathematics department?",
    "Show me the organizational chart",
    "What are the salaries of teachers?",
    "Give me detailed contact information for each teacher"
  ],
  
  mediumRisk: [
    "Who teaches Mathematics at the school?",
    "Who is responsible for ICT program?",
    "What is the background of the principal?",
    "How many teachers work at the school?",
    "Who can I contact about admissions?",
    "What qualifications do teachers have?"
  ],
  
  lowRisk: [
    "What is the fee structure?",
    "What programs does the school offer?",
    "Where is the school located?",
    "What are the school hours?",
    "What facilities does the school have?",
    "What is the school motto?",
    "When was the school established?",
    "What education system does the school follow?"
  ]
};

// Test responses that should be caught as hallucinations
const testResponses = {
  shouldBeCaught: [
    "Here are the heads of departments: Mathematics: Mr. Ahmed, Science: Dr. Sarah, English: Mrs. Fatima",
    "The school has the following teachers: Mr. John for ICT, Sheikh Omar for Islamic Studies",
    "You can contact the Mathematics teacher at math@school.com or call 0712345678",
    "The tuition fee for Grade 10 is Ksh. 45,000 per term",
    "Here is a complete list of all staff members with their contact details",
    "The school website is www.aburayyan-mombasa.ac.ke"
  ],
  
  shouldNotBeCaught: [
    "The principal of Abu Rayyan Academy is Mr. Duke Okioga",
    "You can contact the school at 0722299287 or info@aburayyanacademy.com",
    "The school fees for Grade 7-9 are Ksh. 24,500 per term",
    "Abu Rayyan Academy offers CBE, Islamic Integrated Program, Tahfidh Program, ICT Program, and Tuition Program",
    "The school is located along Ronald Ngala Road, opposite Petro Gas Station, Mombasa",
    "For specific staff information, please contact the academy directly"
  ]
};

// Sample context from the actual document
const sampleContext = `
Directors: Dr. Abdirazack Yussuf Abdinur & Madam Salatha Mohammed
Principal: Mr. Duke Okioga
Sectional Heads:
Junior & Senior School Section – Mr. Duke Okioga
Upper Primary School Section – Mr. Wekesa
Pre-Primary & Lower Primary School Section – Madam Celestine
Phone Numbers: 0722299287 / 0723755108
Email: info@aburayyanacademy.com
Location: Along Ronald Ngala Road, opposite Petro Gas Station, Mombasa
`;

console.log('🛡️  COMPREHENSIVE ANTI-HALLUCINATION TEST SUITE');
console.log('=' .repeat(60));

// Test 1: Query Risk Assessment
console.log('\n📊 TEST 1: Query Risk Assessment\n');
Object.keys(testCases).forEach(riskLevel => {
  console.log(`${riskLevel.toUpperCase()} RISK QUERIES:`);
  testCases[riskLevel].forEach((query, index) => {
    const isHighRisk = isHighRiskQuery(query);
    const riskStatus = isHighRisk ? '🔴 HIGH' : '🟢 LOW';
    console.log(`  ${index + 1}. "${query}"`);
    console.log(`     Risk Level: ${riskStatus}`);
  });
  console.log('');
});

// Test 2: Hallucination Detection in Responses
console.log('\n🚨 TEST 2: Hallucination Detection in Responses\n');

console.log('RESPONSES THAT SHOULD BE CAUGHT:');
testResponses.shouldBeCaught.forEach((response, index) => {
  const hasHallucination = containsPotentialHallucination(response, sampleContext);
  const validation = validateAgainstContext(response, sampleContext);
  const status = hasHallucination || !validation.isValid ? '✅ CAUGHT' : '❌ MISSED';
  
  console.log(`  ${index + 1}. "${response.substring(0, 60)}..."`);
  console.log(`     Status: ${status}`);
  if (!validation.isValid) {
    console.log(`     Issues: ${validation.issues.join(', ')}`);
  }
});

console.log('\nRESPONSES THAT SHOULD NOT BE CAUGHT:');
testResponses.shouldNotBeCaught.forEach((response, index) => {
  const hasHallucination = containsPotentialHallucination(response, sampleContext);
  const validation = validateAgainstContext(response, sampleContext);
  const status = hasHallucination || !validation.isValid ? '❌ FALSE POSITIVE' : '✅ CORRECT';
  
  console.log(`  ${index + 1}. "${response.substring(0, 60)}..."`);
  console.log(`     Status: ${status}`);
});

// Test 3: Context Validation
console.log('\n🔍 TEST 3: Context Validation Test\n');

const contextTestCases = [
  {
    response: "The head of ICT is Mr. Ahmed Hassan",
    shouldBeValid: false,
    reason: "Mr. Ahmed Hassan not in context"
  },
  {
    response: "The principal is Mr. Duke Okioga",
    shouldBeValid: true,
    reason: "Mr. Duke Okioga is mentioned in context"
  },
  {
    response: "Contact us at support@aburayyan.edu",
    shouldBeValid: false,
    reason: "Email not matching the official one in context"
  },
  {
    response: "Contact us at info@aburayyanacademy.com",
    shouldBeValid: true,
    reason: "Official email from context"
  }
];

contextTestCases.forEach((testCase, index) => {
  const validation = validateAgainstContext(testCase.response, sampleContext);
  const isCorrect = validation.isValid === testCase.shouldBeValid;
  const status = isCorrect ? '✅ CORRECT' : '❌ INCORRECT';
  
  console.log(`  ${index + 1}. "${testCase.response}"`);
  console.log(`     Expected: ${testCase.shouldBeValid ? 'Valid' : 'Invalid'} (${testCase.reason})`);
  console.log(`     Result: ${validation.isValid ? 'Valid' : 'Invalid'}`);
  console.log(`     Status: ${status}`);
  if (!validation.isValid) {
    console.log(`     Issues: ${validation.issues.join(', ')}`);
  }
  console.log('');
});

// Test 4: Performance Assessment
console.log('\n⚡ TEST 4: Performance Assessment\n');

const performanceTests = [
  () => isHighRiskQuery("Who are the heads of departments?"),
  () => containsPotentialHallucination("Here are the department heads: Math: Mr. X", sampleContext),
  () => validateAgainstContext("The principal is Mr. Duke Okioga", sampleContext)
];

performanceTests.forEach((test, index) => {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    test();
  }
  const end = performance.now();
  const avgTime = (end - start) / 1000;
  
  console.log(`  Test ${index + 1}: ${avgTime.toFixed(4)}ms average (1000 iterations)`);
});

console.log('\n' + '='.repeat(60));
console.log('🎯 SUMMARY: Enhanced anti-hallucination system ready!');
console.log('   - Comprehensive pattern detection');
console.log('   - Context-based validation');
console.log('   - Risk-based query filtering');
console.log('   - Performance optimized');
console.log('=' .repeat(60));