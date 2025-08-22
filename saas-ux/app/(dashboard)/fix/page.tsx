'use client'

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  Code, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Copy,
  ExternalLink,
  Zap,
  FileText,
  Settings
} from 'lucide-react';

const FixImplementationSystem = ({ fixes, onApplyFix }) => {
  const [selectedFixes, setSelectedFixes] = useState(new Set());
  const [implementingFixes, setImplementingFixes] = useState(false);
  const [implementationProgress, setImplementationProgress] = useState(0);
  const [appliedFixes, setAppliedFixes] = useState(new Set());

  const toggleFixSelection = (fixId) => {
    const newSelected = new Set(selectedFixes);
    if (newSelected.has(fixId)) {
      newSelected.delete(fixId);
    } else {
      newSelected.add(fixId);
    }
    setSelectedFixes(newSelected);
  };

  const selectAllFixes = () => {
    setSelectedFixes(new Set(fixes.map(fix => fix.id)));
  };

  const clearSelection = () => {
    setSelectedFixes(new Set());
  };

  const applySelectedFixes = async () => {
    if (selectedFixes.size === 0) return;

    setImplementingFixes(true);
    setImplementationProgress(0);

    const fixesToApply = fixes.filter(fix => selectedFixes.has(fix.id));
    const progressStep = 100 / fixesToApply.length;

    for (let i = 0; i < fixesToApply.length; i++) {
      const fix = fixesToApply[i];
      
      try {
        // Simulate applying fix
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Call the fix implementation
        if (onApplyFix) {
          await onApplyFix(fix);
        }
        
        setAppliedFixes(prev => new Set([...prev, fix.id]));
        setImplementationProgress((i + 1) * progressStep);
        
      } catch (error) {
        console.error(`Failed to apply fix ${fix.id}:`, error);
      }
    }

    setImplementingFixes(false);
    setSelectedFixes(new Set());
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadFix = (fix) => {
    const content = `# ${fix.title}\n\n${fix.description}\n\n## Implementation\n\n\`\`\`${getLanguageFromCode(fix.code)}\n${fix.code}\n\`\`\`\n\n## Estimated Time: ${fix.estimated_time}\n## Impact Score: ${fix.impact_score}/100`;
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fix-${fix.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLanguageFromCode = (code) => {
    if (code.includes('<')) return 'html';
    if (code.includes('import') || code.includes('function')) return 'javascript';
    if (code.includes('Content-Security-Policy')) return 'http';
    return 'text';
  };

  const getImplementationIcon = (type) => {
    switch (type) {
      case 'automatic': return <Zap className="h-4 w-4" />;
      case 'plugin': return <Settings className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getImplementationColor = (type) => {
    switch (type) {
      case 'automatic': return 'bg-green-100 text-green-800';
      case 'plugin': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getImpactColor = (score) => {
    if (score >= 80) return 'bg-red-100 text-red-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const prioritizedFixes = [...fixes].sort((a, b) => b.impact_score - a.impact_score);

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Implementation Center</h2>
          <p className="text-gray-600">Apply fixes to optimize your website</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearSelection} disabled={selectedFixes.size === 0}>
            Clear Selection
          </Button>
          <Button variant="outline" onClick={selectAllFixes}>
            Select All ({fixes.length})
          </Button>
          <Button 
            onClick={applySelectedFixes} 
            disabled={selectedFixes.size === 0 || implementingFixes}
            className="min-w-[140px]"
          >
            {implementingFixes ? (
              <>
                <Settings className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Apply {selectedFixes.size} Fix{selectedFixes.size !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {implementingFixes && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Implementing fixes...</span>
                <span>{Math.round(implementationProgress)}%</span>
              </div>
              <Progress value={implementationProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{fixes.length}</div>
            <div className="text-sm text-gray-600">Total Fixes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{appliedFixes.size}</div>
            <div className="text-sm text-gray-600">Applied</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{selectedFixes.size}</div>
            <div className="text-sm text-gray-600">Selected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(fixes.reduce((sum, fix) => sum + fix.impact_score, 0) / fixes.length)}
            </div>
            <div className="text-sm text-gray-600">Avg Impact</div>
          </CardContent>
        </Card>
      </div>

      {/* Fixes List */}
      <Tabs defaultValue="priority" className="space-y-4">
        <TabsList>
          <TabsTrigger value="priority">By Priority</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="implementation">By Type</TabsTrigger>
        </TabsList>

        <TabsContent value="priority" className="space-y-4">
          {prioritizedFixes.map((fix) => (
            <FixCard 
              key={fix.id}
              fix={fix}
              isSelected={selectedFixes.has(fix.id)}
              isApplied={appliedFixes.has(fix.id)}
              onToggleSelect={() => toggleFixSelection(fix.id)}
              onCopy={copyToClipboard}
              onDownload={downloadFix}
              getImplementationIcon={getImplementationIcon}
              getImplementationColor={getImplementationColor}
              getImpactColor={getImpactColor}
            />
          ))}
        </TabsContent>

        <TabsContent value="category" className="space-y-4">
          {/* Group fixes by category */}
          {Object.entries(
            fixes.reduce((groups, fix) => {
              const category = fix.category || 'Other';
              if (!groups[category]) groups[category] = [];
              groups[category].push(fix);
              return groups;
            }, {})
          ).map(([category, categoryFixes]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 capitalize">{category.replace('_', ' ')}</h3>
              <div className="space-y-3">
                {categoryFixes.map((fix) => (
                  <FixCard 
                    key={fix.id}
                    fix={fix}
                    isSelected={selectedFixes.has(fix.id)}
                    isApplied={appliedFixes.has(fix.id)}
                    onToggleSelect={() => toggleFixSelection(fix.id)}
                    onCopy={copyToClipboard}
                    onDownload={downloadFix}
                    getImplementationIcon={getImplementationIcon}
                    getImplementationColor={getImplementationColor}
                    getImpactColor={getImpactColor}
                  />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="implementation" className="space-y-4">
          {['automatic', 'plugin', 'manual'].map(type => {
            const typeFixes = fixes.filter(fix => fix.implementation === type);
            if (typeFixes.length === 0) return null;
            
            return (
              <div key={type}>
                <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
                  {getImplementationIcon(type)}
                  {type} Implementation ({typeFixes.length})
                </h3>
                <div className="space-y-3">
                  {typeFixes.map((fix) => (
                    <FixCard 
                      key={fix.id}
                      fix={fix}
                      isSelected={selectedFixes.has(fix.id)}
                      isApplied={appliedFixes.has(fix.id)}
                      onToggleSelect={() => toggleFixSelection(fix.id)}
                      onCopy={copyToClipboard}
                      onDownload={downloadFix}
                      getImplementationIcon={getImplementationIcon}
                      getImplementationColor={getImplementationColor}
                      getImpactColor={getImpactColor}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const FixCard = ({ 
  fix, 
  isSelected, 
  isApplied, 
  onToggleSelect, 
  onCopy, 
  onDownload,
  getImplementationIcon,
  getImplementationColor,
  getImpactColor
}) => {
  const [showCode, setShowCode] = useState(false);

  return (
    <Card className={`transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isApplied ? 'bg-green-50 border-green-200' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              disabled={isApplied}
              className="mt-1"
            />
            <div className="flex-1">
              <CardTitle className="text-lg">{fix.title}</CardTitle>
              <CardDescription className="mt-1">{fix.description}</CardDescription>
              
              <div className="flex items-center gap-2 mt-3">
                <Badge className={getImplementationColor(fix.implementation)}>
                  {getImplementationIcon(fix.implementation)}
                  <span className="ml-1 capitalize">{fix.implementation}</span>
                </Badge>
                
                <Badge className={getImpactColor(fix.impact_score)}>
                  Impact: {fix.impact_score}/100
                </Badge>
                
                <Badge variant="outline">
                  {fix.estimated_time}
                </Badge>
                
                {isApplied && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Applied
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCode(!showCode)}
            >
              <Code className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopy(fix.code)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(fix)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {showCode && (
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm font-medium">Implementation Code:</div>
            <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
                <code>{fix.code}</code>
              </pre>
            </div>
            
            {fix.implementation === 'manual' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This fix requires manual implementation. Follow the code above and apply it to your website files.
                </AlertDescription>
              </Alert>
            )}
            
            {fix.implementation === 'automatic' && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  This fix can be applied automatically. Click "Apply" to implement it directly.
                </AlertDescription>
              </Alert>
            )}
            
            {fix.implementation === 'plugin' && (
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  This fix will be applied via WordPress plugin integration.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// Example usage with mock data
const mockFixes = [
  {
    id: 'fix_seo_001',
    issue_id: 'seo_001',
    title: 'Add Meta Description',
    description: 'Add a compelling meta description to improve search engine visibility.',
    code: '<meta name="description" content="Your optimized meta description here - keep it between 150-160 characters for best results.">',
    implementation: 'manual',
    estimated_time: '2 minutes',
    impact_score: 85,
    category: 'meta_tags'
  },
  {
    id: 'fix_perf_001',
    issue_id: 'perf_001',
    title: 'Optimize Images',
    description: 'Compress images and convert to WebP format for faster loading.',
    code: `// Next.js Image Optimization
import Image from 'next/image';

<Image 
  src="/your-image.jpg" 
  width={800} 
  height={600} 
  alt="Descriptive alt text"
  priority={true} // for above-fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>`,
    implementation: 'automatic',
    estimated_time: '1 minute',
    impact_score: 75,
    category: 'images'
  },
  {
    id: 'fix_a11y_001',
    issue_id: 'a11y_001',
    title: 'Add Alt Text to Images',
    description: 'Add descriptive alt text to all images for screen reader accessibility.',
    code: '<img src="image.jpg" alt="Specific description of what the image shows or its purpose in context">',
    implementation: 'manual',
    estimated_time: '5 minutes',
    impact_score: 90,
    category: 'accessibility'
  },
  {
    id: 'fix_sec_001',
    issue_id: 'sec_001',
    title: 'Add Content Security Policy',
    description: 'Implement CSP header to prevent XSS attacks and improve security.',
    code: `// In next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;`,
    implementation: 'plugin',
    estimated_time: '10 minutes',
    impact_score: 80,
    category: 'security'
  }
];

export default function FixImplementationDemo() {
  const handleApplyFix = async (fix) => {
    console.log('Applying fix:', fix);
    // Implementation logic would go here
    return new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <div className="p-6">
      <FixImplementationSystem 
        fixes={mockFixes} 
        onApplyFix={handleApplyFix}
      />
    </div>
  );
}