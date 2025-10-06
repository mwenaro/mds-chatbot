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
  // Comprehensive hallucination detection patterns
  const hallucinationPatterns = [
    // Staff/Personnel fabrication - ENHANCED for specific format
    /we have the following (heads of departments|department heads|staff members|teachers|faculty)/i,
    /here are the (heads of departments|department heads|staff members|teachers|faculty)/i,
    /following.*heads of departments/i,
    /\b(Mr\.|Mrs\.|Ms\.|Sheikh|Imam|Dr\.|Professor)\s+[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/,
    
    // Department structure fabrication - SPECIFIC PATTERNS
    /(Academic|Islamic|Tahfidh|ICT|Student Affairs|Administration|Mathematics|Science|English|History|Geography|Chemistry|Physics|Biology|Kiswahili|Arabic|French|Computer|Sports|Music|Art|Guidance|Counselling).*Department:\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam|Dr\.)/i,
    /Department:\s+(Mr\.|Mrs\.|Ms\.|Sheikh|Madam|Dr\.)/i,
    /these department heads/i,
    /department heads oversee/i,
    /respective areas and work/i,
    
    // Organizational structure fabrication
    /heads of departments.*:\s*\n/i,
    /department heads include/i,
    /following are.*heads/i,
    /head of.*department/i,
    /current heads.*are/i,
    /department.*led by/i,
    
    // Contact information fabrication
    /email:\s*[a-zA-Z0-9._%+-]+@(?!aburayyanacademy\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    /phone.*:?\s*(?!0722299287|0723755108)\+?[\d\s\-()]{7,}/,
    /website.*:?\s*(?!.*aburayyanacademy)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    
    // Fee/Cost fabrication (not matching known fees)
    /(?:fee|cost|tuition).*(?:ksh\.?\s*(?!13000|15500|17000|18500|24500|35000|2000|5000|250|2500|3000|7000|10000)\d+)/i,
    
    // Program/Course fabrication
    /(?:we offer|programs include|courses available).*(?!CBE|Islamic Integrated|Tahfidh|ICT Program|Tuition Program)/i,
    
    // Facility fabrication
    /facilities include.*(?!spacious classrooms|assembly hall|multi-purpose hall|ICT lab|science lab|school canteen)/i,
    
    // Location/Address fabrication
    /located at.*(?!Ronald Ngala Road|opposite Petro Gas Station|Mombasa)/i,
    
    // General list fabrication indicators
    /here is a (?:complete )?list of/i,
    /the following (?:are|is) (?:a )?(?:complete )?(?:list|listing)/i,
    /(?:complete|full|detailed) (?:list|listing|breakdown) of/i,
    
    // Specific detail fabrication
    /established in.*(?!January 2017)/i,
    /founded in.*(?!January 2017)/i,
    /motto.*(?!Learners Today.*Leaders Tomorrow)/i,
    
    // Generic confidence indicators that may mask uncertainty
    /(?:our records show|according to our database|as per our information)(?! from our records)/i,
  ];
  
  // Check for patterns
  const hasPattern = hallucinationPatterns.some(pattern => pattern.test(text));
  
  // Additional specific check for the exact problematic format
  const problematicFormat = /Department:\s+[A-Z]/i.test(text) && 
                           /Mr\.|Ms\.|Mrs\.|Sheikh|Dr\./.test(text) &&
                           /department heads oversee|respective areas/i.test(text);
  
  // Context-based validation: check if mentioned names/details exist in context
  if (context) {
    const contextValidation = validateAgainstContext(text, context);
    return hasPattern || problematicFormat || !contextValidation.isValid;
  }
  
  return hasPattern || problematicFormat;
}

