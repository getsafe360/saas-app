# latest_ai_development/src/latest_ai_development/enhanced_crew.py
import os
import json
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from crewai import Agent, Task, Crew, Process
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

class URLAnalysisTool(BaseTool):
    """Tool for fetching and analyzing website content"""
    name: str = "URL Analysis Tool"
    description: str = "Fetches website content and extracts basic information for analysis"

    def _run(self, url: str) -> str:
        try:
            # Basic URL validation
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return f"Invalid URL format: {url}"
            
            # Fetch page content (basic implementation)
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Extract basic info
            content_length = len(response.content)
            status_code = response.status_code
            content_type = response.headers.get('content-type', 'unknown')
            
            # Simple HTML analysis
            html = response.text.lower()
            has_title = '<title>' in html
            has_meta_desc = 'name="description"' in html
            has_h1 = '<h1' in html
            img_count = html.count('<img')
            
            return json.dumps({
                'url': url,
                'status_code': status_code,
                'content_length': content_length,
                'content_type': content_type,
                'has_title': has_title,
                'has_meta_description': has_meta_desc,
                'has_h1': has_h1,
                'image_count': img_count,
                'analysis_timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            return f"Error analyzing URL {url}: {str(e)}"

class EnhancedWebsiteAnalyzerCrew:
    """Enhanced website analyzer using CrewAI with structured output"""
    
    def __init__(self):
        self.url_tool = URLAnalysisTool()
        
    def create_seo_agent(self) -> Agent:
        return Agent(
            role="SEO Specialist",
            goal="Analyze website SEO performance and provide actionable recommendations",
            backstory="""You are an expert SEO consultant with 10+ years of experience. 
            You specialize in technical SEO, on-page optimization, and SERP analysis. 
            You provide clear, prioritized recommendations with measurable impact.""",
            tools=[self.url_tool],
            verbose=True,
            allow_delegation=False
        )
    
    def create_performance_agent(self) -> Agent:
        return Agent(
            role="Web Performance Engineer",
            goal="Evaluate website speed and Core Web Vitals performance",
            backstory="""You are a performance optimization expert who has improved 
            load times for hundreds of websites. You focus on practical, high-impact 
            optimizations and understand modern web performance metrics.""",
            tools=[self.url_tool],
            verbose=True,
            allow_delegation=False
        )
    
    def create_accessibility_agent(self) -> Agent:
        return Agent(
            role="Accessibility Consultant",
            goal="Audit website accessibility and WCAG compliance",
            backstory="""You are a certified accessibility expert with deep knowledge 
            of WCAG 2.1 guidelines, assistive technologies, and inclusive design. 
            You help make websites accessible to all users.""",
            tools=[self.url_tool],
            verbose=True,
            allow_delegation=False
        )
    
    def create_security_agent(self) -> Agent:
        return Agent(
            role="Security Auditor",
            goal="Identify security vulnerabilities and recommend fixes",
            backstory="""You are a cybersecurity specialist focused on web application 
            security. You quickly identify common vulnerabilities and provide 
            practical security recommendations.""",
            tools=[self.url_tool],
            verbose=True,
            allow_delegation=False
        )
    
    def create_content_agent(self) -> Agent:
        return Agent(
            role="Content Strategist",
            goal="Analyze content quality, readability, and SEO optimization",
            backstory="""You are a content marketing expert who understands both 
            user engagement and search engine optimization. You provide actionable 
            content improvement recommendations.""",
            tools=[self.url_tool],
            verbose=True,
            allow_delegation=False
        )

    def create_seo_task(self, url: str, agent: Agent) -> Task:
        return Task(
            description=f"""Analyze the SEO performance of {url}. Focus on:
            
            1. Technical SEO (meta tags, headings, URLs, sitemap)
            2. On-page optimization (content, keywords, internal linking)
            3. Page structure and semantic HTML
            4. Mobile-friendliness indicators
            
            Provide your analysis in this JSON format:
            {{
                "score": [0-100],
                "issues": [
                    {{
                        "id": "unique_id",
                        "type": "error|warning|info",
                        "title": "Issue title",
                        "description": "Detailed description",
                        "impact": "high|medium|low",
                        "category": "meta_tags|headings|content|technical"
                    }}
                ],
                "fixes": [
                    {{
                        "id": "fix_id",
                        "issue_id": "corresponding_issue_id",
                        "title": "Fix title",
                        "description": "How to implement",
                        "code": "Code snippet if applicable",
                        "implementation": "manual|automatic|plugin",
                        "estimated_time": "Time estimate",
                        "impact_score": [0-100]
                    }}
                ]
            }}""",
            expected_output="JSON formatted SEO analysis with score, issues, and fixes",
            agent=agent
        )
    
    def create_performance_task(self, url: str, agent: Agent) -> Task:
        return Task(
            description=f"""Analyze the performance of {url}. Evaluate:
            
            1. Page load speed indicators
            2. Resource optimization (images, CSS, JS)
            3. Core Web Vitals factors
            4. Caching and compression opportunities
            
            Return analysis in the same JSON format as SEO task with performance-specific categories.""",
            expected_output="JSON formatted performance analysis",
            agent=agent
        )
    
    def create_accessibility_task(self, url: str, agent: Agent) -> Task:
        return Task(
            description=f"""Audit accessibility of {url} according to WCAG 2.1 guidelines:
            
            1. Image alt text and ARIA labels
            2. Color contrast and visual design
            3. Keyboard navigation support
            4. Form accessibility
            5. Semantic HTML structure
            
            Return analysis in the same JSON format with accessibility-specific categories.""",
            expected_output="JSON formatted accessibility analysis",
            agent=agent
        )
    
    def create_security_task(self, url: str, agent: Agent) -> Task:
        return Task(
            description=f"""Perform security audit of {url}:
            
            1. SSL/TLS configuration
            2. Security headers (CSP, HSTS, etc.)
            3. Form security and validation
            4. Exposed sensitive information
            5. Common vulnerabilities
            
            Return analysis in the same JSON format with security-specific categories.""",
            expected_output="JSON formatted security analysis",
            agent=agent
        )
    
    def create_content_task(self, url: str, agent: Agent) -> Task:
        return Task(
            description=f"""Analyze content quality and SEO optimization of {url}:
            
            1. Content structure and readability
            2. Keyword usage and distribution
            3. Meta content optimization
            4. Content uniqueness and value
            5. User engagement factors
            
            Return analysis in the same JSON format with content-specific categories.""",
            expected_output="JSON formatted content analysis",
            agent=agent
        )

    def analyze_website(self, url: str, selected_modules: List[str]) -> Dict[str, Any]:
        """
        Main analysis function that creates and runs the crew based on selected modules
        """
        # Validate inputs
        if not url or not selected_modules:
            raise ValueError("URL and selected modules are required")
        
        available_modules = ['seo', 'performance', 'accessibility', 'security', 'content']
        invalid_modules = [m for m in selected_modules if m not in available_modules]
        if invalid_modules:
            raise ValueError(f"Invalid modules: {invalid_modules}")
        
        # Create agents and tasks dynamically
        agents = []
        tasks = []
        
        agent_creators = {
            'seo': self.create_seo_agent,
            'performance': self.create_performance_agent,
            'accessibility': self.create_accessibility_agent,
            'security': self.create_security_agent,
            'content': self.create_content_agent
        }
        
        task_creators = {
            'seo': self.create_seo_task,
            'performance': self.create_performance_task,
            'accessibility': self.create_accessibility_task,
            'security': self.create_security_task,
            'content': self.create_content_task
        }
        
        # Build crew based on selected modules
        for module in selected_modules:
            agent = agent_creators[module]()
            task = task_creators[module](url, agent)
            agents.append(agent)
            tasks.append(task)
        
        # Create reporting task
        reporting_agent = Agent(
            role="Analysis Reporter",
            goal="Compile all analysis results into a comprehensive report",
            backstory="Expert at synthesizing technical analysis into actionable insights",
            verbose=True,
            allow_delegation=False
        )
        
        reporting_task = Task(
            description=f"""Compile all analysis results for {url} into a comprehensive report.
            
            Create a summary that includes:
            1. Overall website health score
            2. Priority issues that need immediate attention
            3. Quick wins for easy improvements
            4. Long-term optimization recommendations
            
            Format the report as structured markdown with clear sections.""",
            expected_output="Comprehensive markdown report with executive summary and detailed findings",
            agent=reporting_agent
        )
        
        agents.append(reporting_agent)
        tasks.append(reporting_task)
        
        # Create and run the crew
        crew = Crew(
            agents=agents,
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
            memory=False  # Disable memory for stateless operation
        )
        
        # Execute analysis
        try:
            result = crew.kickoff(inputs={'url': url})
            
            # Parse results from each task
            parsed_results = {}
            if hasattr(result, 'tasks_output') and result.tasks_output:
                for i, module in enumerate(selected_modules):
                    if i < len(result.tasks_output):
                        try:
                            # Try to parse JSON output
                            task_output = str(result.tasks_output[i])
                            if task_output.strip().startswith('{'):
                                parsed_results[module] = json.loads(task_output)
                            else:
                                # Fallback for non-JSON output
                                parsed_results[module] = {
                                    'score': 75,  # Default score
                                    'raw_output': task_output,
                                    'issues': [],
                                    'fixes': []
                                }
                        except (json.JSONDecodeError, Exception) as e:
                            print(f"Error parsing {module} output: {e}")
                            parsed_results[module] = {
                                'score': 50,
                                'error': str(e),
                                'issues': [],
                                'fixes': []
                            }
                
                # Add report if available
                if len(result.tasks_output) > len(selected_modules):
                    parsed_results['report'] = str(result.tasks_output[-1])
            
            # Return structured result
            return {
                'url': url,
                'selected_modules': selected_modules,
                'results': parsed_results,
                'timestamp': datetime.now().isoformat(),
                'usage_metrics': getattr(crew, 'usage_metrics', None)
            }
            
        except Exception as e:
            print(f"Crew execution error: {e}")
            # Return error result
            return {
                'url': url,
                'selected_modules': selected_modules,
                'results': {module: {'score': 0, 'error': str(e), 'issues': [], 'fixes': []} 
                          for module in selected_modules},
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }

    def quick_analysis(self, url: str) -> Dict[str, Any]:
        """Run a quick analysis with all modules"""
        return self.analyze_website(url, ['seo', 'performance', 'accessibility', 'security', 'content'])

# Example usage and testing
if __name__ == "__main__":
    analyzer = EnhancedWebsiteAnalyzerCrew()
    
    # Test with a sample website
    test_url = "https://example.com"
    test_modules = ['seo', 'performance']
    
    try:
        result = analyzer.analyze_website(test_url, test_modules)
        print("Analysis completed successfully!")
        print(f"Analyzed modules: {result['selected_modules']}")
        print(f"Results available for: {list(result['results'].keys())}")
        
        # Print scores
        for module, data in result['results'].items():
            if 'score' in data:
                print(f"{module.upper()} Score: {data['score']}/100")
        
    except Exception as e:
        print(f"Analysis failed: {e}")

# Integration function for the API
def run_website_analysis(url: str, selected_modules: List[str]) -> Dict[str, Any]:
    """
    Main function to be called from the Next.js API
    """
    analyzer = EnhancedWebsiteAnalyzerCrew()
    return analyzer.analyze_website(url, selected_modules)