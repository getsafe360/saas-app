# `Combined SEO & AI Visibility Score`

## A) Technical SEO Foundations (20 pts)

These are **non-negotiable**. If these fail, content doesn’t matter.

1. **Indexability (no accidental blocking)** — **6 pts**

- Checks:
  - No unwanted `noindex`
  - `robots.txt` allows important paths
  - Canonicals valid

- Tools:
  - Google Search Console → Pages
  - Screaming Frog → Indexability

- Alt audit: manual `site:` checks

2. **Correct canonicalization** — **4 pts**

- One canonical per page

- No self-conflicting canonicals

- Tools:
  - Screaming Frog → Canonical report
  - GSC → Duplicate / canonicalized URLs

3. **HTTPS fully enforced** — **4 pts**

- No mixed content
- HTTP → HTTPS redirect

- Tools:
  - Lighthouse: _HTTPS_ audit
  - DevTools → Security panel

4. **XML sitemap valid & submitted** — **3 pts**

- Clean URLs only
- Auto-updated

- Tools:
  - GSC → Sitemaps
  - Screaming Frog → Sitemap validation

5. **SEO-clean URL structure** — **3 pts**

- Readable
- No IDs / junk params
- Consistent trailing slash

- Tools:
  - Screaming Frog
  - Manual pattern review

## B) On-Page SEO (Content Signals) (20 pts)

1. **Unique & optimized title tags** — **6 pts**

- One per page
- 50–60 chars
- Primary keyword included

- Tools:
  - Lighthouse: _Document has a `\<title\>`_
  - Screaming Frog → Titles report

2. **Meta descriptions optimized** — **4 pts**

- Unique
- 140–160 chars
- Click-intent focused

- Tools:
  - Screaming Frog
  - SERP preview tools

3. **Correct heading structure (H1–H6)** — **6 pts**

- One H1 per page
- Logical hierarchy
- Keyword relevance

- Tools:
  - Lighthouse: _Heading elements in sequential order_
  - Screaming Frog → Headings report

4. **Content relevance & depth** — **4 pts**

- Page answers clear search intent
- No thin content

- Tools:
  - Manual review
  - GSC → Queries per page
  - Surfer / Clearscope (optional)

## C) Content Quality & E-E-A-T Signals (15 pts)

1. **Clear page purpose & intent match** — **4 pts**

- Informational vs transactional clarity
- Above-the-fold relevance

- Tools:
  - Manual + SERP comparison

2. **Author / business credibility signals** — **4 pts**

- About page
- Contact info
- Legal pages (esp. EU)

- Tools:
  - Manual audit

3. **Original content (no duplication)** — **4 pts**

- No internal duplication
- No copied boilerplate

- Tools:
  - Screaming Frog → Duplicates
  - Siteliner / Copyscape

4. **Freshness where relevant** — **3 pts**

- Updated dates
- Current info

- Tools:
  - Manual
  - CMS timestamps

## D) Internal Linking & Crawlability (15 pts)

1. **Logical internal linking structure** — **6 pts**

- Important pages ≤ 3 clicks from home
- Contextual links (not only menus)

- Tools:
  - Screaming Frog → Crawl depth
  - Visual crawl maps

2. **Anchor text optimization** — **4 pts**

- Descriptive anchors
- No “click here” abuse

- Tools:
  - Screaming Frog → Inlinks report

3. **No orphan pages** — **3 pts**

- Every indexable page linked

- Tools:
  - Screaming Frog + sitemap comparison

4. **Breadcrumbs (UX + SEO)** — **2 pts**

- Schema-enabled
- Logical hierarchy

- Tools:
  - Lighthouse
  - Rich Results Test

## E) Structured Data & SERP Enhancements (10 pts)

1. **Valid structured data** — **5 pts**

- Organization
- Breadcrumb
- Article / Product / FAQ (as applicable)

- Tools:
  - Rich Results Test
  - GSC → Enhancements

2. **No schema errors or warnings** — **3 pts**

- Clean validation

- Tools:
  - GSC → Enhancements
  - Schema validator

3. **SERP feature eligibility** — **2 pts**

- FAQ, How-To, Reviews where allowed

- Tools:
  - SERP inspection
  - GSC performance report

## F) Mobile SEO & UX (10 pts)

1. **Mobile-friendly layout** — **5 pts**

- No horizontal scroll
- Tap targets sized

- Tools:
  - Lighthouse: _Mobile Friendly_
  - Mobile-Friendly Test

2. **Mobile parity (content & links)** — **3 pts**

- Same content desktop vs mobile

- Tools:
  - GSC → Mobile usability
  - Manual compare

3. **Intrusive interstitials avoided** — **2 pts**

- No SEO-blocking popups

- Tools:
  - Manual
  - Lighthouse UX audits

## G) Page Experience & SEO Performance (10 pts)

1. **Core Web Vitals pass (SEO view)** — **6 pts**

- LCP, INP, CLS green

- Tools:
  - GSC → Page Experience
  - PageSpeed Insights (field data)

2. **Fast crawl & render performance** — **4 pts**

- No excessive JS blocking rendering

- Tools:
  - Lighthouse
  - GSC → Crawl stats

# 🚀 **AI Visibility & GEO Scorecard Extensions**

## 2. **AI SEO (AI Search Optimization)**

Focus: How well your site is understood, summarized, and surfaced by AI systems.

|            **Metric**             |                  **Description**                   | **Scoring Criteria** |
| :-------------------------------: | :------------------------------------------------: | :------------------: |
| **AI‑Readable Content Structure** |    Clarity of headings, semantic HTML, chunking    |         0–5          |
|     **Summarizability Score**     |   How easily LLMs can extract a coherent summary   |         0–5          |
|   **Entity Density & Clarity**    | Clear definition of people, products, places, orgs |         0–5          |
|       **Fact Consistency**        |           No contradictions across pages           |         0–5          |
|    **AI‑Friendly Formatting**     |       Lists, tables, Q&A blocks, definitions       |         0–5          |
|   **AI‑Safe Canonicalization**    |   Avoids duplicate/conflicting content for LLMs    |         0–5          |

