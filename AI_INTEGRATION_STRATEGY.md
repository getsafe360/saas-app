# AI Integration Strategy

## Overview

This document outlines the complete strategy for integrating AI-powered WordPress site analysis and automated repair into the GetSafe360 SaaS platform.

## Database Schema (✅ COMPLETED)

### Tables Created

#### `ai_analysis_jobs`
Tracks AI analysis jobs for WordPress sites.

**Columns:**
- `id` (uuid, PK) - Unique job identifier
- `site_id` (uuid, FK → sites, NOT NULL) - Site being analyzed
- `user_id` (integer, FK → users) - User who initiated the analysis
- `job_id` (text, unique) - External job tracking ID
- `status` (ai_job_status enum) - Job lifecycle state
- `selected_modules` (jsonb) - Which analysis modules were run
- `results` (jsonb) - Analysis results and findings
- `issues_found` (integer) - Total issues discovered
- `repairable_issues` (integer) - Count of auto-repairable issues
- `started_at` (timestamp) - When analysis began
- `completed_at` (timestamp) - When analysis finished
- `created_at` (timestamp) - Record creation time

**Indexes:**
- `ai_analysis_jobs_site_idx` on `site_id` - Fast site lookups
- `ai_analysis_jobs_status_idx` on `status` - Query by job state
- `ai_analysis_jobs_job_id_idx` on `job_id` - External job tracking

**Status Enum Values:**
```typescript
type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
```

#### `ai_repair_actions`
Tracks individual repair actions taken on WordPress sites.

**Columns:**
- `id` (uuid, PK) - Unique action identifier
- `analysis_job_id` (uuid, FK → ai_analysis_jobs) - Parent analysis job
- `site_id` (uuid, FK → sites) - Site being repaired
- `issue_id` (text) - Reference to specific issue
- `category` (text) - Issue category (security, performance, etc.)
- `status` (ai_repair_status enum) - Repair action state
- `repair_method` (text) - Which repair strategy was used
- `changes` (jsonb) - Detailed changes made
- `error_message` (text) - Error if repair failed
- `executed_at` (timestamp) - When repair ran
- `created_at` (timestamp) - Record creation time

**Indexes:**
- `ai_repair_actions_analysis_job_idx` on `analysis_job_id` - Find all repairs for a job
- `ai_repair_actions_site_idx` on `site_id` - Site repair history
- `ai_repair_actions_status_idx` on `status` - Query by repair state

**Status Enum Values:**
```typescript
type AiRepairStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
```

### Sites Table Extensions

Added AI-related fields to the `sites` table:

```typescript
{
  // AI Analysis & Repair
  wordpressConnection: jsonb,        // WordPress credentials & connection config
  aiRepairEnabled: boolean,          // Is auto-repair enabled for this site?
  lastAiAnalysis: timestamp,         // Last successful analysis timestamp
}
```

## Architecture

### 1. Analysis Flow

```
User Request → Queue Analysis Job → Execute Modules → Store Results → Notify User
                      ↓
              [ai_analysis_jobs]
                      ↓
              status: 'pending' → 'running' → 'completed'
                      ↓
              Generate repair recommendations
```

### 2. Repair Flow

```
Analysis Complete → Create Repair Actions → (if aiRepairEnabled) Execute → Track Results
                           ↓
                   [ai_repair_actions]
                           ↓
                   status: 'pending' → 'running' → 'completed'
```

### 3. Module System

Analysis modules are stored in `selected_modules` JSONB field:

