import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ragVectorStore } from '@/lib/services/rag-vector-store';
import { AIConfigurationService } from '@/lib/services/ai-configuration';
import { SystemPromptsService } from '@/lib/services/system-prompts';
import { ResponseValidator } from '@/lib/services/response-validator';
import { DocumentAnalyzer } from '@/lib/services/document-analyzer';

// Helper functions for general query analysis (document-agnostic)
function isHighRiskQuery(query: string): boolean {
  const highRiskKeywords = [
    // Requests for detailed listings that might not exist
    'list all', 'give me all', 'complete list', 'full list', 'detailed list',
    'specific names', 'individual names', 'contact details of', 'phone number of',
    'email address of', 'personal information', 'background of', 'qualification of',
    
    // Administrative details that might not be documented
    'organizational chart', 'hierarchy', 'reporting structure', 'management team',
    'board members', 'trustees', 'governing body', 'administration team',
    
    // Financial specifics beyond basic information
    'salary', 'budget', 'financial statement', 'profit', 'revenue', 'expenditure',
    'detailed costs', 'breakdown of expenses', 'financial details',
    
    // Internal processes
    'internal procedures', 'hiring process', 'recruitment', 'performance evaluation',
    'disciplinary procedures', 'internal policies', 'staff handbook'
  ];
  
  const queryLower = query.toLowerCase();
  return highRiskKeywords.some(keyword => queryLower.includes(keyword));
}

function isOrganizationalQuery(query: string): boolean {
  const orgKeywords = [
    'head of', 'heads of departments', 'department head', 'department heads', 'who is', 'who are',
    'staff', 'teacher', 'teachers', 'principal', 'director', 'coordinator', 'manager',
    'faculty', 'personnel', 'employee', 'team member', 'teaches', 'teaching',
    'leadership', 'administration', 'organizational structure'
  ];
  
  const queryLower = query.toLowerCase();
  return orgKeywords.some(keyword => queryLower.includes(keyword));
}

function contextContainsStaffInfo(context: string): boolean {
  const staffIndicators = [
    'head of', 'director', 'principal', 'teacher', 'coordinator',
    'staff list', 'personnel', 'mr.', 'mrs.', 'sheikh', 'teaches'
  ];
  
  const contextLower = context.toLowerCase();
  return staffIndicators.some(indicator => contextLower.includes(indicator));
}

function createDocumentBasedResponse(context: string, query: string): NextResponse | null {
  // Analyze the document content dynamically
  const orgStructure = DocumentAnalyzer.analyzeOrganizationalStructure(context);
  
  // Generate response based on document analysis
  const response = DocumentAnalyzer.generateOrganizationalResponse(orgStructure, query);
  const contactInfo = DocumentAnalyzer.getContactResponse(orgStructure);
  
  if (response.includes("don't have specific")) {
    return null; // Let it proceed to normal RAG
  }
  
  const fullResponse = `${response}\n\n${contactInfo}`;
  
  return NextResponse.json({
    response: fullResponse,
    source: 'document-analysis',
    confidence: 0.9,
    metadata: {
      organizationalStructure: orgStructure,
      analysisType: 'dynamic-document-based'
    }
  });
}

function containsPotentialHallucination(text: string, context: string = ''): boolean {
  // Dynamic hallucination detection based purely on context validation
  if (!context) {
    return false; // Can't validate without context
  }
  
  // 1. Check if response contains information that's not in the context
  const contextValidation = validateAgainstContext(text, context);
  if (!contextValidation.isValid) {
    console.log('Hallucination detected: Information not found in context', contextValidation.issues);
    return true;
  }
  
  // 2. Check for fabricated lists or inventories
  const hasFabricatedList = detectFabricatedLists(text, context);
  if (hasFabricatedList) {
    console.log('Hallucination detected: Fabricated list structure');
    return true;
  }
  
  // 3. Check for specific names or contacts not in context
  if (hasUnverifiedNames(text, context)) {
    console.log('Hallucination detected: Names not found in context');
    return true;
  }
  
  return false;
}

