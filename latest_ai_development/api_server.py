"""
FastAPI Microservice for AI Crew Analysis & Repair
Bridges CrewAI agents with Next.js SiteCockpit dashboard
"""
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
import os
import hashlib
import json
import logging

# Import our AI agents
from src.latest_ai_development.enhanced_crew import EnhancedWebsiteAnalyzerCrew
from src.latest_ai_development.seo import SEOAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="GetSafe360 AI Crew API",
    description="AI-powered website analysis and repair service",
    version="1.0.0"
)

# CORS Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://yourdomain.com").split(",")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "your-secret-key-change-in-production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== REQUEST MODELS ====================

class AnalyzeRequest(BaseModel):
    url: HttpUrl
    modules: List[Literal['seo', 'performance', 'security', 'accessibility', 'content']] = Field(
        default=['seo', 'performance', 'security', 'accessibility'],
        description="Analysis modules to run"
    )
    siteId: Optional[str] = None
    locale: str = Field(default="en", description="Language locale")


class RepairIssue(BaseModel):
    id: str
    category: Literal['seo', 'performance', 'security', 'accessibility', 'wordpress']
    type: str
    severity: Literal['critical', 'high', 'medium', 'low']


class RepairRequest(BaseModel):
    siteId: str
    issues: List[RepairIssue]
    wordpress: Optional[Dict[str, Any]] = None
    dryRun: bool = Field(default=False, description="Test mode - don't apply changes")


# ==================== RESPONSE MODELS ====================

class IssueDetail(BaseModel):
    id: str
    type: Literal['error', 'warning', 'info']
    title: str
    description: str
    impact: Literal['critical', 'high', 'medium', 'low']
    category: str
    autoFixable: bool = False


class FixDetail(BaseModel):
    id: str
    issueId: str
    title: str
    description: str
    code: Optional[str] = None
    implementation: Literal['automatic', 'manual', 'plugin', 'wordpress_api']
    estimatedTime: str
    impactScore: int = Field(ge=0, le=100)


class CategoryAnalysisResult(BaseModel):
    score: int = Field(ge=0, le=100)
    grade: str
    issues: List[IssueDetail] = []
    fixes: List[FixDetail] = []
    metadata: Dict[str, Any] = {}


class AnalysisResponse(BaseModel):
    jobId: str
    url: str
    selectedModules: List[str]
    results: Dict[str, CategoryAnalysisResult]
    timestamp: datetime
    usageMetrics: Optional[Dict[str, Any]] = None


class RepairResult(BaseModel):
    issueId: str
    success: bool
    method: str
    changes: List[Dict[str, Any]] = []
    error: Optional[str] = None


class RepairResponse(BaseModel):
    jobId: str
    siteId: str
    totalIssues: int
    repaired: List[RepairResult]
    failed: List[RepairResult]
    timestamp: datetime


# ==================== UTILITY FUNCTIONS ====================

