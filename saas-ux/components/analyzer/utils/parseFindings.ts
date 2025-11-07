// components/analyzer/utils/parseFindings.ts
import type { Finding, Pillar, Severity } from '../types';

export type { Finding }; // Re-export

export function parseFindings(markdown: string): Finding[] {
  const findings: Finding[] = [];
  const lines = markdown.split('\n');
  
  let currentFinding: Partial<Finding> | null = null;
  
  for (const line of lines) {
    // Example parsing logic - adjust to your actual markdown format
    
    // Detect pillar headers like "## SEO"
    if (line.startsWith('## ')) {
      const pillarName = line.slice(3).trim().toLowerCase();
      if (['seo', 'a11y', 'perf', 'sec'].includes(pillarName)) {
        // Store current pillar context
      }
    }
    
    // Detect findings like "### ⚠️ Missing meta description"
    if (line.startsWith('### ')) {
      if (currentFinding && currentFinding.pillar && currentFinding.title) {
        findings.push(currentFinding as Finding);
      }
      
      const match = line.match(/^### ([⚠️🔴✅])\s+(.+)$/);
      if (match) {
        const [, icon, title] = match;
        const severity: Severity = 
          icon === '🔴' ? 'critical' : 
          icon === '⚠️' ? 'medium' : 
          'minor';
        
        currentFinding = {
          pillar: 'seo', // Get from context
          severity,
          title: title.trim(),
          description: '',
        };
      }
    }
    
    // Collect description
    if (currentFinding && line && !line.startsWith('#')) {
      currentFinding.description = (currentFinding.description || '') + line + '\n';
    }
  }
  
  // Push last finding
  if (currentFinding && currentFinding.pillar && currentFinding.title) {
    findings.push(currentFinding as Finding);
  }
  
  return findings;
}
