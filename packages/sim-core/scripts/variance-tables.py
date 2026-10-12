#!/usr/bin/env python3
"""Tables of the variance study from the JSON lines of study.ts.

  variance-tables.py seeds <tier> file.jsonl [file.jsonl ...]        seed-flip table (level x sim seeds)
  variance-tables.py tiers fileA(official) ... -- fileB(fast) ...    tier agreement
  variance-tables.py flip base.jsonl ... -- flipped.jsonl ...        untouched-item test
  variance-tables.py cost file.jsonl ...                             timings
  variance-tables.py exposure a.jsonl -- b.jsonl                     where the water of each basket comes from (--summary)
"""
import json, sys, re, itertools, statistics

def load(files):
    runs = []
    for f in files:
        for line in open(f):
            line = line.strip()
            if line:
                run = json.loads(line)
                run['means'] = means_of(run)
                runs.append(run)
    return runs

def soiled(run):
    return {k: v for k, v in run['items'].items() if v['i'] > 0}

def cls(t):
    if re.match(r'^melamine_', t): return 'melamine'
    if re.match(r'^saucepan_', t): return 'pots'
    if re.match(r'^(test_glass|dessert_bowl_vitrelle|glass_bowl)', t): return 'glass'
    if re.search(r'(fork|knife|spoon|ladle)', t): return 'cutlery'
    if re.search(r'(plate|platter|mug|cup|saucer)', t): return 'crockery'
    return 'other'

def typ(i): return re.sub(r'_\d+$', '', i)

# Items of each catalogue type in the standard load of 13 place settings (standards 5.1), the
# weights of the class means (as packages/calibration/anchors/src/literature.ts).
STANDARD = {
    'dinner_plate_porcelain_iec': 7, 'dessert_plate_porcelain_190': 7, 'mug_ceramic_300': 7,
    'dessert_bowl_vitrelle_130': 7, 'soup_plate_porcelain_230': 6, 'tea_cup_porcelain_210': 6,
    'saucer_porcelain_140': 6, 'melamine_dessert_plate_iec_195': 6,
    'test_glass_borosilicate_250': 13, 'dinner_knife_210': 13, 'dinner_fork_185': 13,
    'soup_spoon_190': 13, 'dessert_spoon_160': 13, 'teaspoon_130': 13, 'serving_spoon_216': 2,
    'serving_fork_210': 1, 'ladle_steel_311': 1, 'oval_platter_porcelain_320': 1,
    'glass_bowl_180': 1, 'melamine_bowl_iec_213': 2, 'saucepan_steel_170': 1,
    'saucepan_clad_2qt': 1,
}

def means_of(run):
    """Class means of whole-number scores, item types weighted as in the standard load, and
    the plain mean over the items of the load."""
    by_type = {}
    for v in run['items'].values():
        by_type.setdefault(v['t'], []).append(v['s'])
    weight, total = {}, {}
    for t, scores in by_type.items():
        c = cls(t)
        if c == 'other': continue
        n = STANDARD.get(t, 0)
        for key in (c, 'all'):
            weight[key] = weight.get(key, 0) + n
            total[key] = total.get(key, 0) + n * sum(scores) / len(scores)
    score = {k: (total[k] / weight[k] if weight[k] > 0 else float('nan')) for k in weight}
    for k in ('crockery', 'cutlery', 'glass', 'melamine', 'all'): score.setdefault(k, float('nan'))
    everything = [v['s'] for v in run['items'].values()]
    return {'score': score, 'raw': {'all': sum(everything) / len(everything)}}

def differ(a, b):
    sa, sb = soiled(a), soiled(b)
    scores = sum(1 for k in sa if k in sb and sa[k]['s'] != sb[k]['s'])
    flipped = [k for k in sa if k in sb and sa[k]['c'] != sb[k]['c']]
    return scores, flipped

def bytype(ids):
    c = {}
    for i in ids: c[typ(i)] = c.get(typ(i), 0) + 1
    return ', '.join(f'{k} {v}' for k, v in sorted(c.items(), key=lambda kv: -kv[1])) or 'none'

