#!/usr/bin/env python3
"""Merge content-build/parts/<exam>/*.json into public/hoops/content/<exam>.json for the game."""
import json, glob, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "public", "hoops", "content")
os.makedirs(OUT, exist_ok=True)

exams = sys.argv[1:] or sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "parts", "*")))
index = []
for exam in exams:
    outline = json.load(open(os.path.join(ROOT, "outlines", f"{exam}.json")))
    order = {}
    for di, d in enumerate(outline["domains"]):
        for oi, o in enumerate(d["objectives"]):
            order[o["id"]] = (di, oi)
    lessons, questions = {}, {}
    for f in sorted(glob.glob(os.path.join(ROOT, "parts", exam, "*.json"))):
        data = json.load(open(f))
        for l in data.get("lessons", []):
            lessons[l["id"]] = l
        for q in data.get("questions", []):
            questions[q["id"]] = q
    ls = sorted(lessons.values(), key=lambda l: (order.get(l["objective"], (99, 99)), l.get("seq", 0), l["id"]))
    qs = [q for q in questions.values() if q.get("lesson") in lessons]
    qs.sort(key=lambda q: (order.get(q["objective"], (99, 99)), q["id"]))
    pack = {
        "id": exam,
        "code": outline.get("code"),
        "name": outline.get("name"),
        "issuer": outline.get("issuer"),
        "outlineVersion": outline.get("outlineVersion"),
        "sourceUrl": outline.get("sourceUrl"),
        # Domains with no lessons are left out so mastery is measured on what is taught.
        "domains": [
            {"id": d["id"], "name": d["name"], "weight": d.get("weight"),
             "objectives": [{"id": o["id"], "name": o["name"]} for o in d["objectives"]]}
            for d in outline["domains"]
            if any(l["objective"] in {o["id"] for o in d["objectives"]} for l in ls)
        ],
        "lessons": ls,
        "questions": qs,
    }
    path = os.path.join(OUT, f"{exam}.json")
    with open(path, "w") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    index.append({"id": exam, "lessons": len(ls), "questions": len(qs)})
    print(f"{exam}: {len(ls)} lessons, {len(qs)} questions -> {os.path.relpath(path)} ({os.path.getsize(path)//1024} KB)")
json.dump(index, open(os.path.join(OUT, "index.json"), "w"))
