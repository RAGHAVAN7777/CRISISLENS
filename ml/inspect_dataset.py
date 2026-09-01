"""
Step 1 (Final): Download final_label_image.zip directly from HF Hub
and inspect the actual file/folder structure inside it.
"""

import os
import zipfile
from huggingface_hub import hf_hub_download

REPO = "Rayford295/BiTemporal-StreetView-Damage"
FILENAME = "final_label_image.zip"
OUT_DIR = "ml/raw_dataset"

print("=" * 60)
print(f"Downloading {FILENAME} from {REPO} ...")
print("=" * 60)

zip_path = hf_hub_download(
    repo_id=REPO,
    filename=FILENAME,
    repo_type="dataset",
    local_dir=OUT_DIR,
)
print(f"Downloaded to: {zip_path}")

# ── Extract ───────────────────────────────────────────────────────────────────
extract_dir = os.path.join(OUT_DIR, "extracted")
os.makedirs(extract_dir, exist_ok=True)

print(f"\nExtracting to: {extract_dir}")
with zipfile.ZipFile(zip_path, "r") as zf:
    names = zf.namelist()
    print(f"Total files in zip: {len(names)}")
    zf.extractall(extract_dir)

# ── Walk the directory tree ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("DIRECTORY STRUCTURE (first 80 entries)")
print("=" * 60)

count = 0
extensions = {}
for root, dirs, files in os.walk(extract_dir):
    dirs.sort()
    rel_root = os.path.relpath(root, extract_dir)
    depth = rel_root.count(os.sep)
    indent = "  " * depth
    print(f"{indent}[DIR] {os.path.basename(root)}/")
    for f in sorted(files):
        ext = os.path.splitext(f)[1].lower()
        extensions[ext] = extensions.get(ext, 0) + 1
        if count < 80:
            print(f"{indent}  {f}")
        count += 1

print(f"\nTotal files: {count}")
print(f"Extensions breakdown: {extensions}")

# ── Try to figure out label structure from folder names ───────────────────────
print("\n" + "=" * 60)
print("TOP-LEVEL FOLDERS (potential label structure)")
print("=" * 60)
top_items = sorted(os.listdir(extract_dir))
for item in top_items:
    full = os.path.join(extract_dir, item)
    if os.path.isdir(full):
        sub = os.listdir(full)
        print(f"  {item}/  ({len(sub)} items)")
        for s in sorted(sub)[:10]:
            s_full = os.path.join(full, s)
            if os.path.isdir(s_full):
                print(f"    {s}/  ({len(os.listdir(s_full))} files)")
            else:
                print(f"    {s}")
    else:
        print(f"  {item}  ({os.path.getsize(full)} bytes)")

print("\nINSPECTION COMPLETE")
