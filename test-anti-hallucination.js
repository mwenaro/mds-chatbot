// Test script for anti-hallucination functionality
const path = require('path');
const fs = require('fs');

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_MODEL = 'gpt-4o-mini';

// Test the hallucination detection function
function containsPotentialHallucination(text) {
  const patterns = [
    /here are the (heads of departments|department heads|staff members)/i,
    /\b(Mr\.|Mrs\.|Ms\.|Sheikh|Imam)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
    /(Islamic Studies|Tahfidh|ICT|Mathematics|Science|English|History|Geography|Chemistry|Physics|Biology|Kiswahili|Arabic|French|Computer|Sports|Music|Art):\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam)/i,
    /heads of departments.*:\s*\n/i,
    /team of dedicated heads/i,
    /department heads include/i,
    /following are.*heads/i,
    /head of.*department/i,
    /current heads.*are/i,
    /department.*led by/i,
    /head.*responsible for/i
  ];
  
  return patterns.some(pattern => pattern.test(text));
}

function isStaffRelatedQuery(query) {
  const staffKeywords = [
    'head of', 'heads of departments', 'department head', 'department heads', 'who is', 'who are',
    'staff', 'teacher', 'teachers', 'principal', 'director', 'coordinator', 'manager',
    'faculty', 'personnel', 'employee', 'team member', 'teaches', 'teaching',
    'head teacher', 'subject teacher', 'class teacher', 'instructor', 'educator'
  ];
  
  const queryLower = query.toLowerCase();
  return staffKeywords.some(keyword => queryLower.includes(keyword));
}

// Test queries
const testQueries = [
  "Who are the heads of departments at Abu Rayyan Academy?",
  "Who is the head of Islamic Studies department?", 
  "Can you list the department heads?",
  "Who teaches Mathematics at the school?",
  "What is the fee structure?",
  "Who is the principal?",
  "What programs does the school offer?"
];

console.log('Testing Anti-Hallucination Detection System\n');
console.log('='.repeat(50));

testQueries.forEach((query, index) => {
  console.log(`\nTest ${index + 1}: "${query}"`);
  
  const isStaffQuery = isStaffRelatedQuery(query);
  console.log(`  Staff-related query: ${isStaffQuery}`);
  
  if (isStaffQuery) {
    const queryLower = query.toLowerCase();
    const isDepartmentHeadQuery = queryLower.includes('head of') || 
                                  queryLower.includes('department head') || 
                                  queryLower.includes('heads of departments');
    
    console.log(`  Department head query: ${isDepartmentHeadQuery}`);
    
    if (isDepartmentHeadQuery) {
      console.log(`  ✅ Should return safe response`);
    } else {
      console.log(`  ⚠️  General staff query - check context`);
    }
  } else {
    console.log(`  ✅ Regular query - proceed normally`);
  }
});

// Test hallucination detection on sample responses
const testResponses = [
  "Abu Rayyan Academy has the following heads of departments: Mr. Ahmed for Islamic Studies, Mrs. Fatima for Mathematics.",
  "The principal of Abu Rayyan Academy is Mr. Duke Okioga.",
  "Here are the heads of departments at Abu Rayyan Academy: Islamic Studies: Mr. Ali, Mathematics: Mrs. Sarah",
  "I don't have information about specific staff assignments. Please contact the academy directly.",
  "The school offers CBE, Islamic Integrated Program, Tahfidh Program, ICT Program, and Tuition Program."
];

console.log('\n\nTesting Hallucination Detection on Responses\n');
console.log('='.repeat(50));

testResponses.forEach((response, index) => {
  console.log(`\nResponse ${index + 1}: "${response.substring(0, 80)}..."`);
  const hasHallucination = containsPotentialHallucination(response);
  console.log(`  Contains hallucination: ${hasHallucination ? '❌ YES' : '✅ NO'}`);
});

console.log('\n' + '='.repeat(50));
console.log('Test completed!');