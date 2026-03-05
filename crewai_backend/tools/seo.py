"""
seo.py
Expanded SEOAnalyzer for GetSafe AI-Agent Optimization Suite.
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from typing import Dict, Any, List, Optional, Set

class SEOAnalyzer:
    """
    Performs comprehensive on-page SEO checks for a given URL.
    """

    def __init__(self, url: str):
        self.url = url
        self.page_content = None
        self.soup = None
        self.domain = urlparse(url).netloc

    def fetch_page(self) -> bool:
        try:
            response = requests.get(self.url, timeout=10)
            response.raise_for_status()
            self.page_content = response.text
            self.soup = BeautifulSoup(self.page_content, 'html.parser')
            return True
        except Exception as e:
            print(f"[ERROR] Could not fetch page: {e}")
            return False

    def check_title(self) -> Dict[str, Any]:
        title = self.soup.title.string.strip() if self.soup.title else None
        return {
            "present": bool(title),
            "text": title,
            "length": len(title) if title else 0,
            "issue": None if title and 10 <= len(title) <= 70 else "Title missing or length suboptimal"
        }

    def check_meta_description(self) -> Dict[str, Any]:
        desc_tag = self.soup.find('meta', attrs={'name': 'description'})
        desc = desc_tag['content'].strip() if desc_tag and desc_tag.get('content') else None
        return {
            "present": bool(desc),
            "text": desc,
            "length": len(desc) if desc else 0,
            "issue": None if desc and 50 <= len(desc) <= 160 else "Meta description missing or length suboptimal"
        }

    def check_headings(self) -> Dict[str, Any]:
        headings = {f'h{i}': [] for i in range(1, 7)}
        for i in range(1, 7):
            tags = self.soup.find_all(f'h{i}')
            headings[f'h{i}'] = [t.get_text(strip=True) for t in tags]
        return {
            "counts": {k: len(v) for k, v in headings.items()},
            "examples": {k: v[:2] for k, v in headings.items()},  # first 2 examples for each
            "issues": self._heading_issues(headings)
        }

    def _heading_issues(self, headings: Dict[str, List[str]]) -> List[str]:
        issues = []
        if len(headings['h1']) == 0:
            issues.append("No H1 heading found.")
        elif len(headings['h1']) > 1:
            issues.append("More than one H1 found.")
        if all(len(v) == 0 for v in headings.values()):
            issues.append("No headings found at all.")
        return issues

    def check_links(self) -> Dict[str, Any]:
        internal, external, broken = set(), set(), set()
        for a in self.soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('#') or href.lower().startswith('javascript:'):
                continue
            full_url = urljoin(self.url, href)
            if urlparse(full_url).netloc == self.domain:
                internal.add(full_url)
            else:
                external.add(full_url)
        # Optionally, you can check for broken links (requests.head)
        # For MVP, skip or check a few only (avoid slowdowns)
        return {
            "internal_links": list(internal)[:5],
            "external_links": list(external)[:5],
            "internal_count": len(internal),
            "external_count": len(external),
            "issue": None if internal or external else "No links found"
        }

    def check_images(self) -> Dict[str, Any]:
        images = self.soup.find_all('img')
        missing_alt = [img.get('src') for img in images if not img.get('alt')]
        return {
            "total_images": len(images),
            "missing_alt_count": len(missing_alt),
            "missing_alt_examples": missing_alt[:3],
            "issue": None if len(missing_alt) == 0 else f"{len(missing_alt)} images missing alt text"
        }

    def check_semantic_html(self) -> Dict[str, Any]:
        elements = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer']
        found = {el: bool(self.soup.find(el)) for el in elements}
        missing = [el for el, present in found.items() if not present]
        return {
            "found": [el for el, present in found.items() if present],
            "missing": missing,
            "issue": None if not missing else f"Missing semantic elements: {', '.join(missing)}"
        }

    def check_schema_org(self) -> Dict[str, Any]:
        ld_json = self.soup.find('script', type='application/ld+json')
        microdata = self.soup.find(attrs={'itemscope': True})
        return {
            "ld_json": bool(ld_json),
            "microdata": bool(microdata),
            "issue": None if ld_json or microdata else "No structured data/schema.org markup found"
        }

    def check_canonical(self) -> Dict[str, Any]:
        canonical = self.soup.find('link', rel='canonical')
        return {
            "present": bool(canonical),
            "href": canonical['href'] if canonical and canonical.get('href') else None,
            "issue": None if canonical else "No canonical tag found"
        }

    def run_all_checks(self) -> Dict[str, Any]:
        if not self.page_content:
            if not self.fetch_page():
                return {"error": "Page could not be fetched"}
        return {
            "title": self.check_title(),
            "meta_description": self.check_meta_description(),
            "headings": self.check_headings(),
            "links": self.check_links(),
            "images": self.check_images(),
            "semantic_html": self.check_semantic_html(),
            "schema_org": self.check_schema_org(),
            "canonical": self.check_canonical()
        }
