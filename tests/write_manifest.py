import sys
import os
import json

# Add tools to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tools")))
from generate_manifest import generate_corpus_manifest

manifest = generate_corpus_manifest()

target_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tools", "seeding", "corpus_manifest.json"))
os.makedirs(os.path.dirname(target_path), exist_ok=True)

with open(target_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"Generated manifest directly at: {target_path}")
print(f"Total folios: {len(manifest['folios'])}")
