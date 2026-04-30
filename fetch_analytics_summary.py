#!/usr/bin/env python3
import subprocess
import json

API_KEY = "788C1419-FB69401D-96E97381-FD75B910"
PROFILE_KEY = "805E0090-79E243F0-8157B77C-42D928FB"

posts = [
    ("XXFG8ILn7BvmxCd1G0yQ", "facebook"),
    ("T6ex8iJfJIR4IhEJZQSW", "tiktok"),
    ("5LnwtzpRIeWyg582kPVg", "twitter"),
    ("Xmu0u27yrVFOeNum1qZC", "youtube"),
    ("O8U9Y0raYsGqeYISpb9x", "linkedin"),
    ("xTxfe9oB2yINiwnopwSx", "instagram"),
    ("l5JGPSvZqjyzddHGgvrR", "facebook"),
    ("WEZcAd7vA1qlen0CIzIO", "tiktok"),
    ("q1npuZWxr1IPFGlDJ1zQ", "twitter"),
    ("uE8YTBva0NSWkN8HH8jC", "youtube"),
    ("5wapDhjp4m73Xaenbz41", "instagram"),
    ("ESsnLLXxoedYYcVAWrr8", "linkedin"),
    ("KIkQsOAmkY4k5xX5Uycv", "tiktok"),
    ("o3KaSx2by9zyKaGNEIQe", "twitter"),
    ("opdHngfkxJw77Y4PY6uv", "youtube"),
    ("ZvM0geQAoILLJ6H2JkIr", "instagram"),
    ("2dLb0NalX6nQngcvw6gB", "linkedin"),
    ("d7eFlODAUFfd7sRxHAUL", "facebook"),
    ("vUPCkSuSh8Tw4NVE1RYN", "tiktok"),
    ("Mfus3fWSJJlhML9QcwNX", "twitter"),
    ("GEXlIMioQSFnA5OFGzqS", "youtube"),
    ("UI0ZL9UUI8NP3FN9mxXM", "instagram"),
    ("kCtoDpF9jwiiQ7dwr1pq", "linkedin"),
    ("2UNuatvCYD2UnThJYeLR", "facebook"),
    ("q47fPnpwDyKwRS3Jlz3o", "tiktok"),
    ("tCUch3091zrA86RTw3Ln", "twitter"),
    ("cRnI2Wgvb0wYTiihlfdh", "youtube"),
    ("GaEllpHcuuI1TFnnEDEy", "instagram"),
    ("RYWTQnaUNLfQ4edgbNkS", "linkedin"),
]

url = "https://api.ayrshare.com/api/analytics/post"
results = []

for i, (post_id, platform) in enumerate(posts, 1):
    data = json.dumps({
        "id": post_id,
        "profileKey": PROFILE_KEY,
        "platforms": [platform]
    })
    
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", url,
         "-H", f"Authorization: Bearer {API_KEY}",
         "-H", "Content-Type: application/json",
         "-d", data],
        capture_output=True,
        text=True
    )
    
    try:
        response = json.loads(result.stdout)
        results.append({
            "post_id": post_id,
            "platform": platform,
            "status": response.get("status", "unknown"),
            "data": response
        })
    except json.JSONDecodeError:
        results.append({
            "post_id": post_id,
            "platform": platform,
            "status": "error",
            "raw": result.stdout
        })

# Save full results
with open("analytics_results_full.json", "w") as f:
    json.dump(results, f, indent=2)

# Print summary with all fields
for r in results:
    print(f"\n{'='*80}")
    print(f"POST: {r['post_id']} | Platform: {r['platform']}")
    print('='*80)
    if r['status'] == 'error':
        print(f"Raw Response: {r['raw']}")
    else:
        print(f"Full JSON: {json.dumps(r['data'], indent=2)}")
    print("---")

print(f"\n\nCompleted {len(posts)} API calls")
print(f"Results saved to analytics_results_full.json")
