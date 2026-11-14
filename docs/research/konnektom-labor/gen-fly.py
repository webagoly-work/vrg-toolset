import pandas as pd, numpy as np, json, zlib, base64, sys
D=sys.argv[1]; OUT=sys.argv[2]
a=pd.read_csv(D+'/ann.tsv',sep='\t',low_memory=False)
a['cell_type']=a.cell_type.fillna('?'+a.ito_lee_hemilineage.fillna(a.super_class))
# group = cell_type
g=a.groupby('cell_type')
types=list(g.size().sort_values(ascending=False).index)
tid={t:i for i,t in enumerate(types)}
a['gid']=a.cell_type.map(tid)
SC=['optic','central','sensory','visual_projection','ascending','descending','sensory_ascending','visual_centrifugal','motor','endocrine']
NT=['acetylcholine','glutamate','gaba','dopamine','serotonin','octopamine']
grp=[]
for t in types:
    s=a[a.cell_type==t] if False else None
gs=a.groupby('gid')
size=gs.size().values
sc=gs.super_class.agg(lambda x:x.mode().iloc[0]).values
cc=gs.cell_class.agg(lambda x:(x.dropna().mode().iloc[0] if x.notna().any() else '')).values
nt=gs.top_nt.agg(lambda x:(x.dropna().mode().iloc[0] if x.notna().any() else '')).values
side=gs.side.agg(lambda x:''.join(sorted(set(str(v)[0] for v in x.dropna())))).values
print('groups',len(types))
# connectivity
c=pd.read_parquet(D+'/conn.parquet',columns=['Presynaptic_ID','Postsynaptic_ID','Connectivity','Excitatory'])
rid2g=pd.Series(a.gid.values,index=a.root_id.values)
c['gs']=rid2g.reindex(c.Presynaptic_ID.values).values
c['gd']=rid2g.reindex(c.Postsynaptic_ID.values).values
print('unmapped',c.gs.isna().sum(),c.gd.isna().sum())
c=c.dropna(subset=['gs','gd'])
c['w']=c.Connectivity*c.Excitatory
e=c.groupby(['gs','gd']).agg(w=('w','sum'),n=('Connectivity','sum')).reset_index()
print('group edges',len(e),'total syn',c.Connectivity.sum())
e['gs']=e.gs.astype(int); e['gt']=e.gd.astype(int)
e=e[e.gs!=e['gt']]
# per-neuron input: w / size(target)
e['wn']=e.w/size[e['gt'].values]
e['abs']=e.wn.abs()
K=int(sys.argv[3]) if len(sys.argv)>3 else 20
e=e.sort_values(['gt','abs'],ascending=[True,False])
e=e.groupby('gt').head(K)
# also make sure strong outputs of sensory groups kept: add top out-edges per source
print('kept',len(e))
# quantize: log scale signed int8: q = sign*round(16*log2(1+abs*4)) clipped 127
q=np.sign(e.wn.values)*np.minimum(127,np.round(16*np.log2(1+e['abs'].values*4)))
e['q']=q.astype(np.int8)
e=e[e.q!=0]
e=e.sort_values(['gs','gt'])
src=e.gs.values.astype(np.uint16); dst=e['gt'].values.astype(np.uint16); qq=e.q.values.astype(np.int8)
print('edges final',len(e))
# positions in um
x=(a.pos_x.values*4/1000.); y=(a.pos_y.values*4/1000.); z=(a.pos_z.values*40/1000.)
lo=[x.min(),y.min(),z.min()]; hi=[x.max(),y.max(),z.max()]
qx=np.round((x-lo[0])/(hi[0]-lo[0])*255).astype(np.uint8)
qy=np.round((y-lo[1])/(hi[1]-lo[1])*255).astype(np.uint8)
qz=np.round((z-lo[2])/(hi[2]-lo[2])*255).astype(np.uint8)
order=np.argsort(a.gid.values,kind='stable')
gidv=a.gid.values[order].astype(np.uint16)
pos=np.stack([qx[order],qy[order],qz[order]],1).astype(np.uint8)
def b64z(arr): return base64.b64encode(zlib.compress(arr.tobytes(),9)).decode()
# neurons sorted by group -> store per-group counts (size) so gid implicit
meta={'n':int(len(a)),'syn':int(c.Connectivity.sum()),'conn':int(len(c)),'lo':lo,'hi':hi,
 'types':types,'size':size.tolist(),'sc':[SC.index(s) for s in sc],'cc':cc.tolist(),'nt':[NT.index(s) if s in NT else -1 for s in nt],'side':side.tolist(),
 'pos':b64z(pos),'es':b64z(src),'ed':b64z(dst),'eq':b64z(qq),'ne':int(len(e)),'SC':SC,'NT':NT}
s='window.FLY='+json.dumps(meta,separators=(',',':'))+';'
open(OUT,'w').write(s)
print('bytes',len(s), 'pos',len(meta['pos']),'edges',len(meta['es'])+len(meta['ed'])+len(meta['eq']),'types json',len(json.dumps(types)))
