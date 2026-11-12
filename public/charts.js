/* ---------- tooltip ---------- */
const tipEl=$('#tip');
function tip(html,x,y){tipEl.innerHTML=html;tipEl.hidden=false;const r=tipEl.getBoundingClientRect();
  tipEl.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x+12))+'px';tipEl.style.top=Math.max(8,y-r.height-10)+'px'}
const untip=()=>{tipEl.hidden=true};
document.addEventListener('pointermove',e=>{const t=e.target.closest?.('[data-tip]');if(t)tip(t.dataset.tip,e.clientX,e.clientY);else if(!e.target.closest?.('.hoverline'))untip()});
document.addEventListener('focusin',e=>{const t=e.target.closest?.('[data-tip]');if(t){const r=t.getBoundingClientRect();tip(t.dataset.tip,r.left+r.width/2,r.top)}});
document.addEventListener('focusout',untip);

/* ---------- charts ---------- */
const mounted=[];
function mount(id,fn){const el=document.getElementById(id);if(!el)return;el.classList.add('first');fn(el,el.clientWidth||600);mounted.push([el,fn])}
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>mounted.forEach(([el,fn])=>{if(el.isConnected){el.classList.remove('first');fn(el,el.clientWidth||600)}}),150)});
const nice=v=>{const p=Math.pow(10,Math.floor(Math.log10(v)));const f=v/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p};
const rr=(x,y,w,h,r,side)=>{r=Math.min(r,Math.abs(w),h/2);
  if(side==='r')return `M${x},${y}h${w-r}a${r},${r} 0 0 1 ${r},${r}v${h-2*r}a${r},${r} 0 0 1 ${-r},${r}h${-(w-r)}z`;
  if(side==='l')return `M${x+w},${y}h${-(w-r)}a${r},${r} 0 0 0 ${-r},${r}v${h-2*r}a${r},${r} 0 0 0 ${r},${r}h${w-r}z`;
  return `M${x},${y+h}v${-(h-r)}a${r},${r} 0 0 1 ${r},${-r}h${w-2*r}a${r},${r} 0 0 1 ${r},${r}v${h-r}z`};