```json
{
  "security": {
    "enabled": true,
    "checks": ["file_permissions", "outdated_plugins", "vulnerable_themes"]
  },
  "performance": {
    "enabled": true,
    "checks": ["large_images", "unoptimized_database", "slow_queries"]
  },
  "seo": {
    "enabled": false
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (✅ COMPLETED)

- [x] Database schema design
- [x] Drizzle ORM table definitions
- [x] TypeScript type exports
- [x] Migration generation and application
- [x] Performance indexes

### Phase 2: WordPress Connection (NEXT)

**Files to Create:**
- `lib/wordpress/client.ts` - WordPress API client
- `lib/wordpress/auth.ts` - Authentication handling
- `app/api/sites/[id]/wordpress/connect/route.ts` - Connection endpoint

**Tasks:**
1. Implement WordPress REST API client
2. Support authentication methods:
   - Application passwords
   - OAuth 2.0
   - JWT tokens
3. Store credentials securely in `wordpressConnection` JSONB field
4. Test connection and validate credentials
5. Update `sites.lastConnectedAt` on successful connection

**Example `wordpressConnection` structure:**
```json
{
  "url": "https://example.com",
  "authMethod": "application_password",
  "credentials": {
    "username": "admin",
    "applicationPassword": "encrypted_password_here"
  },
  "lastVerified": "2026-01-09T10:30:00Z",
  "capabilities": ["read", "edit", "plugins", "themes"]
}
```

### Phase 3: Analysis Engine

**Files to Create:**
- `lib/ai/analysis/engine.ts` - Core analysis orchestrator
- `lib/ai/analysis/modules/security.ts` - Security checks
- `lib/ai/analysis/modules/performance.ts` - Performance checks
- `lib/ai/analysis/modules/seo.ts` - SEO checks
- `lib/ai/prompts/wordpress-analysis.ts` - AI prompts
- `app/api/sites/[id]/analyze/route.ts` - Trigger analysis

**Tasks:**
1. Build module system for extensible checks
2. Integrate Claude API for intelligent analysis
3. Parse WordPress site data (plugins, themes, configs)
4. Generate structured issue reports
5. Classify issues by severity and repairability
6. Store results in `ai_analysis_jobs.results`

**Example `results` structure:**
```json
{
  "summary": {
    "totalIssues": 12,
    "critical": 2,
    "high": 4,
    "medium": 5,
    "low": 1,
    "repairableCount": 8
  },
  "issues": [
    {
      "id": "sec-001",
      "category": "security",
      "severity": "critical",
      "title": "Outdated WordPress Core",
      "description": "WordPress 6.2 is outdated and has known vulnerabilities",
      "repairable": true,
      "repairMethod": "auto_update",
      "affectedFiles": [],
      "recommendation": "Update to WordPress 6.4.2"
    }
  ]
}
```

### Phase 4: Repair Automation

**Files to Create:**
- `lib/ai/repair/engine.ts` - Core repair orchestrator
- `lib/ai/repair/strategies/update.ts` - Auto-update strategy
- `lib/ai/repair/strategies/config.ts` - Config fix strategy
- `lib/ai/repair/strategies/file.ts` - File modification strategy
- `app/api/sites/[id]/repair/route.ts` - Trigger repair

**Tasks:**
1. Implement repair strategy pattern
2. Create safe rollback mechanism (use `snapshots` table)
3. Validate repairs before applying
4. Track each action in `ai_repair_actions`
5. Update issue status after repair
6. Re-run analysis to verify fixes

**Safety Features:**
- Always create snapshot before repair
- Test repairs in staging environment first
- Automatic rollback on critical failures
- User approval required for destructive changes

### Phase 5: UI/UX Integration

**Files to Create:**
- `app/sites/[id]/analysis/page.tsx` - Analysis dashboard
- `app/sites/[id]/analysis/history/page.tsx` - Analysis history
- `app/sites/[id]/repair/page.tsx` - Repair actions view
- `components/ai/AnalysisCard.tsx` - Analysis summary card
- `components/ai/IssueList.tsx` - Issue display component
- `components/ai/RepairButton.tsx` - Trigger repair action

**Tasks:**
1. Design analysis results visualization
2. Create issue severity indicators
3. Build repair action controls
4. Show real-time job status updates
5. Display repair history timeline
6. Add AI settings to site configuration

### Phase 6: Background Processing

**Files to Create:**
- `lib/jobs/ai-analysis-worker.ts` - Analysis job worker
- `lib/jobs/ai-repair-worker.ts` - Repair job worker
- `lib/queue/ai-jobs.ts` - Job queue management

**Tasks:**
1. Set up job queue (Bull/BullMQ or similar)
2. Implement retry logic for failed jobs
3. Add job timeout handling
4. Create webhook for job completion
5. Send notifications on completion/failure

### Phase 7: Monitoring & Analytics

**Files to Create:**
- `app/api/admin/ai/metrics/route.ts` - AI usage metrics
- `app/admin/ai-analytics/page.tsx` - Admin analytics dashboard

**Tasks:**
1. Track analysis success rates
2. Monitor repair effectiveness
3. Measure AI token usage and costs
4. Identify common issue patterns
5. Generate usage reports

## API Endpoints

### Analysis Endpoints

#### `POST /api/sites/:siteId/analyze`
Trigger a new AI analysis for a WordPress site.

**Request:**
```json
{
  "modules": ["security", "performance", "seo"],
  "priority": "high"
}
```

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "estimatedDuration": "2-5 minutes"
}
```

