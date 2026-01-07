# GetSafe360 AI Crew Microservice

AI-powered website analysis and repair service using CrewAI agents, integrated with the GetSafe360 SaaS platform.

## 🚀 Features

- **AI-Driven Analysis**: Comprehensive website analysis across 5 categories
  - **SEO**: Meta tags, headings, structured data, keywords
  - **Performance**: Load times, Core Web Vitals, optimization opportunities
  - **Security**: SSL, headers, vulnerabilities
  - **Accessibility**: WCAG compliance, semantic HTML, ARIA
  - **Content**: Quality, readability, engagement

- **Instant Repair**: Automated fixes for detected issues
  - WordPress integration via REST API
  - Code injection for general sites
  - File modifications with proper authorization

- **Dashboard Integration**: Structured output matching SiteCockpit card format
  - Real-time issue detection
  - Actionable fix recommendations
  - Impact score calculation

## 📋 Prerequisites

- Python 3.11+
- OpenAI API key
- Docker (optional, for containerized deployment)

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd latest_ai_development
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `API_SECRET_KEY`: Your secret key for API authentication
- `OPENAI_API_KEY`: Your OpenAI API key
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

### 3. Run Development Server

```bash
python api_server.py
```

Or using uvicorn directly:

```bash
uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
```

## 🐳 Docker Deployment

### Build and Run

```bash
docker-compose up -d
```

### Check Status

```bash
docker-compose ps
docker-compose logs -f ai-crew-api
```

### Stop Service

```bash
docker-compose down
```

## 📡 API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "GetSafe360 AI Crew API",
  "version": "1.0.0",
  "timestamp": "2026-01-07T..."
}
```

### Analyze Website

```bash
POST /analyze
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "url": "https://example.com",
  "modules": ["seo", "performance", "security", "accessibility"],
  "siteId": "optional-site-id",
  "locale": "en"
}
```

Response:
```json
{
  "jobId": "abc123...",
  "url": "https://example.com",
  "selectedModules": ["seo", "performance", "security", "accessibility"],
  "results": {
    "seo": {
      "score": 85,
      "grade": "B",
      "issues": [...],
      "fixes": [...],
      "metadata": {
        "title": "Page Title",
        "description": "Meta description",
        "keywords": ["keyword1", "keyword2"]
      }
    }
  },
  "timestamp": "2026-01-07T...",
  "usageMetrics": {...}
}
```

### Repair Issues

```bash
POST /repair
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "siteId": "site-123",
  "issues": [
    {
      "id": "seo_missing_meta_desc",
      "category": "seo",
      "type": "meta_description",
      "severity": "high"
    }
  ],
  "wordpress": {
    "connected": true,
    "apiUrl": "https://example.com/wp-json",
    "authToken": "..."
  },
  "dryRun": false
}
```

## 🔗 Next.js Integration

### 1. Add Environment Variables

In `saas-ux/.env.local`:

```env
AI_CREW_API_URL=http://localhost:8000
AI_CREW_API_KEY=your-secret-key
```

### 2. Use the API Client

```typescript
import { aiCrewClient } from '@/lib/services/ai-crew-client';

// Analyze a website
const result = await aiCrewClient.analyze({
  url: 'https://example.com',
  modules: ['seo', 'performance'],
  siteId: 'site-123'
});

// Repair issues
const repairResult = await aiCrewClient.repair({
  siteId: 'site-123',
  issues: [{ id: 'issue-1', category: 'seo', type: 'meta', severity: 'high' }]
});
```

### 3. Call via Next.js API Route

```typescript
// From frontend
const response = await fetch('/api/ai-crew/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com',
    modules: ['seo', 'performance', 'security', 'accessibility']
  })
});

const { success, data } = await response.json();
```

## 🧪 Testing

Run the test suite:

```bash
python test_api.py
```

Or test individual endpoints:

### Test Health Check

```bash
curl http://localhost:8000/health
```

### Test Analysis

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "modules": ["seo", "performance"]
  }'
```

## 📊 Output Format for Dashboard Cards

The API returns data matching SiteCockpit card requirements. See full documentation in the strategy document.

## 🔧 Troubleshooting

### Service not starting

1. Check Python version: `python --version` (must be 3.11+)
2. Verify dependencies: `pip list | grep fastapi`
3. Check logs: `docker-compose logs ai-crew-api`

### OpenAI API errors

1. Verify API key in `.env`
2. Check API quota: https://platform.openai.com/usage
3. Review error logs for rate limiting

## 🚢 Production Deployment

See deployment guide in strategy document.

## 📚 Resources

- [CrewAI Documentation](https://docs.crewai.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [GetSafe360 Strategy Document](../docs/ai-integration-strategy.md)

## 🤝 Support

For support, questions, or feedback:
- Visit the [CrewAI documentation](https://docs.crewai.com)
- Join [CrewAI Discord](https://discord.com/invite/X4JWnZnxPb)
- Contact the GetSafe360 development team