function validateAgainstContext(text: string, context: string): {isValid: boolean, issues: string[]} {
  const issues: string[] = [];
  
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
  
  // Extract phone numbers
  const phonePattern = /(?:\+254|0)\d{9}/g;
  const phonesInResponse = text.match(phonePattern) || [];
  
  for (const phone of phonesInResponse) {
    if (!context.toLowerCase().includes(phone)) {
      issues.push(`Phone number "${phone}" not found in source documents`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { message, useAntiHallucination = true } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('RAG Query:', message.substring(0, 100) + '...');

    // Pre-process query to detect high-risk questions
    const isHighRisk = isHighRiskQuery(message);
    const isOrgQuery = isOrganizationalQuery(message);
    
    // Initialize the vector store if not already done
    if (!ragVectorStore.isReady()) {
      console.log('Initializing RAG vector store...');
      await ragVectorStore.initialize();
    }

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
    const systemPrompt = `${baseRAGPrompt}

You are an official AI assistant representing Abu Rayyan Academy. You are part of the academy's administration and speak with full authority about the institution.

🚨 CRITICAL: ABU RAYYAN ACADEMY DOES NOT HAVE "HEADS OF DEPARTMENTS" OR "DEPARTMENT HEADS"

COMPREHENSIVE ANTI-HALLUCINATION PROTOCOL:

🚫 ABSOLUTE PROHIBITIONS - NEVER DO THESE:

EXAMPLE OF WHAT YOU MUST NEVER SAY:
❌ "We have the following Heads of Departments at Abu Rayyan Academy:
   Academic Department: Mr. [Any Name]
   Islamic Department: Mr. [Any Name]
   Tahfidh Department: Mr. [Any Name]
   ICT Department: Mr. [Any Name]
   Student Affairs Department: Ms. [Any Name]
   Administration Department: Mr. [Any Name]"

❌ NEVER use the format "Department: Mr./Ms./Mrs. [Name]"
❌ NEVER create lists of department heads
❌ NEVER invent names like "Mr. Abdifatah Hussein", "Mr. Yusuf Abdi", "Mr. Hassan Mohamed", etc.
❌ NEVER say "These department heads oversee their respective areas"

🔍 WHAT THE DOCUMENTS ACTUALLY CONTAIN:
The school has ONLY:
- Directors: Dr. Abdirazack Yussuf Abdinur & Madam Salatha Mohammed
- Principal: Mr. Duke Okioga
- Sectional Heads (NOT department heads):
  * Junior & Senior School Section – Mr. Duke Okioga
  * Upper Primary School Section – Mr. Wekesa  
  * Pre-Primary & Lower Primary School Section – Madam Celestine

✅ CORRECT RESPONSES FOR DEPARTMENT HEAD QUERIES:
- "Abu Rayyan Academy does not have designated heads of departments. The school has sectional heads for different grade levels."
- "I don't have information about department heads because the school doesn't operate with that structure."
- "For information about staff assignments and academic oversight, please contact the academy directly."

🛡️ MANDATORY CHECKS BEFORE RESPONDING:
1. Does my response mention "Department: Mr./Ms./Mrs."? → If YES, STOP and give safe response
2. Am I listing department heads? → If YES, STOP and give safe response  
3. Am I inventing any names not in the context? → If YES, STOP and give safe response
4. Does the context actually support what I'm saying? → If NO, STOP and give safe response

� CONTEXT VALIDATION RULES:
- ONLY use information EXPLICITLY present in the provided context documents
- If information is not in the context, you MUST say "I don't have that specific information"
- When uncertain, ALWAYS recommend contacting the academy directly
- Never make assumptions about organizational structure

Abu Rayyan Academy Context Information:
${retrievalContext}

🎯 FINAL VERIFICATION PROTOCOL:
Before sending ANY response about staff or organization:
1. Check: Does my response create a list of department heads? → If YES, replace with safe response
2. Check: Does my response mention names not in the context above? → If YES, replace with safe response
3. Check: Am I using the format "Department: Person"? → If YES, replace with safe response

SAFE RESPONSE TEMPLATE FOR DEPARTMENT HEAD QUERIES:
"Abu Rayyan Academy does not have designated heads of departments. The school has sectional heads for different grade levels and the principal oversees academic matters. For specific information about staff responsibilities, please contact Abu Rayyan Academy directly at 0722299287 / 0723755108 or info@aburayyanacademy.com."`;

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
                const safeResponse = `I apologize, but I need to be careful about the accuracy of my response. Based on the information I have access to, I cannot provide specific details about that topic. For the most accurate and up-to-date information about Abu Rayyan Academy, please contact them directly at:

📞 Phone: 0722299287 / 0723755108
📧 Email: info@aburayyanacademy.com
📍 Location: Along Ronald Ngala Road, opposite Petro Gas Station, Mombasa

They will be able to provide you with verified information.`;
                
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
                
                // Skip sending the actual AI content and break
                break;
              }
              
              // Send each chunk to the client only if no hallucination detected
              if (!hallucinationDetected) {
                const chunkData = {
                  content,
                  done: false,
                  metadata: {
                    provider: 'rag-openai',
                    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                    hasContext: retrievalContext.length > 100,
                    chunkCount
                  }
                };
                
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`)
                );
              }
            }
          }
          
          // Validate the complete response for hallucinations and calculate confidence
          const validation = ResponseValidator.validateRAGResponse(fullResponse, retrievalContext);
          const contextValidation = validateAgainstContext(fullResponse, retrievalContext);
          
          // Calculate overall confidence score
          let confidenceScore = validation.confidence;
          if (!contextValidation.isValid) {
            confidenceScore = Math.min(confidenceScore, 0.3); // Heavily penalize context mismatches
          }
          
          // Additional confidence adjustments
          if (containsPotentialHallucination(fullResponse, retrievalContext)) {
            confidenceScore = Math.min(confidenceScore, 0.2); // Very low confidence for potential hallucinations
          }
          
          if (!validation.isValid || !contextValidation.isValid) {
            console.warn('RAG response validation issues:', {
              validationWarnings: validation.warnings,
              contextIssues: contextValidation.issues,
              finalConfidence: confidenceScore
            });
            
            // Send validation warning as a separate chunk
            const warningMessage = contextValidation.issues.length > 0 
              ? `\n\n⚠️ **Accuracy Notice**: Some information in the response above could not be verified against our source documents. For the most reliable information, please contact Abu Rayyan Academy directly.`
              : `\n\n⚠️ **Verification Notice**: Please verify specific details with Abu Rayyan Academy directly for the most current information.`;
            
            const validationData = {
              content: warningMessage,
              done: false,
              metadata: {
                provider: 'rag-openai',
                validation: {
                  confidence: confidenceScore,
                  warnings: validation.warnings,
                  contextIssues: contextValidation.issues,
                  requiresVerification: true
                }
              }
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(validationData)}\n\n`)
            );
          }
          
          // Send final chunk with completion metadata
          const finalChunk = {
            content: '',
            done: true,
            metadata: {
              provider: 'rag-openai',
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              totalChunks: chunkCount,
              responseLength: fullResponse.length,
              contextUsed: retrievalContext.length > 100,
              contextLength: retrievalContext.length,
              confidenceScore: confidenceScore,
              riskAssessment: {
                isHighRisk: isHighRisk,
                isOrganizational: isOrgQuery,
                hallucinationDetected: hallucinationDetected
              },
              validation: (!validation.isValid || !contextValidation.isValid) ? {
                confidence: confidenceScore,
                warnings: validation.warnings,
                contextIssues: contextValidation.issues
              } : undefined
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