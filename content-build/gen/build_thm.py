"""Build THM AI1 part files from the generator modules, balancing correct-answer positions."""
import json, os, sys, importlib, random

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, "..", "parts", "thm-ai1")


def balance(questions, seed):
    rng = random.Random(seed)
    k = 0
    for q in questions:
        if q["type"] in ("single", "complete"):
            opts, a = q["options"], q["answer"][0]
            target = k % len(opts)
            k += 1
            order = [i for i in range(len(opts)) if i != a]
            rng.shuffle(order)
            order.insert(target, a)
            q["options"] = [opts[i] for i in order]
            q["answer"] = [target]
        elif q["type"] == "multi":
            opts, ans = q["options"], set(q["answer"])
            perm = list(range(len(opts)))
            rng.shuffle(perm)
            q["options"] = [opts[i] for i in perm]
            q["answer"] = sorted(perm.index(i) for i in ans)
    return questions


def build(domain):
    L = importlib.import_module(f"thm_{domain}_lessons").LESSONS
    Q = balance(importlib.import_module(f"thm_{domain}_questions").Q, seed=domain)
    half = (len(Q) + 1) // 2
    for n, (ls, qs) in enumerate([(L, Q[:half]), ([], Q[half:])], 1):
        path = os.path.join(OUT, f"{domain}-{n}.json")
        json.dump({"exam": "thm-ai1", "domain": domain, "lessons": ls, "questions": qs},
                  open(path, "w"), indent=1, ensure_ascii=False)
    print(domain, len(L), "lessons", len(Q), "questions")


if __name__ == "__main__":
    for d in sys.argv[1:]:
        build(d)
