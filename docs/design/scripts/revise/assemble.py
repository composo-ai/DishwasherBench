import re, sys
order=['p01_head','p02_pipeline','p03_geometry','p04a_m1_m3','p04b_m4','p04c_m5','p04d_m6','p04e_m7a','p04e_m7b','p04e_m7c','p04f_m8','p04g_m9','p04h_m10','p04i_m11_m13','p05_records','p06_determinism','p07_budget','p08_verification','p09_build','p10_risks','pA_appendices']
out=[]
for n in order:
    s=open(f'parts/{n}.md').read().rstrip('\n')+'\n'
    out.append(s)
doc='\n'.join(out)
doc=re.sub(r'\n{3,}','\n\n',doc)
open('sim-core.new.md','w').write(doc)
print(len(doc), doc.count('\n'))
