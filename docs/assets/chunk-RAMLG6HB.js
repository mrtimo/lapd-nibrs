globalThis.process||={env:{},platform:'browser',versions:{},argv:[],cwd:()=>'/'};
import{a as h,b as C,c as M,d as N,e as S,f as $}from"./chunk-XTFKQ4PO.js";var p=h(C()),k=h(M());var r=h(S()),g="#2563eb",U="#dc2626",E="#2563eb",F=[[0,"#fde68a"],[.35,"#f97316"],[.7,"#dc2626"],[1,"#7f1d1d"]],P="rgba(128,128,128,.2)",_=e=>e==null||Number.isNaN(e)?"\u2013":Math.round(e).toLocaleString(),A=(e,o=0)=>e==null||!Number.isFinite(e)?"\u2013":`${(e*100).toFixed(o)}%`,I=e=>e==null?"\u2013":`${e>0?"+":""}${Math.round(e).toLocaleString()}`,O=e=>e==null||!Number.isFinite(e)?"new":`${e>0?"+":""}${(e*100).toFixed(0)}%`,B=()=>typeof window<"u"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches,G=e=>String(e).slice(0,10),L=(e,o)=>{let t=new Date(e+"T00:00:00Z");return t.setUTCMonth(t.getUTCMonth()+o),t.toISOString().slice(0,10)},z=e=>L(e,1),x=e=>new Date(e+"T00:00:00Z").toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"}),T=(e,o)=>e===o?x(e):`${x(e)} \u2013 ${x(o)}`;function Z({data:e,layout:o,height:t=320,onClick:s,scrollZoom:i=!1}){let a=(0,p.useRef)(null);return(0,p.useEffect)(()=>{let c=a.current;if(!c)return;let v=getComputedStyle(c).color;k.default.react(c,e,{height:t,margin:{l:8,r:8,t:8,b:8},paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",font:{color:v,size:12},...o},{responsive:!0,displaylogo:!1,scrollZoom:i,modeBarButtonsToRemove:["select2d","lasso2d"]}),c.removeAllListeners?.("plotly_click"),s&&c.on("plotly_click",u=>s(u.points[0]))},[e,o,t,s,i]),(0,p.useEffect)(()=>()=>a.current&&k.default.purge(a.current),[]),(0,r.jsx)("div",{ref:a,style:{width:"100%",minHeight:t}})}function j({title:e,note:o,children:t,span:s=1,rows:i=1,className:a=""}){return(0,r.jsxs)("section",{className:`lc-card ${a}`,style:{gridColumn:`span ${s}`,gridRow:`span ${i}`},children:[(0,r.jsxs)("header",{children:[(0,r.jsx)("h3",{children:e}),o&&(0,r.jsx)("span",{className:"lc-note",children:o})]}),t]})}function H({q:e,children:o}){return e.error?(0,r.jsx)("div",{className:"lc-msg lc-err",children:String(e.error.message??e.error)}):e.loading&&!e.rows?.length?(0,r.jsx)("div",{className:"lc-msg",children:"Loading\u2026"}):e.rows?.length?o:(0,r.jsx)("div",{className:"lc-msg",children:"No matching records."})}function K({value:e,options:o,onChange:t,label:s}){return(0,r.jsx)("span",{className:"lc-toggle",role:"group","aria-label":s,children:o.map(([i,a])=>(0,r.jsx)("button",{className:String(e)===String(i)?"on":"",onClick:()=>t(i),children:a},i))})}function Q({months:e}){let o=$("PERIOD"),t=e.length-1,s=()=>{let n=/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/.exec(o.value||"");if(!n)return[0,t];let l=e.indexOf(n[1]),d=e.findIndex(b=>z(b)===n[2]);return[l<0?0:l,d<0?t:d]},[i,a]=(0,p.useState)(s);(0,p.useEffect)(()=>a(s()),[o.value,t]);let c=([n,l])=>{let d=n===0&&l===t;o.set(d?"":N.dateRange(e[n],z(e[l])))},v=n=>l=>{let d=Number(l.target.value);a(([b,y])=>n===0?[Math.min(d,y),y]:[b,Math.max(d,b)])},u=()=>c(i),[m,f]=i,w=n=>t?n/t*100:0;return(0,r.jsxs)("div",{className:"lc-slider",children:[(0,r.jsxs)("div",{className:"lc-slider-label",children:[(0,r.jsx)("span",{children:"Months"}),(0,r.jsx)("strong",{children:T(e[m],e[f])}),(m!==0||f!==t)&&(0,r.jsx)("button",{className:"lc-link",onClick:()=>{a([0,t]),c([0,t])},children:"All months"}),(0,r.jsx)("button",{className:"lc-link",onClick:()=>{a([t,t]),c([t,t])},children:"Latest month"})]}),(0,r.jsxs)("div",{className:"lc-track",children:[(0,r.jsx)("div",{className:"lc-fill",style:{left:`${w(m)}%`,width:`${w(f)-w(m)}%`}}),[m,f].map((n,l)=>(0,r.jsx)("input",{type:"range",min:0,max:t,step:1,value:n,"aria-label":l===0?"First month":"Last month",onChange:v(l),onPointerUp:u,onKeyUp:u,onTouchEnd:u},l))]}),(0,r.jsxs)("div",{className:"lc-ticks",children:[(0,r.jsx)("span",{children:x(e[0])}),(0,r.jsx)("span",{children:x(e[t])})]})]})}var V=`
.lc { --edge: var(--dash-border, #e4e6eb); --muted: var(--dash-muted, #6b7280);
  color: var(--dash-fg, #111827); max-width: 1400px; margin: 0 auto; padding: 16px; font-family: var(--dash-font, system-ui, sans-serif); }
.lc h1 { margin: 0 0 4px; font-size: 26px; }
.lc-head p { margin: 0 0 12px; color: var(--muted); max-width: 900px; }
.lc-filters { display: grid; gap: 12px; margin-bottom: 16px; }
.lc-group { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; background: var(--dash-controls-bg, transparent); min-width: 0; }
.lc-group h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.lc-row { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; font-size: 13px; margin-bottom: 6px; }
.lc-row label { color: var(--muted); }
.lc-row select, .lc-row input { font: inherit; font-size: 13px; padding: 3px 6px; border: 1px solid var(--edge); border-radius: 6px; background: transparent; color: inherit; }
.lc-row select option { color: #111; }
.lc-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.lc-kpi { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 14px; }
.lc-kpi span { display: block; font-size: 12px; color: var(--muted); }
.lc-kpi strong { font-size: 24px; font-variant-numeric: tabular-nums; }
.lc-kpi small { display: block; font-size: 12px; color: var(--muted); }
.lc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.lc-card { border: 1px solid var(--edge); border-radius: var(--dash-radius, 10px); padding: 10px 12px; min-width: 0; }
.lc-card header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.lc-card h3 { margin: 0; font-size: 15px; }
.lc-note, .lc-foot, .lc-footer { font-size: 12px; color: var(--muted); }
.lc-foot { margin: 0 0 8px; }
.lc-footer { margin-top: 16px; }
.lc-warn { color: var(--dash-danger, #b45309); }
.lc-msg { padding: 24px; text-align: center; color: var(--muted); }
.lc-err { color: var(--dash-danger, #dc2626); text-align: left; white-space: pre-wrap; }
.lc-link { background: none; border: 0; padding: 0; color: var(--dash-accent, ${g}); cursor: pointer; font: inherit; font-size: 12px; }
.lc-toggle { display: inline-flex; }
.lc-toggle button { font: inherit; font-size: 12px; padding: 3px 10px; border: 1px solid var(--edge); border-left-width: 0; background: transparent; color: inherit; cursor: pointer; }
.lc-toggle button:first-child { border-radius: 6px 0 0 6px; border-left-width: 1px; } .lc-toggle button:last-child { border-radius: 0 6px 6px 0; }
.lc-toggle button.on { background: var(--dash-accent, ${g}); color: var(--dash-accent-fg, #fff); border-color: var(--dash-accent, ${g}); }
.lc-slider { margin-bottom: 8px; }
.lc-slider-label { display: flex; gap: 10px; align-items: baseline; font-size: 13px; flex-wrap: wrap; }
.lc-slider-label span { color: var(--muted); }
.lc-track { position: relative; height: 28px; }
.lc-track::before { content: ""; position: absolute; left: 0; right: 0; top: 12px; height: 4px; border-radius: 2px; background: var(--edge); }
.lc-fill { position: absolute; top: 12px; height: 4px; border-radius: 2px; background: var(--dash-accent, ${g}); }
.lc-track input { position: absolute; left: 0; width: 100%; top: 4px; margin: 0; background: none; pointer-events: none; -webkit-appearance: none; appearance: none; height: 20px; }
.lc-track input::-webkit-slider-thumb { pointer-events: auto; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--dash-accent, ${g}); border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35); cursor: grab; }
.lc-track input::-moz-range-thumb { pointer-events: auto; width: 16px; height: 16px; border-radius: 50%; background: var(--dash-accent, ${g}); border: 2px solid #fff; cursor: grab; }
.lc-track input::-moz-range-track { background: none; }
.lc-ticks { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }
@media (max-width: 1000px) {
  .lc-filters { grid-template-columns: 1fr !important; }
  .lc-kpis { grid-template-columns: repeat(2, 1fr); }
  .lc-grid { grid-template-columns: 1fr; }
  .lc-card { grid-column: auto !important; grid-row: auto !important; }
}
`;export{U as a,E as b,F as c,P as d,_ as e,A as f,I as g,O as h,B as i,G as j,L as k,z as l,x as m,T as n,Z as o,j as p,H as q,K as r,Q as s,V as t};