#### `GET /api/sites/:siteId/analysis/:jobId`
Get status and results of an analysis job.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "siteId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed",
  "issuesFound": 12,
  "repairableIssues": 8,
  "results": { /* detailed results */ },
  "completedAt": "2026-01-09T10:45:00Z"
}
```

#### `GET /api/sites/:siteId/analysis`
List all analysis jobs for a site.

**Query Params:**
- `status` - Filter by job status
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset

### Repair Endpoints

#### `POST /api/sites/:siteId/repair`
Trigger repairs for identified issues.

**Request:**
```json
{
  "analysisJobId": "550e8400-e29b-41d4-a716-446655440000",
  "issueIds": ["sec-001", "perf-003"],
  "createSnapshot": true
}
```

**Response:**
```json
{
  "repairActions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "issueId": "sec-001",
      "status": "pending"
    }
  ]
}
```

#### `GET /api/sites/:siteId/repair/:actionId`
Get status of a repair action.

**Response:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "issueId": "sec-001",
  "status": "completed",
  "changes": { /* detailed changes */ },
  "executedAt": "2026-01-09T10:50:00Z"
}
```

### WordPress Connection Endpoints

#### `POST /api/sites/:siteId/wordpress/connect`
Connect or update WordPress site credentials.

**Request:**
```json
{
  "url": "https://example.com",
  "authMethod": "application_password",
  "credentials": {
    "username": "admin",
    "applicationPassword": "xxxx xxxx xxxx xxxx"
  }
}
```

**Response:**
```json
{
  "connected": true,
  "wordpressVersion": "6.4.2",
  "capabilities": ["read", "edit", "plugins", "themes"]
}
```

#### `POST /api/sites/:siteId/wordpress/test`
Test WordPress connection without saving.

## Security Considerations

### Data Protection
1. **Encrypt WordPress credentials** using AES-256
2. Store encryption keys in environment variables
3. Never log raw credentials
4. Use secure token rotation

### Access Control
1. User must own the site to trigger analysis
2. Admin role required for bulk operations
3. Team members need `site:analyze` permission
4. Repair actions require `site:repair` permission

### Rate Limiting
1. Max 5 analyses per site per hour
2. Max 10 repair actions per site per hour
3. Throttle by user and by team

### Audit Trail
1. Log all analysis jobs to `activity_logs`
2. Log all repair actions to `activity_logs`
3. Store before/after snapshots
4. Track who initiated each action

## Cost Management

### AI Token Usage
1. Estimate tokens before analysis
2. Set per-site token budgets
3. Track usage in `ai_analysis_jobs.results.tokenUsage`
4. Alert on high consumption

### Optimization Strategies
1. Cache WordPress site data (1 hour TTL)
2. Reuse analysis results for similar sites
3. Batch similar repairs
4. Use Claude Haiku for simple checks

## Testing Strategy

### Unit Tests
- Test each analysis module independently
- Test repair strategies with fixtures
- Mock WordPress API responses

### Integration Tests
- Test complete analysis flow
- Test repair execution and rollback
- Test WordPress connection validation

### E2E Tests
- Test UI → API → Database flow
- Test job queue processing
- Test webhook notifications

## Rollout Plan

### Phase 1: Private Beta
- Enable for 5 test sites
- Monitor performance and accuracy
- Gather user feedback
- Fix critical bugs

### Phase 2: Team Beta
- Enable for internal team sites
- Expand to 50 early adopter sites
- Monitor costs and performance
- Iterate on UX

### Phase 3: Public Release
- Enable for all paid plans
- Add to pricing tiers
- Launch marketing campaign
- Provide onboarding tutorials

## Monitoring & Alerts

### Key Metrics
1. Analysis success rate (target: >95%)
2. Average analysis duration (target: <3 min)
3. Repair success rate (target: >90%)
4. False positive rate (target: <5%)
5. AI token usage per analysis
6. User satisfaction (NPS)

### Alerts
1. Analysis failure rate >10%
2. Repair failure rate >15%
3. Queue depth >100 jobs
4. API errors >5% of requests
5. Token usage exceeds budget

## Future Enhancements

### Advanced Features
1. **Scheduled Analysis** - Automatic weekly/monthly scans
2. **Comparative Analysis** - Track site health over time
3. **Predictive Maintenance** - Anticipate issues before they occur
4. **Team Reporting** - Aggregate analytics across all sites
5. **Custom Modules** - User-defined analysis checks
6. **AI Learning** - Improve recommendations based on repair outcomes

### Integration Opportunities
1. Slack/Discord notifications
2. Zapier webhooks
3. Export to PDF reports
4. GitHub issue creation
5. Jira ticket integration

## Resources

### Documentation
- WordPress REST API: https://developer.wordpress.org/rest-api/
- Anthropic Claude API: https://docs.anthropic.com/
- Drizzle ORM: https://orm.drizzle.team/

### Code Locations
- Schema: `/saas-ux/lib/db/schema/ai/analysis.ts`
- Enums: `/saas-ux/lib/db/schema/_shared/enums.ts`
- Migration: `/saas-ux/lib/db/migrations/0001_graceful_pride.sql`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Status:** Phase 1 Complete, Phase 2 Ready to Start
