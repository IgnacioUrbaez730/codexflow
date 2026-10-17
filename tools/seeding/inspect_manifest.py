import json
import os

manifest_file = os.path.join(os.path.dirname(__file__), "corpus_manifest.json")
assert os.path.exists(manifest_file), f"Manifest file missing: {manifest_file}"

with open(manifest_file, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Organization: {data.get('organization')}")
print(f"Volumes count: {len(data.get('volumes', []))}")
print(f"Folios count: {len(data.get('folios', []))}")

series_count = {}
status_count = {}
stress_count = {}

for f in data.get("folios", []):
    s = f["series"]
    st = f["status"]
    sc = f["stress_case"]
    series_count[s] = series_count.get(s, 0) + 1
    status_count[st] = status_count.get(st, 0) + 1
    stress_count[sc] = stress_count.get(sc, 0) + 1

print("Series:", series_count)
print("Statuses:", status_count)
print("Stress cases:", stress_count)
