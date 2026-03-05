"""
serp.py
SERPAnalyzer: Checks SERP results and reputation/sentiment for a given brand or domain.
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import re

GOOGLE_SEARCH_URL = "https://www.google.com/search?q={query}&hl=en"

class SERPAnalyzer:
    def __init__(self, brand_or_domain: str, max_results: int = 10):
        self.query = brand_or_domain
        self.max_results = max_results
        self.results = []

    def fetch_serp(self):
        # For a production tool, use the official Google API or SERP APIs!
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        url = GOOGLE_SEARCH_URL.format(query=self.query)
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        entries = soup.find_all('div', class_='tF2Cxc') or soup.find_all('div', class_='g')
        self.results = []
        for entry in entries[:self.max_results]:
            title = entry.find('h3')
            snippet = entry.find('span', class_='aCOpRe') or entry.find('div', class_='VwiC3b')
            self.results.append({
                "title": title.text if title else "",
                "snippet": snippet.text if snippet else "",
            })

    def simple_sentiment(self, text: str) -> str:
        # Primitive MVP sentiment check: search for negative/positive words
        neg_words = re.compile(r"\b(bad|problem|complaint|scam|fraud|negative|poor|kritik|schlecht|warnung)\b", re.I)
        pos_words = re.compile(r"\b(good|excellent|recommended|positive|best|great|empfehlung|zufrieden)\b", re.I)
        if neg_words.search(text):
            return "negative"
        elif pos_words.search(text):
            return "positive"
        else:
            return "neutral"

    def analyze_sentiment(self):
        sentiments = []
        for result in self.results:
            full_text = (result["title"] or "") + " " + (result["snippet"] or "")
            sentiments.append(self.simple_sentiment(full_text))
        if sentiments.count("negative") > sentiments.count("positive"):
            return "negative"
        elif sentiments.count("positive") > 0:
            return "positive"
        return "neutral"

    def run_analysis(self) -> Dict[str, any]:
        self.fetch_serp()
        overall_sentiment = self.analyze_sentiment()
        return {
            "query": self.query,
            "results": self.results,
            "sentiment": overall_sentiment
        }
