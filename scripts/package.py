#!/usr/bin/env python3
"""Package a mini-tool dist directory into a ZIP with index.html at the root."""

import os
import sys
import zipfile

ALLOWED_EXTENSIONS = {
    ".html", ".css", ".js", ".json",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".woff", ".woff2",
}

IGNORED_DIRS = {"__MACOSX", ".git", "node_modules"}
IGNORED_NAMES = {".DS_Store"}


def fail(message):
    print("ERROR: " + message, file=sys.stderr)
    raise SystemExit(1)


def main():
    if len(sys.argv) != 3:
        fail("usage: python3 scripts/package.py <dist-directory> <output-zip>")

    src = os.path.realpath(sys.argv[1])
    out = os.path.realpath(sys.argv[2])

    if not os.path.isdir(src):
        fail("source directory not found: " + src)
    if not os.path.isfile(os.path.join(src, "index.html")):
        fail("index.html must exist at the root of " + src)
    if out == src or out.startswith(src + os.sep):
        fail("output ZIP must be outside the dist directory")

    files = []
    for root, dirs, names in os.walk(src):
        dirs[:] = sorted(
            name for name in dirs
            if name not in IGNORED_DIRS and not name.startswith(".")
        )
        for name in sorted(names):
            if name in IGNORED_NAMES or name.startswith("._") or name.startswith("."):
                continue
            path = os.path.join(root, name)
            if os.path.islink(path):
                fail("symbolic links are not allowed: " + os.path.relpath(path, src))
            if name.endswith(".map"):
                fail("source maps must not be packaged: " + os.path.relpath(path, src))
            extension = os.path.splitext(name)[1].lower()
            if extension not in ALLOWED_EXTENSIONS:
                fail("unsupported file type in dist: " + os.path.relpath(path, src))
            arcname = os.path.relpath(path, src).replace(os.sep, "/")
            files.append((path, arcname))

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, arcname in files:
            archive.write(path, arcname)

    size = os.path.getsize(out)
    print("wrote " + out)
    print("files: " + str(len(files)))
    print("size: " + str(size) + " bytes")
    for _, arcname in files:
        print("  " + arcname)


if __name__ == "__main__":
    main()
