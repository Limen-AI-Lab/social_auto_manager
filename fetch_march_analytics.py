#!/usr/bin/env python3
"""
Fetch analytics for all successful March 2026 posts.
"""
import subprocess, json, time, sys

API_KEY = '788C1419-FB69401D-96E97381-FD75B910'
PROFILE_KEY = '805E0090-79E243F0-8157B77C-42D928FB'

# Load March history
with open('history_march.json') as f:
    history = json.load(f)['history']

# Get successful posts only
success_posts = [p for p in history if p.get('status') == 'success']
print(f'Total successful posts: {len(success_posts)}')

# Group by post (same timestamp = same content, different platforms)
from collections import defaultdict
by_timestamp = defaultdict(list)
for p in success_posts:
    by_timestamp[p['created'][:16]].append(p)

print(f'Unique posts (by timestamp): {len(by_timestamp)}')

# Sort by timestamp descending
timestamps = sorted(by_timestamp.keys(), reverse=True)

# Try to fetch analytics for all posts
results = []
total = len(success_posts)
errors = 0

for i, post in enumerate(success_posts):
    pid = post['id']
    platform = post['platforms'][0] if post.get('platforms') else 'unknown'

    url = 'https://api.ayrshare.com/api/analytics/post'
    data = json.dumps({'id': pid, 'profileKey': PROFILE_KEY, 'platforms': [platform]})

    result = subprocess.run(
        ['curl', '-s', '-X', 'POST', url,
         '-H', f'Authorization: Bearer {API_KEY}',
         '-H', 'Content-Type: application/json',
         '-d', data],
        capture_output=True, text=True, timeout=60
    )

    try:
        response = json.loads(result.stdout)
        status = response.get('status', 'unknown')
        results.append({
            'post_id': pid,
            'platform': platform,
            'created': post.get('created', ''),
            'post_text': post.get('post', ''),
            'status': status,
            'data': response
        })
        if status == 'success':
            print(f'  [{i+1}/{total}] OK {platform} {pid[:12]}...')
        else:
            print(f'  [{i+1}/{total}] ERR {platform} {pid[:12]}... ({status})')
            errors += 1
    except Exception as e:
        results.append({
            'post_id': pid,
            'platform': platform,
            'created': post.get('created', ''),
            'status': 'parse_error',
            'error': str(e)
        })
        print(f'  [{i+1}/{total}] FAIL {platform} {pid[:12]}... ({e})')
        errors += 1

    time.sleep(0.1)  # Rate limit protection

print(f'\nDone: {len(results)} results, {errors} errors')
with open('analytics_march_full.json', 'w') as f:
    json.dump(results, f, indent=2)
print('Saved to analytics_march_full.json')
