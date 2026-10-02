"""Print unit table for a time window: python tab.py t0 t1"""
import common, json, sys
U=json.loads((common.WORK/"align_debug.json").read_text())["units"]
t0,t1=float(sys.argv[1]),float(sys.argv[2])
P=60/150.269; BAR=4*P; OFF=0.1437
for u in U:
    if t0<=u["start"]<=t1:
        print(f"({u['li']},{u['ti']},{u['si']}) {u['part']:6s} start {u['start']:.3f} (b{(u['start']-OFF)/BAR+1:.2f}) ctc {u['ctc_start']:.2f} end {u['end']:.2f} {u['rule']:6s} conf {u['conf']}")
