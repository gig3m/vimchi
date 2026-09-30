import json,re
sols=json.load(open('solutions.json'))
by={}
for s in sols: by.setdefault((s['n'],s['id'],tuple(s['chips'])),[]).append(s['sol'])
def norm(c):
    c=c.replace('␣','<Space>')
    m=re.fullmatch(r'(.*?)C-(\w|\^)(.*)',c)
    parts=c.split(' ')
    out=''
    for p in parts:
        p=re.sub(r'\bC-(.)',lambda m:'<C-'+m.group(1)+'>',p)
        p=re.sub(r'\bS-tab',"<S-Tab>",p)
        p={'esc':'<Esc>','CR':'<CR>','tab':'<Tab>','enter':'<CR>'}.get(p,p)
        out+=p
    return out
for (n,i,chips),ss in by.items():
    joined=' | '.join(ss)
    miss=[]
    for c in chips:
        k=norm(c)
        alt=[k, k.replace('<Space>',' ')]
        if not any(a in s for s in ss for a in alt): miss.append(c+'→'+k)
    # count rounds using chips
    used=sum(1 for s in ss if any(norm(c) in s or norm(c).replace('<Space>',' ') in s for c in chips))
    if miss or used<len(ss): print(n,i,'MISSING',miss,'rounds_using_any_chip',used,'/',len(ss))
