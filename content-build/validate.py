#!/usr/bin/env python3
"""Validate content part files for one exam (or all): python3 validate.py [exam]"""
import json, glob, os, sys, re, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
TYPES = {"single", "multi", "yesno", "order", "complete"}


def check_exam(exam):
    errs, warns = [], []
    outline = json.load(open(os.path.join(ROOT, "outlines", f"{exam}.json")))
    objs = {o["id"] for d in outline["domains"] for o in d["objectives"]}
    files = sorted(glob.glob(os.path.join(ROOT, "parts", exam, "*.json")))
    lessons, questions = {}, {}
    for f in files:
        name = os.path.basename(f)
        try:
            data = json.load(open(f))
        except Exception as e:
            errs.append(f"{name}: invalid JSON: {e}")
            continue
        for l in data.get("lessons", []):
            lid = l.get("id")
            if not lid: errs.append(f"{name}: lesson without id"); continue
            if lid in lessons: errs.append(f"{name}: duplicate lesson id {lid}")
            lessons[lid] = (name, l)
            for k in ("objective", "title", "short", "deep", "terms", "trap", "example"):
                if not l.get(k): errs.append(f"{name}: lesson {lid} missing {k}")
            if l.get("objective") not in objs: errs.append(f"{name}: lesson {lid} unknown objective {l.get('objective')}")
            if len(l.get("short", "").split()) > 75: warns.append(f"{name}: lesson {lid} short is long ({len(l['short'].split())} words)")
            for t in l.get("terms", []):
                if not (isinstance(t, dict) and t.get("t") and t.get("d")): errs.append(f"{name}: lesson {lid} bad term {t}")
            dg = l.get("diagram")
            if dg:
                if dg.get("kind") not in ("flow", "stack", "compare", "cycle"): errs.append(f"{name}: lesson {lid} bad diagram kind")
                elif dg["kind"] == "compare":
                    if not dg.get("cols") or not dg.get("rows") or any(len(r) != len(dg["cols"]) for r in dg["rows"]):
                        errs.append(f"{name}: lesson {lid} compare diagram rows/cols mismatch")
                elif not dg.get("items"): errs.append(f"{name}: lesson {lid} diagram without items")
        for q in data.get("questions", []):
            qid = q.get("id")
            if not qid: errs.append(f"{name}: question without id"); continue
            if qid in questions: errs.append(f"{name}: duplicate question id {qid}")
            questions[qid] = (name, q)
            t = q.get("type")
            if t not in TYPES: errs.append(f"{name}: {qid} bad type {t}"); continue
            if not q.get("stem"): errs.append(f"{name}: {qid} no stem")
            if not q.get("explain"): errs.append(f"{name}: {qid} no explain")
            if q.get("objective") not in objs: errs.append(f"{name}: {qid} unknown objective {q.get('objective')}")
            if q.get("difficulty") not in (1, 2, 3): errs.append(f"{name}: {qid} bad difficulty")
            opts, ans = q.get("options"), q.get("answer")
            if t == "single" or t == "complete":
                if not opts or len(opts) != 4: errs.append(f"{name}: {qid} {t} needs 4 options")
                if not isinstance(ans, list) or len(ans) != 1: errs.append(f"{name}: {qid} {t} needs 1 answer")
            if t == "complete":
                code = q.get("code") or ""
                if code.count("____") != 1: errs.append(f"{name}: {qid} complete needs exactly one ____ in code")
            if t == "multi":
                if not opts or not 4 <= len(opts) <= 5: errs.append(f"{name}: {qid} multi needs 4-5 options")
                if not isinstance(ans, list) or not 2 <= len(ans) <= 3: errs.append(f"{name}: {qid} multi needs 2-3 answers")
            if t in ("single", "complete", "multi") and isinstance(ans, list) and opts:
                if any((not isinstance(a, int)) or a < 0 or a >= len(opts) for a in ans): errs.append(f"{name}: {qid} answer index out of range")
                if len(set(opts)) != len(opts): errs.append(f"{name}: {qid} duplicate options")
            if t == "yesno":
                st = q.get("statements")
                if not st or len(st) != 3 or any(not isinstance(s.get("a"), bool) or not s.get("s") for s in st):
                    errs.append(f"{name}: {qid} yesno needs 3 statements with boolean a")
            if t == "order":
                if not opts or not 3 <= len(opts) <= 5: errs.append(f"{name}: {qid} order needs 3-5 steps")
            if opts and any(len(o) > 140 for o in opts): warns.append(f"{name}: {qid} long option")
    for qid, (name, q) in questions.items():
        if q.get("lesson") not in lessons: errs.append(f"{name}: {qid} links unknown lesson {q.get('lesson')}")
    # coverage
    covered = collections.Counter(l["objective"] for _, l in lessons.values())
    missing = [o for o in sorted(objs) if covered[o] == 0]
    types = collections.Counter(q["type"] for _, q in questions.values() if q.get("type"))
    pos = collections.Counter(q["answer"][0] for _, q in questions.values() if q.get("type") == "single" and isinstance(q.get("answer"), list) and q["answer"])
    print(f"== {exam}: {len(files)} files, {len(lessons)} lessons, {len(questions)} questions {dict(types)}; single-answer positions {dict(sorted(pos.items()))}")
    if missing: print(f"   objectives with no lessons yet: {', '.join(missing)}")
    for w in warns[:30]: print("   warn:", w)
    for e in errs: print("   ERROR:", e)
    return len(errs)


if __name__ == "__main__":
    exams = sys.argv[1:] or sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "parts", "*")))
    bad = sum(check_exam(e) for e in exams)
    sys.exit(1 if bad else 0)
