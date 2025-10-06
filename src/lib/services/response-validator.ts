export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  suggestedFixes?: string[];
}

export interface ValidationOptions {
  checkUrls?: boolean;
  checkDates?: boolean;
  checkNumbers?: boolean;
  checkClaims?: boolean;
  strictMode?: boolean;
}

export class ResponseValidator {
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    checkUrls: true,
    checkDates: true,
    checkNumbers: true,
    checkClaims: true,
    strictMode: false,
  };

  static validateResponse(
    response: string, 
    context?: string, 
    options: ValidationOptions = {}
  ): ValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const warnings: string[] = [];
    const suggestedFixes: string[] = [];
    let confidence = 1.0;

    // Check for common hallucination patterns
    if (opts.checkUrls && this.containsUrls(response)) {
      warnings.push('Response contains URLs that may not exist or be accessible');
      suggestedFixes.push('Verify all URLs before sharing with users');
      confidence -= 0.3;
    }

    if (opts.checkDates && this.containsSpecificDates(response)) {
      warnings.push('Response contains specific dates that may be inaccurate');
      suggestedFixes.push('Add disclaimer about verifying current information');
      confidence -= 0.2;
    }

    if (opts.checkNumbers && this.containsSpecificNumbers(response)) {
      warnings.push('Response contains specific statistics or numbers that should be verified');
      suggestedFixes.push('Recommend users verify numerical data from authoritative sources');
      confidence -= 0.15;
    }

    if (opts.checkClaims && this.containsAbsoluteClaims(response)) {
      warnings.push('Response contains absolute claims that may not be universally true');
      suggestedFixes.push('Consider adding qualifying language like "generally" or "typically"');
      confidence -= 0.1;
    }

    // Check for overly confident language
    if (this.containsOverconfidentLanguage(response)) {
      warnings.push('Response uses overly confident language without qualification');
      suggestedFixes.push('Add uncertainty markers where appropriate');
      confidence -= 0.1;
    }

    // Check for made-up technical terms or acronyms
    if (this.containsSuspiciousTechnicalTerms(response)) {
      warnings.push('Response may contain made-up technical terms or acronyms');
      suggestedFixes.push('Verify technical terminology exists and is correctly used');
      confidence -= 0.2;
    }

    return {
      isValid: confidence > (opts.strictMode ? 0.7 : 0.5),
      confidence,
      warnings,
      suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : undefined,
    };
  }

  static addDisclaimerIfNeeded(response: string, validation: ValidationResult): string {
    if (!validation.isValid || validation.warnings.length > 0) {
      const disclaimer = '\n\n*⚠️ Note: Please verify the information provided above, especially any specific dates, numbers, or URLs mentioned.*';
      return response + disclaimer;
    }
    return response;
  }

  // Pattern detection methods
  private static containsUrls(text: string): boolean {
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    return urlPattern.test(text);
  }

  private static containsSpecificDates(text: string): boolean {
    // Matches specific dates like "January 15, 2024" or "15/01/2024"
    const datePatterns = [
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g,
      /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g,
    ];
    return datePatterns.some(pattern => pattern.test(text));
  }

  private static containsSpecificNumbers(text: string): boolean {
    // Matches percentages, currency, large numbers, or precise statistics
    const numberPatterns = [
      /\b\d+(\.\d+)?%/g,                    // Percentages
      /\$\d+(\.\d{2})?/g,                   // Currency
      /\b\d{4,}/g,                          // Large numbers (4+ digits)
      /\b\d+(\.\d+)?\s*(million|billion|trillion)/gi, // Large quantities
      /\b\d+(\.\d+)?\s*(users|customers|people|downloads)/gi, // User statistics
    ];
    return numberPatterns.some(pattern => pattern.test(text));
  }

  private static containsAbsoluteClaims(text: string): boolean {
    const absoluteWords = [
      'always', 'never', 'all', 'none', 'every', 'completely', 
      'entirely', 'absolutely', 'definitely', 'certainly', 'guaranteed',
      'impossible', 'perfect', 'best', 'worst', 'only', 'exactly'
    ];
    const pattern = new RegExp(`\\b(${absoluteWords.join('|')})\\b`, 'gi');
    return pattern.test(text);
  }

  private static containsOverconfidentLanguage(text: string): boolean {
    const overconfidentPhrases = [
      'I know for certain', 'I\'m 100% sure', 'without a doubt', 
      'it\'s a fact that', 'there\'s no question', 'undoubtedly',
      'it\'s proven that', 'studies show that', 'research confirms'
    ];
    const pattern = new RegExp(`(${overconfidentPhrases.join('|')})`, 'gi');
    return pattern.test(text);
  }

  private static containsSuspiciousTechnicalTerms(text: string): boolean {
    // Look for patterns that might indicate made-up technical terms
    const suspiciousPatterns = [
      /\b[A-Z]{3,6}\b(?!\s*(API|SDK|URL|HTTP|HTTPS|JSON|XML|HTML|CSS|SQL))/g, // Unusual acronyms
      /\b\w+Protocol\b/g,                  // Made-up protocols
      /\bv\d+\.\d+\.\d+\.\d+\b/g,         // Overly specific version numbers
    ];
    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  // Utility method to clean response content
  static sanitizeResponse(response: string): string {
    // Remove potentially hallucinated URLs
    let cleaned = response.replace(/https?:\/\/[^\s]+/g, '[URL removed for verification]');
    
    // Add uncertainty to absolute statements
    cleaned = cleaned.replace(/\b(always|never|all|none)\b/gi, (match) => {
      const replacements: { [key: string]: string } = {
        'always': 'typically',
        'never': 'rarely',
        'all': 'most',
        'none': 'few'
      };
      return replacements[match.toLowerCase()] || match;
    });

    return cleaned;
  }
}