function validateAgainstContext(text: string, context: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Extract specific claims from the text that need validation
  const specificClaims = extractSpecificClaims(text);
  
  for (const claim of specificClaims) {
    if (!context.toLowerCase().includes(claim.toLowerCase())) {
      issues.push(`Claim not found in context: "${claim}"`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

function extractSpecificClaims(text: string): string[] {
  const claims: string[] = [];
  
  // Extract names in patterns like "Mr. X", "Dr. Y", etc.
  const namePattern = /(Mr\.|Mrs\.|Ms\.|Dr\.|Sheikh|Professor|Miss)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  const nameMatches = text.match(namePattern);
  if (nameMatches) {
    claims.push(...nameMatches);
  }
  
  // Extract organizational positions
  const positionPattern = /(Head of|Director of|Principal of|Coordinator of|Manager of)\s+[A-Za-z\s]+/gi;
  const positionMatches = text.match(positionPattern);
  if (positionMatches) {
    claims.push(...positionMatches);
  }
  
  // Extract department structures
  const deptPattern = /Department.*?:[^:\n]+/gi;
  const deptMatches = text.match(deptPattern);
  if (deptMatches) {
    claims.push(...deptMatches);
  }
  
  return claims;
}

function detectFabricatedLists(text: string, context: string): boolean {
  // Check for list patterns that might be fabricated
  const listPatterns = [
    /Department.*?:.*?Mr\.|Mrs\.|Dr\./gi,
    /\d+\.\s+.*?Department/gi,
    /•.*?Department.*?:/gi,
    /-.*?Department.*?:/gi
  ];
  
  for (const pattern of listPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 2) { // Multiple structured items
      // Check if these structured items are actually in the context
      const unverified = matches.filter(match => 
        !context.toLowerCase().includes(match.toLowerCase().replace(/[•\-\d\.:]/g, '').trim())
      );
      if (unverified.length > 0) {
        return true;
      }
    }
  }
  
  return false;
}

function hasUnverifiedNames(text: string, context: string): boolean {
  // Extract all proper names and check if they exist in context
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const names = text.match(namePattern);
  
  if (!names || names.length === 0) return false;
  
  // Filter to likely person names (those with titles or in organizational context)
  const personNames = names.filter(name => {
    const surrounding = text.toLowerCase();
    const nameIndex = surrounding.indexOf(name.toLowerCase());
    if (nameIndex === -1) return false;
    
    const before = surrounding.substring(Math.max(0, nameIndex - 20), nameIndex);
    const after = surrounding.substring(nameIndex, Math.min(surrounding.length, nameIndex + name.length + 20));
    
    const hasTitle = /\b(mr|mrs|ms|dr|sheikh|professor|miss)\b/.test(before);
    const hasRole = /(head|director|principal|coordinator|manager|teacher)/.test(before + after);
    
    return hasTitle || hasRole;
  });
  
  // Check if person names exist in context
  const unverifiedNames = personNames.filter(name => 
    !context.toLowerCase().includes(name.toLowerCase())
  );
  
  return unverifiedNames.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    console.log('RAG API endpoint called');
    
    const body = await request.json();
    const { message, useAntiHallucination = true } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('Processing RAG query:', message.substring(0, 100) + '...');

    // Initialize the document analyzer
    const documentAnalyzer = new DocumentAnalyzer();

    // Pre-query risk assessment
    const isHighRisk = isHighRiskQuery(message);
    const isOrgQuery = isOrganizationalQuery(message);

    // Get relevant context from the documents
    const retrievalContext = await ragVectorStore.getRetrievalContext(message, 3);
    
    console.log('Retrieved context length:', retrievalContext.length);
    console.log('Query risk assessment - High risk:', isHighRisk, 'Organizational:', isOrgQuery);

    // Enhanced pre-filtering using document analysis
    if (isOrgQuery && retrievalContext) {
      // Try to generate a document-based response first
      const documentResponse = createDocumentBasedResponse(retrievalContext, message);
      if (documentResponse) {
        console.log('Generated document-based organizational response');
        return documentResponse;
      }
    }

    // Enhanced pre-filtering for risky queries
    if (isHighRisk) {
      const queryLower = message.toLowerCase();
      
      if (queryLower.includes('list all') || queryLower.includes('complete list') || queryLower.includes('full list')) {
        console.log('Detailed list query detected - insufficient context for comprehensive listing');
        return NextResponse.json({
          response: "I can provide information based on the available documents, but I don't have access to comprehensive lists. For detailed information, please contact the institution directly using the provided contact information.",
          source: 'safety-filter',
          confidence: 1.0
        });
      }
      
      if (queryLower.includes('contact details of') || queryLower.includes('phone number of') || queryLower.includes('email address of')) {
        console.log('Specific contact query detected - providing general contact info');
        return NextResponse.json({
          response: "I don't have specific contact details for individual staff members. Please use the main contact information provided in the documents, and they can direct you to the appropriate person.",
          source: 'safety-filter',
          confidence: 1.0
        });
      }
    }

    // Use anti-hallucination configuration for RAG
    const useCase = useAntiHallucination ? 'factual' : 'balanced';
    const modelConfig = AIConfigurationService.getOpenAIConfig(useCase);

    // Initialize ChatOpenAI with anti-hallucination settings
    const chatModel = new ChatOpenAI(modelConfig);

    // Create enhanced system message for RAG with comprehensive anti-hallucination measures
    const baseRAGPrompt = SystemPromptsService.getSystemPrompt('rag');
    
    // Build comprehensive system prompt with dynamic anti-hallucination
    const organizationAnalysis = DocumentAnalyzer.analyzeOrganizationalStructure(retrievalContext);
    
    const systemPrompt = `${baseRAGPrompt}

You are an AI assistant that provides information based EXCLUSIVELY on the provided document context. Your role is to be helpful while maintaining strict accuracy.

🛡️ DYNAMIC ANTI-HALLUCINATION PROTOCOL:

🚫 ABSOLUTE PROHIBITIONS:
1. NEVER invent, create, or fabricate ANY information not explicitly present in the provided context
2. NEVER create organizational charts, staff lists, or personnel directories beyond what's documented
3. NEVER provide specific details about individuals, roles, or contacts unless EXPLICITLY stated in context
4. NEVER make assumptions about organizational structures, hierarchies, or administrative details
5. NEVER create comprehensive lists or inventories that go beyond the provided information

✅ MANDATORY RESPONSE GUIDELINES:
1. ONLY use information EXPLICITLY present in the provided context documents
2. If asked about organizational structure, only describe what is clearly documented
3. When information is incomplete, acknowledge limitations clearly
4. Use exact quotes or close paraphrases from the source documents when possible
5. Distinguish between what is documented vs. what might need verification

📋 DOCUMENT-BASED RESPONSES:
- For leadership questions: Only mention positions and names explicitly listed in the context
- For organizational queries: Only describe structures clearly documented, don't assume standard formats
- For contact requests: Only provide information explicitly given in the documents
- For lists or inventories: Only include items specifically mentioned, acknowledge if incomplete

🔍 RESPONSE INDICATORS:
- "According to the documents provided..."
- "Based on the available information..."
- "The documents indicate..."
- "I don't have complete information about..."
- "For additional details not covered in the documents..."

CONTEXT-DRIVEN APPROACH:
- Start with what you CAN confirm from the documents
- Clearly indicate when information is limited or incomplete
- Suggest contacting the institution directly for information not in documents
- Never fill gaps with plausible-sounding but unverified information

Context Information:
${retrievalContext}

FINAL VERIFICATION: Before responding, ensure EVERY specific detail (names, positions, procedures, contacts, claims) is explicitly present in the context above. If not found in context, acknowledge the limitation and suggest appropriate next steps for the user.`;

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting RAG stream for message:', message.substring(0, 50) + '...');
          
          // Create the messages array with enhanced system message
          const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(message),
          ];
          
          // Stream the response
          const stream = await chatModel.stream(messages);
          
          let fullResponse = '';
          let chunkCount = 0;
          let hallucinationDetected = false;
          
          for await (const chunk of stream) {
            const content = chunk.content;
            if (content) {
              fullResponse += content;
              chunkCount++;
              
              // Real-time hallucination detection with context validation
              if (!hallucinationDetected && containsPotentialHallucination(fullResponse, retrievalContext)) {
                hallucinationDetected = true;
                console.warn('Potential hallucination detected in streaming response');
                
                // Send a corrective response instead
                const safeResponse = `I apologize, but I need to be careful about the accuracy of my response. Based on the information I have access to, I cannot provide specific details about that topic. For the most accurate and up-to-date information, please contact the institution directly using their official contact information.`;
                
                const correctionData = {
                  content: safeResponse,
                  done: false,
                  metadata: {
                    provider: 'rag-openai',
                    corrected: true,
                    reason: 'Potential hallucination detected - content validation failed'
                  }
                };
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(correctionData)}\n\n`)
                );
                
                const finalChunk = {
                  content: '',
                  done: true,
                  metadata: {
                    provider: 'rag-openai',
                    corrected: true,
                    chunkCount,
                    finalLength: safeResponse.length
                  }
                };
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
                );
                
                return; // Exit early
              }
              
              // Send the chunk if no hallucination detected
              const chunkData = {
                content,
                done: false,
                metadata: {
                  provider: 'rag-openai',
                  chunkNumber: chunkCount
                }
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
              );
            }
          }
          
          // Final validation of complete response
          if (!hallucinationDetected) {
            const validation = ResponseValidator.validateResponse(fullResponse, retrievalContext);
            
            if (!validation.isValid) {
              console.warn('Response failed final validation:', validation.warnings);
              
              const safeResponse = `I apologize, but I need to provide a more accurate response. Based on the available documents, I cannot provide the specific details you requested. For complete and verified information, please contact the institution directly.`;
              
              const correctionData = {
                content: safeResponse,
                done: false,
                metadata: {
                  provider: 'rag-openai',
                  corrected: true,
                  reason: 'Failed final validation',
                  warnings: validation.warnings
                }
              };
              
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(correctionData)}\n\n`)
              );
            }
          }
          
          // Send final chunk
          const finalChunk = {
            content: '',
            done: true,
            metadata: {
              provider: 'rag-openai',
              chunkCount,
              finalLength: fullResponse.length,
              hallucinationDetected
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
          );
          
          console.log('RAG response completed. Chunks sent:', chunkCount, 'Total length:', fullResponse.length);
          
        } catch (error) {
          console.error('Error in RAG stream:', error);
          
          const errorChunk = {
            content: '',
            done: true,
            error: `RAG Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              provider: 'rag-openai',
              error: true
            }
          };
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    // Return the streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('RAG API Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error in RAG endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}