function lineChart(el,w,d){
  const h=230,wide=w>460,m={l:38,r:wide?92:10,t:10,b:24},n=d.cur.length,max=nice(Math.max(...d.cur,...d.prev)*1.05);
  const X=i=>m.l+i*(w-m.l-m.r)/(n-1),Y=v=>m.t+(h-m.t-m.b)*(1-v/max);
  const path=a=>a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join('');
  let g='';for(let t=0;t<=4;t++){const v=max*t/4;g+=`<line x1="${m.l}" x2="${w-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${t?'var(--line)':'var(--axis)'}"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end">${fmt(v)}</text>`}
  const step=Math.ceil(n/(wide?7:4));for(let i=0;i<n;i+=step)g+=`<text x="${X(i)}" y="${h-6}" text-anchor="middle">${d.unit} ${i+1}</text>`;
  const area=path(d.cur)+`L${X(n-1)},${Y(0)}L${X(0)},${Y(0)}z`;
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" tabindex="0" aria-label="Organic clicks, this period against the previous period. Use arrow keys to read values.">${g}
   <path class="fade" d="${area}" fill="var(--s1)" fill-opacity=".08"/>
   <path class="fade" d="${path(d.prev)}" fill="none" stroke="var(--prev)" stroke-width="1.5" stroke-dasharray="4 4"/>
   <path class="draw" pathLength="1" d="${path(d.cur)}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
   <circle class="fade" cx="${X(n-1)}" cy="${Y(d.cur[n-1])}" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"/>
   ${wide?`<text class="val fade" x="${X(n-1)+9}" y="${Y(d.cur[n-1])+4}">This period</text><text class="fade" x="${X(n-1)+9}" y="${Y(d.prev[n-1])+(Math.abs(Y(d.prev[n-1])-Y(d.cur[n-1]))<14?18:4)}">Previous</text>`:''}
   <g class="hoverline" visibility="hidden"><line y1="${m.t}" y2="${h-m.b}" stroke="var(--axis)"/><circle r="4" fill="var(--prev)" stroke="var(--surface)" stroke-width="2"/><circle r="4.5" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"/></g>
   <rect class="hoverline" x="${m.l}" y="${m.t}" width="${w-m.l-m.r}" height="${h-m.t-m.b}" fill="transparent"/></svg>`;
  const svg=$('svg',el),hl=$('g.hoverline',svg),[ln,c1,c2]=hl.children;let idx=n-1;
  const show=i=>{idx=Math.max(0,Math.min(n-1,i));hl.setAttribute('visibility','visible');ln.setAttribute('x1',X(idx));ln.setAttribute('x2',X(idx));
    c1.setAttribute('cx',X(idx));c1.setAttribute('cy',Y(d.prev[idx]));c2.setAttribute('cx',X(idx));c2.setAttribute('cy',Y(d.cur[idx]));
    const r=svg.getBoundingClientRect(),k=r.width/w;tip(`<b>${d.unit} ${idx+1}</b><br>This period: <b>${fmt(d.cur[idx])}</b> clicks<br>Previous: ${fmt(d.prev[idx])}`,r.left+X(idx)*k,r.top+Y(d.cur[idx])*k)};
  const hide=()=>{hl.setAttribute('visibility','hidden');untip()};
  svg.addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect();show(Math.round(((e.clientX-r.left)/r.width*w-m.l)/((w-m.l-m.r)/(n-1))))});
  svg.addEventListener('pointerleave',hide);svg.addEventListener('blur',hide);
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){show(idx-1);e.preventDefault()}if(e.key==='ArrowRight'){show(idx+1);e.preventDefault()}});
}
function hbar(el,w,rows,o={}){
  const lw=Math.min(190,w*.42),rh=28,h=rows.length*rh+4,max=o.max||Math.max(...rows.map(r=>r.v)),bw=w-lw-58;
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label||'Bar chart')}"><line x1="${lw}" x2="${lw}" y1="0" y2="${h}" stroke="var(--axis)"/>`+rows.map((r,i)=>{
    const y=i*rh+6,bl=Math.max(2,bw*r.v/max);
    return `<g tabindex="0" data-tip="<b>${esc(r.k)}</b><br>${fmt(r.v)} ${esc(o.unit||'')}"><rect x="0" y="${i*rh}" width="${w}" height="${rh}" fill="transparent"/>
     <text class="cat" x="${lw-8}" y="${y+12}" text-anchor="end">${esc(r.k.length>lw/6.2?r.k.slice(0,Math.floor(lw/6.2)-1)+'…':r.k)}</text>
     <path class="gx" style="--i:${i}" d="${rr(lw,y,bl,16,4,'r')}" fill="${r.c||'var(--s1)'}"/>
     <text class="val fade" x="${lw+bl+6}" y="${y+12}">${fmt(r.v)}</text></g>`}).join('')+`</svg>`;
}
function vbar(el,w,rows,o={}){
  const h=220,m={l:36,r:8,t:18,b:26},max=nice(Math.max(...rows.map(r=>r.v))*1.05),bw=(w-m.l-m.r)/rows.length,Y=v=>m.t+(h-m.t-m.b)*(1-v/max);
  let g='';for(let t=0;t<=4;t++){const v=max*t/4;g+=`<line x1="${m.l}" x2="${w-m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${t?'var(--line)':'var(--axis)'}"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end">${fmt(v)}</text>`}
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label||'')}">${g}`+rows.map((r,i)=>{
    const x=m.l+i*bw+2,ww=bw-4,bh=Math.max(2,Y(0)-Y(r.v));
    return `<g tabindex="0" data-tip="<b>Position ${esc(r.k)}</b><br>${fmt(r.v)} queries"><rect x="${x}" y="${m.t}" width="${ww}" height="${h-m.t-m.b}" fill="transparent"/>
     <path class="gy" style="--i:${i}" d="${rr(x,Y(r.v),ww,bh,4,'t')}" fill="${r.c||'var(--s1)'}"/>
     <text class="val fade" x="${x+ww/2}" y="${Y(r.v)-5}" text-anchor="middle">${fmt(r.v)}</text>
     <text class="cat" x="${x+ww/2}" y="${h-8}" text-anchor="middle">${esc(r.k)}</text></g>`}).join('')+`</svg>`;
}
function diverge(el,w,rows){
  const lw=Math.min(180,w*.4),rh=28,h=rows.length*rh+22,max=Math.max(...rows.map(r=>Math.abs(r.v))),half=(w-lw-10)/2-34,cx=lw+10+half+34;
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Change in clicks by page">
   <text x="${cx-6}" y="${h-4}" text-anchor="end">Lost clicks</text><text x="${cx+6}" y="${h-4}">Gained clicks</text>`+rows.map((r,i)=>{
    const y=i*rh+6,bl=Math.max(2,half*Math.abs(r.v)/max),pos=r.v>=0;
    return `<g tabindex="0" data-tip="<b class='mono'>${esc(r.k)}</b><br>${pos?'+':'−'}${fmt(Math.abs(r.v))} clicks vs previous period"><rect x="0" y="${i*rh}" width="${w}" height="${rh}" fill="transparent"/>
     <text class="cat" x="${lw}" y="${y+12}" text-anchor="end" style="font-family:var(--mono);font-size:10.5px">${esc(r.k.length>lw/6.6?r.k.slice(0,Math.floor(lw/6.6)-1)+'…':r.k)}</text>
     <path class="${pos?'gx':'gxr'}" style="--i:${i}" d="${pos?rr(cx+1,y,bl,16,4,'r'):rr(cx-1-bl,y,bl,16,4,'l')}" fill="${pos?'var(--s1)':'var(--neg)'}"/>
     <text class="val fade" x="${pos?cx+bl+6:cx-bl-6}" y="${y+12}" text-anchor="${pos?'start':'end'}">${pos?'+':'−'}${fmt(Math.abs(r.v))}</text></g>`}).join('')+
   `<line x1="${cx}" x2="${cx}" y1="0" y2="${h-18}" stroke="var(--axis)"/></svg>`;
}
function scatter(el,w,pts){
  const h=280,m={l:44,r:14,t:12,b:38},X=v=>m.l+(v-.5)/5*(w-m.l-m.r),Y=v=>m.t+(h-m.t-m.b)*(1-(v-.5)/5);
  let g='';for(let t=1;t<=5;t++)g+=`<line x1="${m.l}" x2="${w-m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)"/><text x="${m.l-8}" y="${Y(t)+4}" text-anchor="end">${t}</text><text x="${X(t)}" y="${h-m.b+16}" text-anchor="middle">${t}</text>`;
  const seen={};
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Findings by impact and effort">${g}
   <line x1="${m.l}" x2="${w-m.r}" y1="${h-m.b}" y2="${h-m.b}" stroke="var(--axis)"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${h-m.b}" stroke="var(--axis)"/>
   <text x="${(m.l+w-m.r)/2}" y="${h-4}" text-anchor="middle">Effort (1 low to 5 high)</text>
   <text transform="translate(11 ${(m.t+h-m.b)/2}) rotate(-90)" text-anchor="middle">Impact</text>
   <text class="cat fade" x="${X(.62)}" y="${Y(5.32)}">Quick wins</text>`+pts.map((p,i)=>{
     const k=p.effort+'-'+p.impact,j=seen[k]=(seen[k]||0)+1,dx=(j-1)*17;
     return `<circle class="popin" style="--i:${i}" tabindex="0" cx="${X(p.effort)+dx}" cy="${Y(p.impact)}" r="7" fill="var(${BK[p.bucket][1]})" stroke="var(--surface)" stroke-width="2"
       data-tip="<b>${esc(p.title)}</b><br>${BK[p.bucket][0]} · impact ${p.impact}, effort ${p.effort}<br><span class='muted'>${esc(agent(p.agent).role)}</span>"/>`}).join('')+`</svg>`;
}
function spark(a,c='var(--s1)'){const w=92,h=30,mx=Math.max(...a),mn=Math.min(...a),X=i=>2+i*(w-8)/(a.length-1),Y=v=>h-4-(h-9)*(v-mn)/((mx-mn)||1);
  const p=a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" class="first"><path d="${p}L${X(a.length-1)},${h}L2,${h}z" fill="${c}" opacity=".1"/><path class="draw" pathLength="1" d="${p}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(a.length-1)}" cy="${Y(a[a.length-1])}" r="2.6" fill="${c}"/></svg>`}

