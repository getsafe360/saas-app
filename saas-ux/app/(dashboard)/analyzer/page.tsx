'use client'

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Globe, 
  Zap, 
  Shield, 
  Eye, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Download,
  Play
} from 'lucide-react';

const WebsiteAnalyzer = () => {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [selectedModules, setSelectedModules] = useState([
    'seo', 'performance', 'accessibility', 'security'
  ]);

  const modules = [
    { id: 'seo', name: 'SEO', icon: Search, color: 'bg-blue-500', description: 'SEO' },
    { id: 'performance', name: 'Performance', icon: Zap, color: 'bg-green-500', description: 'Speed & Core Web Vitals' },
    { id: 'accessibility', name: 'Accessibility', icon: Eye, color: 'bg-purple-500', description: 'Accessibility' },
    { id: 'security', name: 'Security', icon: Shield, color: 'bg-red-500', description: 'Security' }
  ];

  const toggleModule = (moduleId) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const analyzeWebsite = async () => {
    if (!url || selectedModules.length === 0) return;
    
    setAnalyzing(true);
    setProgress(0);
    setResults(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 800);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          selected_modules: selectedModules
        })
      });

      const data = await response.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      setResults(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
        setProgress(0);
      }, 1000);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Website Optimizer
        </h1>
      </div>

      {/* URL Input & Module Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website Analysis
          </CardTitle>
          <CardDescription>
            Enter your website URL and select analysis modules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              placeholder="https://your-website.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={analyzeWebsite}
              disabled={!url || selectedModules.length === 0 || analyzing}
              className="min-w-[120px]"
            >
              {analyzing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>

          {/* Module Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Analysis Modules</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {modules.map(module => {
                const Icon = module.icon;
                const isSelected = selectedModules.includes(module.id);
                
                return (
                  <div
                    key={module.id}
                    onClick={() => toggleModule(module.id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-[1px] border-blue-900/70 bg-gray-200 dark:bg-gray-900/70 rounded p-2' 
                        : 'border-[1px] border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1 rounded ${module.color}`}>
                        <Icon className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium">{module.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">{module.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Bar */}
          {analyzing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Analyzing website...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {modules.filter(m => selectedModules.includes(m.id)).map(module => {
              const Icon = module.icon;
              const score = Math.floor(Math.random() * 40) + 60; // Mock score
              
              return (
                <Card key={module.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded ${module.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <Badge className={getScoreBadgeColor(score)}>
                        {score}/100
                      </Badge>
                    </div>
                    <h3 className="font-semibold">{module.name}</h3>
                    <p className="text-sm text-gray-500">{module.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Results */}
          <Tabs defaultValue={selectedModules[0]} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              {modules.filter(m => selectedModules.includes(m.id)).map(module => (
                <TabsTrigger key={module.id} value={module.id}>
                  {module.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {selectedModules.map(moduleId => {
              const module = modules.find(m => m.id === moduleId);
              const mockIssues = [
                { type: 'error', title: 'Missing meta description', impact: 'High', fix: 'Add meta description tag' },
                { type: 'warning', title: 'Large image files', impact: 'Medium', fix: 'Compress images' },
                { type: 'info', title: 'Missing alt text', impact: 'Low', fix: 'Add alt attributes' }
              ];

              return (
                <TabsContent key={moduleId} value={moduleId} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <module.icon className="h-5 w-5" />
                        {module.name} Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {mockIssues.map((issue, idx) => (
                        <Alert key={idx}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {issue.type === 'error' ? (
                                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                              ) : issue.type === 'warning' ? (
                                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                              ) : (
                                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                              )}
                              <div>
                                <h4 className="font-medium">{issue.title}</h4>
                                <AlertDescription className="mt-1">
                                  {issue.fix}
                                </AlertDescription>
                                <Badge variant="outline" className="mt-2">
                                  {issue.impact} Impact
                                </Badge>
                              </div>
                            </div>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-2" />
                              Get Fix
                            </Button>
                          </div>
                        </Alert>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              Apply All Fixes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebsiteAnalyzer;