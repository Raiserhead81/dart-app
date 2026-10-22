#!/usr/bin/env python3
"""Fuegt den DartPro-Eintrag in den gemivo App-Store ein (apps-data.js UND apps-data-v2.js).
Idempotent, verifiziert danach die JSON-Struktur beider Dateien.
Ausfuehren auf dem gemivo-Server (Kay-Freigabe vorausgesetzt):
    python3 /opt/dart-app-store/store-add.py
"""
import json

ENTRY_PATH = "/opt/dart-app-store/store-entry-dart-app.json"
FILES = [
    "/var/www/html/store/assets/apps-data.js",
    "/var/www/html/store/assets/apps-data-v2.js",
]

entry = json.load(open(ENTRY_PATH, encoding="utf-8"))

for p in FILES:
    s = open(p, encoding="utf-8").read()
    if '"slug": "dart-app"' in s:
        print("schon drin:", p)
        continue
    idx = s.rstrip().rfind("]")
    blob = json.dumps(entry, ensure_ascii=False, indent=2)
    s2 = s[:idx].rstrip().rstrip(",") + ",\n" + blob + "\n" + s[idx:]
    arr = json.loads(s2[s2.find("["): s2.rfind("]") + 1])  # Struktur-Check VOR dem Schreiben
    hits = [a for a in arr if a.get("slug") == "dart-app"]
    assert hits and hits[0]["category"] == "Spiele" and hits[0]["apk"]
    open(p, "w", encoding="utf-8").write(s2)
    print(p.split("/")[-1], "-> apps:", len(arr), "| dart-app ok")
print("fertig — Store: https://gemivo.de/store/")