def seeds(tier, files):
    runs = [r for r in load(files) if r['tier'] == tier]
    runs.sort(key=lambda r: (r['simSeed'], r['levelSeed']))
    n = len(soiled(runs[0]))
    print(f'| Simulation seed | Level seed | Mean score | Mean, standard weights | Items clean | Soiled items clean (of {n}) | Crockery | Cutlery | Glass | Melamine |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for r in runs:
        m = r['means']
        print(f"| {r['simSeed']} | {r['levelSeed']} | {m['raw']['all']:.3f} | {m['score']['all']:.3f} | {r['clean']} | {r['soiledClean']} | {m['score']['crockery']:.2f} | {m['score']['cutlery']:.2f} | {m['score']['glass']:.2f} | {m['score']['melamine']:.2f} |")
    def pairs(same):
        sc, ve, by = [], [], {}
        for a, b in itertools.combinations(runs, 2):
            if not same(a, b): continue
            s, f = differ(a, b)
            sc.append(s); ve.append(len(f))
            for i in f: by[i] = by.get(i, 0) + 1
        return sc, ve, by
    rng = lambda v: f'{statistics.mean(v):.1f}, {min(v)} to {max(v)}' if v else 'n/a'
    for name, same in (('Simulation seed only', lambda a, b: a['levelSeed'] == b['levelSeed'] and a['simSeed'] != b['simSeed']),
                       ('Level seed only', lambda a, b: a['simSeed'] == b['simSeed'] and a['levelSeed'] != b['levelSeed'])):
        sc, ve, by = pairs(same)
        print(f'{name}: {len(sc)} pairs; scores that differ {rng(sc)} of {n}; verdicts that flip {rng(ve)}; distinct items {len(by)} ({bytype(by.keys())})')
    # unstable per level seed
    levels = sorted(set(r['levelSeed'] for r in runs))
    un = {}
    for l in levels:
        g = [r for r in runs if r['levelSeed'] == l]
        s0 = soiled(g[0])
        for k in s0:
            if any(soiled(r)[k]['c'] != s0[k]['c'] for r in g): un[k] = un.get(k, 0) + 1
    print(f'Soiled items whose verdict is not the same at every simulation seed: {sum(un.values())/max(len(levels),1):.1f} of {n} at one level seed on average; {len(un)} distinct ({bytype(un.keys())})')
    print('  ' + ', '.join(f'{k} {v}' for k, v in sorted(un.items(), key=lambda kv: (-kv[1], kv[0]))))
    al = [r['means']['raw']['all'] for r in runs]
    print(f"Load mean {statistics.mean(al):.3f} (sd {statistics.pstdev(al):.3f}); soiled clean {min(r['soiledClean'] for r in runs)} to {max(r['soiledClean'] for r in runs)} (mean {statistics.mean(r['soiledClean'] for r in runs):.1f})")
    # residual scatter: per item sd of residue / initial over sim seeds at fixed level seed
    worst = []
    for l in levels:
        g = [r for r in runs if r['levelSeed'] == l]
        for k, v in soiled(g[0]).items():
            rs = [soiled(r)[k]['r'] / v['i'] for r in g]
            worst.append((max(rs) - min(rs), k, l))
    worst.sort(reverse=True)
    print('Largest spread of residue over simulation seeds (share of initial soil): ' + ', '.join(f'{k}@L{l} {100*d:.1f}%' for d, k, l in worst[:8]))

def tiers(fa, fb):
    A = {(r['levelSeed'], r['simSeed']): r for r in load(fa) if r['tier'] == 'official'}
    B = {(r['levelSeed'], r['simSeed']): r for r in load(fb) if r['tier'] == 'fast'}
    print('| Level seed | Simulation seed | Official: mean, std weights; soiled clean | Fast: mean, std weights; soiled clean | Verdicts that agree | Class means official (crockery/cutlery/glass/melamine) | Class means fast | Largest class difference | Flipped |')
    print('|---|---|---|---|---|---|---|---|---|')
    agree = []
    for key in sorted(set(A) & set(B)):
        a, b = A[key], B[key]
        s, f = differ(a, b)
        n = len(soiled(a))
        ca = [a['means']['score'][c] for c in ('crockery', 'cutlery', 'glass', 'melamine')]
        cb = [b['means']['score'][c] for c in ('crockery', 'cutlery', 'glass', 'melamine')]
        d = max(abs(x - y) for x, y in zip(ca, cb))
        agree.append((n - len(f)) / n)
        print(f"| {key[0]} | {key[1]} | {a['means']['raw']['all']:.3f}, {a['means']['score']['all']:.3f}; {a['soiledClean']} | {b['means']['raw']['all']:.3f}, {b['means']['score']['all']:.3f}; {b['soiledClean']} | {n-len(f)} of {n} ({100*(n-len(f))/n:.0f} %) | {' / '.join(f'{x:.2f}' for x in ca)} | {' / '.join(f'{x:.2f}' for x in cb)} | {d:.2f} | {bytype(f)} |")
    if agree: print(f'Agreement {100*min(agree):.0f} to {100*max(agree):.0f} % (mean {100*statistics.mean(agree):.0f} %)')
    # residue by type
    for key in sorted(set(A) & set(B))[:1]:
        a, b = A[key], B[key]
        ta, tb = {}, {}
        for k, v in soiled(a).items(): ta[typ(k)] = ta.get(typ(k), 0) + v['r']
        for k, v in soiled(b).items(): tb[typ(k)] = tb.get(typ(k), 0) + v['r']
        print('Residue by type, mg (official / fast): ' + ', '.join(f'{t} {ta[t]:.1f} / {tb.get(t, 0):.1f}' for t in sorted(ta)))

def flip(fa, fb):
    A = {(r['tier'], r['levelSeed'], r['simSeed']): r for r in load(fa)}
    B = {(r['tier'], r['levelSeed'], r['simSeed']): r for r in load(fb)}
    for key in sorted(set(A) & set(B)):
        a, b = A[key], B[key]
        turned = set(b['flipped'])
        rows = []
        for k, v in soiled(a).items():
            if k in turned: continue
            w = soiled(b)[k]
            d = (w['r'] - v['r']) / v['i']
            rows.append((abs(d), k, v, w, d))
        rows.sort(key=lambda x: (-x[0], x[1]))
        over = [r for r in rows if r[0] >= 0.02]
        sc = [r for r in rows if r[2]['s'] != r[3]['s']]
        ve = [r for r in rows if r[2]['c'] != r[3]['c']]
        print(f"{key}: turned {sorted(turned)}; untouched soiled items {len(rows)}; residue changed by 2 % of the initial soil or more: {len(over)}; scores changed {len(sc)}; verdicts changed {len(ve)}")
        for r in rows[:12]:
            if r[0] == 0: break
            print(f"   {r[1]:<18} residue {r[2]['r']:.2f} -> {r[3]['r']:.2f} of {r[2]['i']:.0f} mg ({100*r[4]:+.2f} %), score {r[2]['s']} -> {r[3]['s']}, clean {r[2]['c']} -> {r[3]['c']}")
        print(f"   identical residue (to 0.0001 mg): {sum(1 for r in rows if r[2]['r'] == r[3]['r'])} of {len(rows)}; scores changed: {', '.join(r[1] for r in sc) or 'none'}")

def cost(files):
    for r in load(files):
        t = r['timings']
        print(f"{r['tag']} {r['tier']} L{r['levelSeed']} S{r['simSeed']}: {r['seconds']} s; " + ', '.join(f'{k} {v/1000:.1f}' for k, v in t.items()) + f"; computed {r['computed']}; blocks {r['blocks']}; rss {r['rssMb']} MB")

if __name__ == '__main__':
    mode = sys.argv[1]
    rest = sys.argv[2:]
    if mode == 'seeds': seeds(rest[0], rest[1:])
    elif mode == 'tiers':
        i = rest.index('--'); tiers(rest[:i], rest[i+1:])
    elif mode == 'flip':
        i = rest.index('--'); flip(rest[:i], rest[i+1:])
    elif mode == 'cost': cost(rest)


def groups_of(run):
    """The soiled items of a wash by where they stand: lower-basket crockery, cutlery, upper basket."""
    out = {'lower-basket crockery': [], 'cutlery': [], 'upper basket': []}
    for k, v in soiled(run).items():
        t = v['t']
        if cls(t) == 'cutlery': out['cutlery'].append(k)
        elif re.search(r'(dinner_plate|dessert_plate|soup_plate|saucer|platter)', t) and not t.startswith('melamine'): out['lower-basket crockery'].append(k)
        else: out['upper basket'].append(k)
    return out


def exposure(fa, fb):
    """Where each group's water comes from in each spray state, wash A against wash B
    (lines written with --summary): share of the time under a direct jet, wet time, water
    received and liquor exchange on the soiled regions, and the mean score."""
    A = {(r['tier'], r['levelSeed'], r['simSeed']): r for r in load(fa)}
    B = {(r['tier'], r['levelSeed'], r['simSeed']): r for r in load(fb)}
    for key in sorted(set(A) & set(B)):
        a, b = A[key], B[key]
        print(f'{key}: A {a["tag"]}, B {b["tag"]}')
        print('| Group | Items | Spray state (s in A) | Jet share A > B | Wet time A > B | Water received g/(m2 s) A > B | Exchange 1/s A > B | Never wet in the state A > B | Mean score A > B |')
        print('|---|---|---|---|---|---|---|---|---|')
        for name, ids in groups_of(a).items():
            ids = [i for i in ids if 'x' in a['items'][i] and i in b['items'] and 'x' in b['items'][i]]
            if not ids: continue
            sa = statistics.mean(a['items'][i]['s'] for i in ids); sb = statistics.mean(b['items'][i]['s'] for i in ids)
            states = a['states']
            for k, st in enumerate(states):
                def mean(run, f):
                    tot = sum(run['items'][i]['x']['area'] for i in ids)
                    return sum(run['items'][i]['x']['states'][k][f] * run['items'][i]['x']['area'] for i in ids) / tot
                print(f"| {name} | {len(ids)} | {st['id']} ({st['duration']:.0f}) | {100*mean(a,'jet'):.2f} % > {100*mean(b,'jet'):.2f} % | {mean(a,'wet'):.3f} > {mean(b,'wet'):.3f} | {1000*mean(a,'flux'):.1f} > {1000*mean(b,'flux'):.1f} | {mean(a,'exch'):.2f} > {mean(b,'exch'):.2f} | {100*mean(a,'dry'):.1f} % > {100*mean(b,'dry'):.1f} % | {sa:.2f} > {sb:.2f} |")


if __name__ == '__main__' and sys.argv[1] == 'exposure':
    rest = sys.argv[2:]
    i = rest.index('--'); exposure(rest[:i], rest[i+1:])
