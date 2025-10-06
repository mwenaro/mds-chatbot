export interface OrganizationalStructure {
  leadership: Array<{
    title: string;
    name: string;
    level: number; // 1 = top level (directors), 2 = middle (principal), 3 = sectional heads
  }>;
  contactInfo: {
    phones: string[];
    emails: string[];
    address: string;
  };
  hasDepartmentHeads: boolean;
  alternativeStructure?: string; // e.g., "sectional heads", "coordinators"
}

export class DocumentAnalyzer {
  /**
   * Dynamically analyze document content to extract organizational structure
   */
  static analyzeOrganizationalStructure(documentContent: string): OrganizationalStructure {
    const content = documentContent.toLowerCase();
    
    // Extract leadership information dynamically
    const leadership: Array<{title: string; name: string; level: number}> = [];
    
    // Look for directors pattern
    const directorMatches = documentContent.match(/directors?:\s*([^\\n]+)/gi);
    if (directorMatches) {
      directorMatches.forEach(match => {
        const names = match.replace(/directors?:\s*/gi, '').split(/&|and|,/);
        names.forEach(name => {
          const cleanName = name.trim();
          if (cleanName && cleanName.length > 3) {
            leadership.push({
              title: 'Director',
              name: cleanName,
              level: 1
            });
          }
        });
      });
    }
    
    // Look for principal pattern
    const principalMatches = documentContent.match(/principal:\s*([^\\n]+)/gi);
    if (principalMatches) {
      principalMatches.forEach(match => {
        const name = match.replace(/principal:\s*/gi, '').trim();
        if (name && name.length > 3) {
          leadership.push({
            title: 'Principal',
            name: name,
            level: 2
          });
        }
      });
    }
    
    // Look for sectional heads pattern
    const sectionalMatches = documentContent.match(/([^\\n]*section[^\\n]*–[^\\n]+)/gi);
    if (sectionalMatches) {
      sectionalMatches.forEach(match => {
        const parts = match.split('–');
        if (parts.length >= 2) {
          const sectionName = parts[0].trim();
          const personName = parts[1].trim();
          leadership.push({
            title: `Head of ${sectionName}`,
            name: personName,
            level: 3
          });
        }
      });
    }
    
    // Check for department heads (should be false for Abu Rayyan)
    const hasDepartmentHeads = this.checkForDepartmentHeads(content);
    
    // Extract contact information dynamically
    const contactInfo = this.extractContactInfo(documentContent);
    
    // Determine alternative structure
    const alternativeStructure = this.determineAlternativeStructure(content);
    
    return {
      leadership,
      contactInfo,
      hasDepartmentHeads,
      alternativeStructure
    };
  }
  
  /**
   * Check if document mentions department heads
   */
  private static checkForDepartmentHeads(content: string): boolean {
    const departmentHeadPatterns = [
      /head of.*department/i,
      /department head/i,
      /heads of departments/i,
      /department heads/i
    ];
    
    return departmentHeadPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Extract contact information from document
   */
  private static extractContactInfo(content: string): {phones: string[]; emails: string[]; address: string} {
    // Extract phone numbers
    const phonePattern = /(?:\\+254|0)\\d{9}/g;
    const phones = content.match(phonePattern) || [];
    
    // Extract email addresses
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
    const emails = content.match(emailPattern) || [];
    
    // Extract address (look for location pattern)
    const addressPatterns = [
      /location[^\\n]*:([^\\n]+)/i,
      /address[^\\n]*:([^\\n]+)/i,
      /along ([^\\n]+)/i
    ];
    
    let address = '';
    for (const pattern of addressPatterns) {
      const match = content.match(pattern);
      if (match) {
        address = match[1]?.trim() || match[0]?.trim() || '';
        break;
      }
    }
    
    return { phones, emails, address };
  }
  
  /**
   * Determine what alternative organizational structure exists
   */
  private static determineAlternativeStructure(content: string): string {
    if (content.includes('sectional heads')) return 'sectional heads';
    if (content.includes('coordinators')) return 'coordinators';
    if (content.includes('supervisors')) return 'supervisors';
    if (content.includes('managers')) return 'managers';
    return 'administrative structure';
  }
  
  /**
   * Generate dynamic response about organizational structure
   */
  static generateOrganizationalResponse(structure: OrganizationalStructure, query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('department head') || queryLower.includes('heads of departments')) {
      if (!structure.hasDepartmentHeads) {
        return `Based on the organizational information available, this institution does not have designated heads of departments. Instead, the organization operates with ${structure.alternativeStructure || 'an alternative administrative structure'}.
        
For specific information about staff responsibilities and organizational details, please contact the institution directly using the provided contact information.`;
      }
    }
    
    if (queryLower.includes('who is') || queryLower.includes('leadership') || queryLower.includes('administration')) {
      if (structure.leadership.length > 0) {
        const leadershipByLevel = structure.leadership.reduce((acc, leader) => {
          if (!acc[leader.level]) acc[leader.level] = [];
          acc[leader.level].push(leader);
          return acc;
        }, {} as Record<number, typeof structure.leadership>);
        
        let response = 'Based on the available information, the leadership structure includes:\\n\\n';
        
        Object.keys(leadershipByLevel).sort().forEach(level => {
          const leaders = leadershipByLevel[Number(level)];
          leaders.forEach(leader => {
            response += `- ${leader.title}: ${leader.name}\\n`;
          });
        });
        
        return response;
      }
    }
    
    return "I don't have specific organizational information in the available documents. Please contact the institution directly for current organizational details.";
  }
  
  /**
   * Get contact information response
   */
  static getContactResponse(structure: OrganizationalStructure): string {
    const { phones, emails, address } = structure.contactInfo;
    
    let contactResponse = '';
    
    if (phones.length > 0) {
      contactResponse += `📞 Phone: ${phones.join(' / ')}\\n`;
    }
    
    if (emails.length > 0) {
      contactResponse += `📧 Email: ${emails.join(', ')}\\n`;
    }
    
    if (address) {
      contactResponse += `📍 Location: ${address}\\n`;
    }
    
    return contactResponse || 'Contact information not available in the provided documents.';
  }
}