## **Generative Engine Optimization (GEO)**

Focus: Visibility inside generative engines (Gemini, ChatGPT, Perplexity, Claude).

|          **Metric**          |                **Description**                | **Scoring Criteria** |
| :--------------------------: | :-------------------------------------------: | :------------------: |
|   **GEO Schema Coverage**    | JSON‑LD for entities, FAQs, products, events  |         0–5          |
|   **GEO Topic Authority**    |      Depth of content around core topics      |         0–5          |
|    **GEO Query Coverage**    | Coverage of long‑tail, conversational queries |         0–5          |
|    **GEO Answerability**     |      Pages optimized for direct answers       |         0–5          |
|      **GEO Freshness**       |    Update frequency for AI‑indexed content    |         0–5          |
| **GEO Multi‑Locale Signals** |        hreflang, locale‑specific facts        |         0–5          |

## **Author SEO (E‑E‑A‑T for AI Systems)**

Focus: Author identity, credibility, and verifiable expertise.

|         **Metric**         |                **Description**                | **Scoring Criteria** |
| :------------------------: | :-------------------------------------------: | :------------------: |
| **Author Identity Markup** |   Person schema, social links, credentials    |         0–5          |
|   **Experience Signals**   | First‑hand experience, case studies, examples |         0–5          |
| **Expertise Verification** |   External citations, publications, awards    |         0–5          |
|   **Authority Signals**    |        Mentions, backlinks, interviews        |         0–5          |
|     **Trust Signals**      |      Transparency, disclaimers, sources       |         0–5          |

## **AI Search Analytics**

Focus: How well the site performs in AI‑driven search engines.

|         **Metric**         |                 **Description**                 | **Scoring Criteria** |
| :------------------------: | :---------------------------------------------: | :------------------: |
|  **AI Query Impressions**  |         Visibility in AI search engines         |         0–5          |
|    **AI Answer Share**     |     % of answers where your brand is cited      |         0–5          |
| **AI Traffic Attribution** |       Ability to track AI‑origin traffic        |         0–5          |
|  **AI Snippet Presence**   |         Appears in generated summaries          |         0–5          |
| **AI Competitor Overlap**  | How often competitors outrank you in AI answers |         0–5          |

## **Key Insights on AI Visibility**

Focus: How well your brand appears in AI‑generated content.

|            **Metric**             |           **Description**           | **Scoring Criteria** |
| :-------------------------------: | :---------------------------------: | :------------------: |
|    **Brand Mention Frequency**    |  How often LLMs mention your brand  |         0–5          |
| **Brand Sentiment in AI Outputs** |      Positive/neutral/negative      |         0–5          |
|    **Brand Context Accuracy**     |      Are descriptions correct?      |         0–5          |
|  **Brand Association Strength**   | Are you linked to the right topics? |         0–5          |
|   **Brand Recall in AI Models**   |     Does the model “know” you?      |         0–5          |

## **AEO — Answer Engine Optimization**

Focus: Question‑based, answer‑focused content for AI and voice search.

|            **Metric**             |           **Description**            | **Scoring Criteria** |
| :-------------------------------: | :----------------------------------: | :------------------: |
|         **Q&A Coverage**          | FAQ blocks, question‑based headings  |         0–5          |
|         **Answer Depth**          |   Clear, concise, factual answers    |         0–5          |
| **Conversational Query Coverage** | “How do I…”, “What is…”, “Should I…” |         0–5          |
|      **Structured Answers**       |      Lists, steps, definitions       |         0–5          |
|    **Voice‑Friendly Content**     |    Short, spoken‑friendly answers    |         0–5          |

## **AI Citation Rate**

Focus: How often LLMs cite your site as a source.

|           **Metric**            |             **Description**              | **Scoring Criteria** |
| :-----------------------------: | :--------------------------------------: | :------------------: |
|  **Direct Citation Frequency**  |    Appears in AI‑generated citations     |         0–5          |
| **Indirect Citation Frequency** | AI references your facts without linking |         0–5          |
|      **Citation Accuracy**      |          AI cites correct pages          |         0–5          |
|     **Citation Diversity**      |           Multiple pages cited           |         0–5          |
|     **Citation Authority**      |       Cited for high‑value topics        |         0–5          |

## **llms.txt — LLM Authorization & Indexing**

Focus: Machine‑readability and permission signals for AI crawlers.

|           **Metric**           |            **Description**            | **Scoring Criteria** |
| :----------------------------: | :-----------------------------------: | :------------------: |
|     **llms.txt Presence**      |          File exists at root          |         0–5          |
|  **Allowed/Disallowed Paths**  |       Clear, intentional rules        |         0–5          |
| **Model‑Specific Permissions** | OpenAI, Anthropic, Google, Perplexity |         0–5          |
|  **Attribution Requirements**  |        Citation rules defined         |         0–5          |
|      **Update Frequency**      |       Maintained and versioned        |         0–5          |

# Combined AI Visibility Score (New)

AI Visibility Score=AI SEO+GEO+AEO+Author SEO+AI Analytics+AI Citation Rate+llms.txt / 7

## 🔗 **AI-SEO Master Score** → visibility & relevance

## **Together they form a Search Readiness Index to sell, apply fixing, and benchmark.**

### Next logical steps:

1. Merge **SEO + AI Visibility Score** into one AI-SEO** Master Score**

2. Turn this into: JSON schema
