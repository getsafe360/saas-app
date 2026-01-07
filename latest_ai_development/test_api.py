#!/usr/bin/env python3
"""
Test script for AI Crew API
Run: python test_api.py
"""

import requests
import json
import sys
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000")
API_KEY = os.getenv("API_SECRET_KEY", "your-secret-key-change-in-production")

def test_health():
    """Test health check endpoint"""
    print("\n📊 Testing Health Check...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=10)
        response.raise_for_status()
        data = response.json()
        print(f"✅ Health check passed")
        print(f"   Status: {data['status']}")
        print(f"   Service: {data['service']}")
        print(f"   Version: {data['version']}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_analyze():
    """Test analysis endpoint"""
    print("\n🔍 Testing Website Analysis...")

    test_url = "https://example.com"
    modules = ["seo", "performance"]

    payload = {
        "url": test_url,
        "modules": modules,
        "locale": "en"
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        print(f"   Analyzing: {test_url}")
        print(f"   Modules: {', '.join(modules)}")

        response = requests.post(
            f"{API_URL}/analyze",
            json=payload,
            headers=headers,
            timeout=60
        )
        response.raise_for_status()
        data = response.json()

        print(f"✅ Analysis completed")
        print(f"   Job ID: {data['jobId']}")
        print(f"   URL: {data['url']}")
        print(f"\n📈 Results:")

        for module, result in data['results'].items():
            print(f"\n   {module.upper()}:")
            print(f"     Score: {result['score']}/100 ({result['grade']})")
            print(f"     Issues: {len(result['issues'])}")
            print(f"     Fixes: {len(result['fixes'])}")

            if result['issues']:
                print(f"     Top Issues:")
                for issue in result['issues'][:3]:
                    print(f"       - {issue['title']} [{issue['impact']}]")

        # Save full result to file
        with open('test_analysis_result.json', 'w') as f:
            json.dump(data, f, indent=2)
        print(f"\n   📄 Full result saved to: test_analysis_result.json")

        return True
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response.text}")
        return False

def test_repair_dry_run():
    """Test repair endpoint in dry run mode"""
    print("\n🔧 Testing Repair (Dry Run)...")

    payload = {
        "siteId": "test-site-123",
        "issues": [
            {
                "id": "seo_missing_meta_desc",
                "category": "seo",
                "type": "meta_description",
                "severity": "high"
            },
            {
                "id": "perf_no_compression",
                "category": "performance",
                "type": "compression",
                "severity": "medium"
            }
        ],
        "dryRun": True
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            f"{API_URL}/repair",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        print(f"✅ Repair test completed")
        print(f"   Job ID: {data['jobId']}")
        print(f"   Total Issues: {data['totalIssues']}")
        print(f"   Repaired: {len(data['repaired'])}")
        print(f"   Failed: {len(data['failed'])}")

        if data['repaired']:
            print(f"\n   ✅ Successfully Repaired:")
            for repair in data['repaired']:
                print(f"     - {repair['issueId']} via {repair['method']}")

        if data['failed']:
            print(f"\n   ❌ Failed Repairs:")
            for repair in data['failed']:
                print(f"     - {repair['issueId']}: {repair.get('error', 'Unknown error')}")

        return True
    except Exception as e:
        print(f"❌ Repair test failed: {e}")
        if hasattr(e, 'response'):
            print(f"   Response: {e.response.text}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("🧪 GetSafe360 AI Crew API Test Suite")
    print("=" * 60)
    print(f"\nAPI URL: {API_URL}")
    print(f"API Key: {'*' * 20}{API_KEY[-4:] if len(API_KEY) > 4 else '***'}")

    results = []

    # Test 1: Health Check
    results.append(("Health Check", test_health()))

    # Test 2: Analysis
    results.append(("Website Analysis", test_analyze()))

    # Test 3: Repair (Dry Run)
    results.append(("Repair (Dry Run)", test_repair_dry_run()))

    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)

    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name:.<40} {status}")

    total_tests = len(results)
    passed_tests = sum(1 for _, passed in results if passed)
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")

    if passed_tests == total_tests:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total_tests - passed_tests} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