def verify_api_key(authorization: str = Header(None)) -> bool:
    """Verify API key from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization format")

    token = authorization.replace("Bearer ", "")
    if token != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return True


def generate_job_id(url: str) -> str:
    """Generate unique job ID from URL and timestamp"""
    timestamp = datetime.now().isoformat()
    data = f"{url}_{timestamp}".encode()
    return hashlib.sha256(data).hexdigest()[:16]


def calculate_grade(score: int) -> str:
    """Calculate letter grade from score"""
    if score >= 97: return 'A+'
    if score >= 93: return 'A'
    if score >= 90: return 'A-'
    if score >= 87: return 'B+'
    if score >= 83: return 'B'
    if score >= 80: return 'B-'
    if score >= 77: return 'C+'
    if score >= 73: return 'C'
    if score >= 70: return 'C-'
    if score >= 60: return 'D'
    return 'F'


def map_crew_output_to_card_format(module: str, crew_result: Dict[str, Any]) -> CategoryAnalysisResult:
    """
    Map CrewAI output to dashboard card format

    This function transforms the AI crew's JSON output into the exact format
    expected by the SiteCockpit cards (PerformanceCard, SEOCard, etc.)
    """
    score = crew_result.get('score', 75)
    grade = calculate_grade(score)

    # Convert crew issues to IssueDetail format
    issues = []
    raw_issues = crew_result.get('issues', [])
    for idx, issue in enumerate(raw_issues):
        if isinstance(issue, dict):
            issues.append(IssueDetail(
                id=issue.get('id', f"{module}_issue_{idx}"),
                type=issue.get('type', 'warning'),
                title=issue.get('title', 'Issue detected'),
                description=issue.get('description', ''),
                impact=issue.get('impact', 'medium'),
                category=issue.get('category', module),
                autoFixable=issue.get('autoFixable', False)
            ))
        else:
            # Handle string issues
            issues.append(IssueDetail(
                id=f"{module}_issue_{idx}",
                type='warning',
                title=str(issue),
                description=str(issue),
                impact='medium',
                category=module,
                autoFixable=False
            ))

    # Convert crew fixes to FixDetail format
    fixes = []
    raw_fixes = crew_result.get('fixes', [])
    for fix in raw_fixes:
        if isinstance(fix, dict):
            fixes.append(FixDetail(
                id=fix.get('id', f"{module}_fix_{len(fixes)}"),
                issueId=fix.get('issue_id', fix.get('issueId', '')),
                title=fix.get('title', 'Fix available'),
                description=fix.get('description', ''),
                code=fix.get('code'),
                implementation=fix.get('implementation', 'manual'),
                estimatedTime=fix.get('estimated_time', fix.get('estimatedTime', '5 minutes')),
                impactScore=fix.get('impact_score', fix.get('impactScore', 10))
            ))

    # Module-specific metadata for card display
    metadata = {}

    if module == 'seo':
        metadata = {
            'title': crew_result.get('title', ''),
            'description': crew_result.get('description', ''),
            'keywords': crew_result.get('keywords', []),
            'recommendations': crew_result.get('recommendations', [])
        }
    elif module == 'performance':
        metadata = {
            'metrics': crew_result.get('metrics', {}),
            'recommendations': crew_result.get('recommendations', [])
        }
    elif module == 'security':
        metadata = {
            'https': crew_result.get('https', True),
            'certificate': crew_result.get('certificate', {}),
            'headers': crew_result.get('headers', {}),
            'vulnerabilities': crew_result.get('vulnerabilities', {})
        }
    elif module == 'accessibility':
        metadata = {
            'wcagLevel': crew_result.get('wcagLevel', 'AA'),
            'passedChecks': crew_result.get('passedChecks', 0),
            'categories': crew_result.get('categories', {})
        }

    return CategoryAnalysisResult(
        score=score,
        grade=grade,
        issues=issues,
        fixes=fixes,
        metadata=metadata
    )


async def run_enhanced_analysis(url: str, modules: List[str]) -> Dict[str, Any]:
    """
    Run enhanced CrewAI analysis with fallback to SEOAnalyzer for SEO module
    """
    try:
        # Use EnhancedWebsiteAnalyzerCrew
        analyzer = EnhancedWebsiteAnalyzerCrew()
        crew_results = analyzer.analyze_website(url, modules)

        # If SEO module is requested, enhance with SEOAnalyzer
        if 'seo' in modules and 'seo' in crew_results.get('results', {}):
            try:
                seo_analyzer = SEOAnalyzer(url)
                seo_checks = seo_analyzer.run_all_checks()

                # Merge SEOAnalyzer results into crew results
                if 'error' not in seo_checks:
                    crew_results['results']['seo']['seo_checks'] = seo_checks

                    # Add specific issues from SEOAnalyzer
                    seo_issues = []
                    if seo_checks.get('title', {}).get('issue'):
                        seo_issues.append(seo_checks['title']['issue'])
                    if seo_checks.get('meta_description', {}).get('issue'):
                        seo_issues.append(seo_checks['meta_description']['issue'])
                    if seo_checks.get('images', {}).get('issue'):
                        seo_issues.append(seo_checks['images']['issue'])

                    # Add to issues array if not already present
                    existing_issues = crew_results['results']['seo'].get('issues', [])
                    crew_results['results']['seo']['issues'] = existing_issues + seo_issues

            except Exception as e:
                logger.warning(f"SEOAnalyzer enhancement failed: {e}")

        return crew_results

    except Exception as e:
        logger.error(f"Enhanced analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ==================== API ENDPOINTS ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "GetSafe360 AI Crew API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_website(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    authorized: bool = Header(None, alias="Authorization", include_in_schema=False)
):
    """
    Analyze a website using AI agents

    Returns structured data matching SiteCockpit card format:
    - SEOCard: score, title, description, keywords, issues
    - PerformanceCard: score, metrics, recommendations
    - SecurityCard: score, https, certificate, headers, vulnerabilities
    - AccessibilityCard: score, wcagLevel, issues, passedChecks
    """
    # Verify API key
    verify_api_key(authorized)

    job_id = generate_job_id(str(request.url))
    logger.info(f"[{job_id}] Starting analysis for {request.url} with modules: {request.modules}")

    try:
        # Run enhanced analysis
        crew_results = await run_enhanced_analysis(str(request.url), request.modules)

        # Map results to card format
        formatted_results = {}
        for module in request.modules:
            if module in crew_results.get('results', {}):
                formatted_results[module] = map_crew_output_to_card_format(
                    module,
                    crew_results['results'][module]
                )
            else:
                # Provide default result if module failed
                formatted_results[module] = CategoryAnalysisResult(
                    score=0,
                    grade='F',
                    issues=[IssueDetail(
                        id=f"{module}_error",
                        type='error',
                        title=f"{module.upper()} analysis failed",
                        description="Could not complete analysis for this category",
                        impact='high',
                        category=module,
                        autoFixable=False
                    )],
                    fixes=[],
                    metadata={}
                )

        response = AnalysisResponse(
            jobId=job_id,
            url=str(request.url),
            selectedModules=request.modules,
            results=formatted_results,
            timestamp=datetime.now(),
            usageMetrics=crew_results.get('usage_metrics')
        )

        logger.info(f"[{job_id}] Analysis completed successfully")
        return response

    except Exception as e:
        logger.error(f"[{job_id}] Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repair", response_model=RepairResponse)
async def repair_issues(
    request: RepairRequest,
    authorized: bool = Header(None, alias="Authorization", include_in_schema=False)
):
    """
    Execute automated repairs for detected issues

    Supports:
    - WordPress repairs via REST API
    - General fixes via code injection
    - File modifications (with proper authorization)
    """
    # Verify API key
    verify_api_key(authorized)

    job_id = generate_job_id(request.siteId)
    logger.info(f"[{job_id}] Starting repair for {len(request.issues)} issues")

    repaired = []
    failed = []

    for issue in request.issues:
        try:
            result = await execute_repair(issue, request.wordpress, request.dryRun)
            if result['success']:
                repaired.append(RepairResult(**result))
            else:
                failed.append(RepairResult(**result))
        except Exception as e:
            logger.error(f"[{job_id}] Repair failed for {issue.id}: {e}")
            failed.append(RepairResult(
                issueId=issue.id,
                success=False,
                method='error',
                error=str(e)
            ))

    response = RepairResponse(
        jobId=job_id,
        siteId=request.siteId,
        totalIssues=len(request.issues),
        repaired=repaired,
        failed=failed,
        timestamp=datetime.now()
    )

    logger.info(f"[{job_id}] Repair completed: {len(repaired)} succeeded, {len(failed)} failed")
    return response


async def execute_repair(
    issue: RepairIssue,
    wordpress: Optional[Dict[str, Any]],
    dry_run: bool
) -> Dict[str, Any]:
    """
    Execute a single repair action

    TODO: Implement actual repair logic based on issue type and category
    This is a placeholder that returns mock data
    """
    # Mock implementation - replace with actual repair logic
    if dry_run:
        return {
            'issueId': issue.id,
            'success': True,
            'method': 'dry_run',
            'changes': [
                {
                    'file': 'example.php',
                    'action': 'would_modify',
                    'description': f'Would fix {issue.type} in {issue.category}'
                }
            ]
        }

    # Route to appropriate repair handler based on category
    if issue.category == 'wordpress' and wordpress:
        return await repair_wordpress_issue(issue, wordpress)
    elif issue.category == 'seo':
        return await repair_seo_issue(issue)
    elif issue.category == 'accessibility':
        return await repair_accessibility_issue(issue)
    elif issue.category == 'security':
        return await repair_security_issue(issue)
    elif issue.category == 'performance':
        return await repair_performance_issue(issue)
    else:
        return {
            'issueId': issue.id,
            'success': False,
            'method': 'unsupported',
            'error': f'No repair handler for category: {issue.category}'
        }


async def repair_wordpress_issue(issue: RepairIssue, wordpress: Dict[str, Any]) -> Dict[str, Any]:
    """Repair WordPress-specific issues via REST API"""
    # TODO: Implement WordPress API integration
    return {
        'issueId': issue.id,
        'success': False,
        'method': 'wordpress_api',
        'error': 'WordPress repair not yet implemented'
    }


async def repair_seo_issue(issue: RepairIssue) -> Dict[str, Any]:
    """Repair SEO issues"""
    # TODO: Implement SEO repairs
    return {
        'issueId': issue.id,
        'success': False,
        'method': 'manual',
        'error': 'SEO repair not yet implemented'
    }


async def repair_accessibility_issue(issue: RepairIssue) -> Dict[str, Any]:
    """Repair accessibility issues using AI"""
    # TODO: Integrate with fixer_accessibility.py
    return {
        'issueId': issue.id,
        'success': False,
        'method': 'automatic',
        'error': 'Accessibility repair not yet implemented'
    }


async def repair_security_issue(issue: RepairIssue) -> Dict[str, Any]:
    """Repair security issues"""
    # TODO: Implement security repairs
    return {
        'issueId': issue.id,
        'success': False,
        'method': 'manual',
        'error': 'Security repair not yet implemented'
    }


async def repair_performance_issue(issue: RepairIssue) -> Dict[str, Any]:
    """Repair performance issues"""
    # TODO: Implement performance optimizations
    return {
        'issueId': issue.id,
        'success': False,
        'method': 'automatic',
        'error': 'Performance repair not yet implemented'
    }


# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting GetSafe360 AI Crew API on {host}:{port}")

    uvicorn.run(
        "api_server:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )
