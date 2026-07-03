#!/usr/bin/env python3
"""Extract archive zip; normalizes Windows backslash paths for Linux CI."""
import os
import sys
import zipfile


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-archive-zip.py ZIP_PATH DEST_DIR", file=sys.stderr)
        return 1

    zip_path, dest = sys.argv[1], sys.argv[2]
    os.makedirs(dest, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/")
            if name.endswith("/"):
                os.makedirs(os.path.join(dest, name), exist_ok=True)
                continue
            target = os.path.join(dest, name)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as out:
                out.write(src.read())

    print(f"Extracted to {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
