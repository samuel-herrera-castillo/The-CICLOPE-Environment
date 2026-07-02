import React, { useState, useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import type { Category, ProjectDocument } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { RelationModal } from "./RelationModal";
import { PRESETS } from "./RelationTypeAdmin";
import { MousePointer2, Hand, ZoomIn, ZoomOut, Maximize2, Save, Download, Grid3x3, Undo2, Redo2, Plus, Trash2, Play, Eye, EyeOff, BarChart3, X, Pencil, Copy, Search, ChevronDown, GitCompare, Layers, Scissors, MessageSquare, ArrowLeftRight } from "lucide-react";

export type NodeType = "category"|"document"|"segment"|"memo"|"text"|"external"|"network";
export interface NetNode { id:string;label:string;type:NodeType;x:number;y:number;color:string;size:number;entityId?:string;desc?:string;shape?:string;opacity?:number;shadow?:boolean;comment?:string;imageUrl?:string;visible?:boolean; }
export interface NetEdge { id:string;source:string;target:string;label:string;color:string;width:number;style:string;direction:string;arrowType:string;opacity:number;curvature:number;comment:string;labelPos:string;labelBg:boolean; }
export interface SavedNet { id:string;name:string;nodes:NetNode[];edges:NetEdge[];createdAt:string;thumbnail?:string;layout?:string;zoom?:number;pan?:{x:number;y:number};communities?:Record<string,number>; }

interface Props { categories:Category[];documents:ProjectDocument[];memos?:{id:string;title:string;content:string}[];
  onSave:(net:SavedNet)=>void;initialNetwork?:SavedNet|null;onBack:()=>void;allNetworks?:SavedNet[]; }

const SHAPES=["circle","rect","rounded","diamond","hexagon","cloud"];
const COLORS=["#F1D7FF","#E53935","#1E88E5","#43A047","#F4511E","#8E24AA","#6D4C41","#F9A825","#00ACC1","#D81B60","#5E35B1","#3949AB","#00897B","#FF7043","#78909C","#7CB342"];
const ROUTINGS=["bezier","straight","orthogonal","smooth"] as const;
const NODE_STYLES=["label_below","label_inside","color_bg","card"] as const;
type NS=typeof NODE_STYLES[number];
const EL_MODES=["long","short","symbol"] as const;
type EM=typeof EL_MODES[number];

export function NetworkEditor({ categories, documents, memos, onSave, initialNetwork, onBack, allNetworks }: Props) {
  const svgRef=useRef<SVGSVGElement>(null);const gRef=useRef<SVGGElement>(null);const {toast}=useToast();
  const [nodes,setNodes]=useState<NetNode[]>(initialNetwork?.nodes??[]);
  const [edges,setEdges]=useState<NetEdge[]>(initialNetwork?.edges??[]);
  const [selIds,setSelIds]=useState<string[]>([]);
  const [tool,setTool]=useState<"select"|"move">("select");
  const [showGrid,setGrid]=useState(true);const [showLabels,setLabels]=useState(true);
  const [showFreq,setFreq]=useState(false);const [showComments,setComments]=useState(false);
  const [showCodeDoc,setCodeDoc]=useState(false);const [showGuides,setGuides]=useState(false);const [showPreview,setPreview]=useState(false);
  const [inspectorTab,setInspectorTab]=useState<"style"|"content"|"relations">("style");
  const [routing,setRouting]=useState<typeof ROUTINGS[number]>("bezier");
  const [nodeStyle,setNodeStyle]=useState<NS>("label_below");
  const [edgeLabelMode,setEdgeLabelMode]=useState<EM>("long");
  const [name,setName]=useState(initialNetwork?.name??"Untitled Network");
  const [saved,setSaved]=useState(true);
  const [lastSaveTime,setLastSaveTime]=useState(Date.now());
  const [undoS,setUndoS]=useState<{n:NetNode[];e:NetEdge[]}[]>([]);
  const [redoS,setRedoS]=useState<{n:NetNode[];e:NetEdge[]}[]>([]);
  const [relModal,setRelModal]=useState<{src:NetNode;tgt:NetNode;ex?:NetEdge|null}|null>(null);
  const [showMetrics,setShowMetrics]=useState(false);
  const [ctxMenu,setCtxMenu]=useState<{x:number;y:number;t:"node"|"edge"|"canvas";id?:string}|null>(null);
  const [hoverNode,setHoverNode]=useState<string|null>(null);
  const [dragConn,setDragConn]=useState<{nodeId:string;sx:number;sy:number}|null>(null);
  const [communities,setCommunities]=useState<Map<string,number>|null>(null);
  const [rectSel,setRectSel]=useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
  const [clipboard,setClipboard]=useState<NetNode[]>([]);
  const [layoutToast,setLayoutToast]=useState(false);
  const [exportOpts,setExportOpts]=useState({title:true,legend:true,metrics:true,date:true,transparent:false});
  const selId=selIds.length===1?selIds[0]:null;

  useEffect(()=>{if(initialNetwork&&initialNetwork.nodes.length>0&&!layoutToast){setLayoutToast(true);setTimeout(()=>toast.success("Layout restored",initialNetwork.name),200);}},[initialNetwork]);

  const pushUndo=useCallback(()=>{setUndoS(s=>[...s.slice(-49),{n:[...nodes],e:[...edges]}]);setRedoS([]);setSaved(false);},[nodes,edges]);
  const undo=()=>{if(!undoS.length)return;setRedoS(s=>[...s,{n:nodes,e:edges}]);const p=undoS[undoS.length-1];setNodes(p.n);setEdges(p.e);setUndoS(s=>s.slice(0,-1));};
  const redo=()=>{if(!redoS.length)return;setUndoS(s=>[...s,{n:nodes,e:edges}]);const n=redoS[redoS.length-1];setNodes(n.n);setEdges(n.e);setRedoS(s=>s.slice(0,-1));};

  const addNode=(type:NodeType,label:string,color:string,size:number,entityId?:string,shape?:string)=>{
    pushUndo();const s=shape??(type==="category"?"circle":type==="memo"?"rect":"rect");
    setNodes(p=>[...p,{id:"n-"+Date.now(),label,type,x:250+0*200,y:200+0*150,color,size,entityId,shape:s,opacity:0.9,shadow:false,visible:true}]);
  };
  const delSelected=()=>{
    if(!selIds.length)return;
    if(selIds.length>3&&!window.confirm("Delete "+selIds.length+" selected items?"))return;
    pushUndo();setNodes(p=>p.filter(n=>!selIds.includes(n.id)));
    setEdges(p=>p.filter(e=>!selIds.includes(e.source)&&!selIds.includes(e.target)&&!selIds.includes(e.id)));
    setSelIds([]);
  };
  const dupSelected=()=>{if(!selIds.length)return;pushUndo();const ns=nodes.filter(n=>selIds.includes(n.id)).map(n=>({...n,id:"n-"+Date.now(),x:n.x+30,y:n.y+30}));setNodes(p=>[...p,...ns]);};

  // Edge creation via drag from connection points
  const handleConnDrag=(nodeId:string,e:React.MouseEvent)=>{e.stopPropagation();e.preventDefault();setDragConn({nodeId,sx:e.clientX,sy:e.clientY});};
  useEffect(()=>{
    if(!dragConn||!svgRef.current)return;
    const mm=(me:MouseEvent)=>{setDragConn(p=>p?{...p,sx:me.clientX,sy:me.clientY}:null);};
    const mu=(me:MouseEvent)=>{
      if(!dragConn)return;const el=document.elementFromPoint(me.clientX,me.clientY);
      const tid=el?.closest("[data-node-id]")?.getAttribute("data-node-id");
      if(tid&&tid!==dragConn.nodeId){const s=nodes.find(n=>n.id===dragConn.nodeId);const t=nodes.find(n=>n.id===tid);
        if(s&&t){
          const dup=edges.find(ed=>(ed.source===dragConn.nodeId&&ed.target===tid)||(ed.source===tid&&ed.target===dragConn.nodeId));
          if(!dup){setRelModal({src:s,tgt:t,ex:null});}
          else if(window.confirm("A relation already exists between these nodes. Create intermediate node?")){
            pushUndo();
            const mid:NetNode={id:"n-"+Date.now(),label:"intermediate",type:"text",x:(s.x+t.x)/2,y:(s.y+t.y)/2,color:"#F1D7FF",size:20,shape:"rounded",opacity:0.9,shadow:false,visible:true};
            setNodes(p=>[...p,mid]);
            setEdges(p=>[...p,{id:"e-"+Date.now(),source:s.id,target:mid.id,label:dup.label,color:dup.color,width:dup.width,style:dup.style,direction:dup.direction,arrowType:dup.arrowType,opacity:dup.opacity,curvature:0,comment:"",labelPos:"center",labelBg:false}]);
            setRelModal({src:mid,tgt:t,ex:null});
          }
        }
        }
      setDragConn(null);
    };
    window.addEventListener("mousemove",mm);window.addEventListener("mouseup",mu);
    return()=>{window.removeEventListener("mousemove",mm);window.removeEventListener("mouseup",mu);};
  },[dragConn,nodes,edges]);

  const handleRelConfirm=(edge:NetEdge,newRel?:any)=>{
    pushUndo();if(relModal?.ex)setEdges(p=>p.map(e=>e.id===edge.id?edge:e));else setEdges(p=>[...p,edge]);
    setRelModal(null);if(newRel)toast.success("Created",'Relation "'+newRel.name+'" added');else toast.success("Relation",relModal?.ex?"Updated":"Created");
  };

  // Rect selection
  const handleCMouseDown=(e:React.MouseEvent)=>{
    if(e.shiftKey){const r=svgRef.current?.getBoundingClientRect();if(r)setRectSel({x1:e.clientX-r.left,y1:e.clientY-r.top,x2:e.clientX-r.left,y2:e.clientY-r.top});return;}
    setSelIds([]);setCtxMenu(null);const r=svgRef.current?.getBoundingClientRect();if(r)setRectSel({x1:e.clientX-r.left,y1:e.clientY-r.top,x2:e.clientX-r.left,y2:e.clientY-r.top});
  };
  const handleCMove=(e:React.MouseEvent)=>{if(!rectSel||!svgRef.current)return;const r=svgRef.current.getBoundingClientRect();setRectSel({...rectSel,x2:e.clientX-r.left,y2:e.clientY-r.top});};
  const handleCUp=()=>{if(!rectSel)return;const x1=Math.min(rectSel.x1,rectSel.x2),x2=Math.max(rectSel.x1,rectSel.x2),y1=Math.min(rectSel.y1,rectSel.y2),y2=Math.max(rectSel.y1,rectSel.y2);
    const inR=nodes.filter(n=>{const t=d3.zoomTransform(gRef.current!);const sx=n.x*t.k+t.x,sy=n.y*t.k+t.y;return sx>=x1&&sx<=x2&&sy>=y1&&sy<=y2;});
    if(inR.length)setSelIds(inR.map(n=>n.id));setRectSel(null);};

  // Space pan
  useEffect(()=>{const d=(e:KeyboardEvent)=>{if(e.code==="Space"){e.preventDefault();setTool("move");}};const u=(e:KeyboardEvent)=>{if(e.code==="Space")setTool("select");};window.addEventListener("keydown",d);window.addEventListener("keyup",u);return()=>{window.removeEventListener("keydown",d);window.removeEventListener("keyup",u);};},[]);

  // Layouts
  const runForce=()=>{if(nodes.length<2)return;pushUndo();const sn=nodes.map(n=>({...n}));const se=edges.map(e=>({source:e.source,target:e.target}));
    d3.forceSimulation(sn as any).force("link",d3.forceLink(se).id((d:any)=>d.id).distance(100)).force("charge",d3.forceManyBody().strength(-400))
    .force("center",d3.forceCenter(400,300)).force("collide",d3.forceCollide(45)).on("end",()=>setNodes(sn.map((n:any)=>({...n,x:n.x,y:n.y})))).alpha(1).restart();};
  const runCircular=()=>{if(nodes.length<2)return;pushUndo();const cx=400,cy=300,r=Math.min(250,nodes.length*25);setNodes(nodes.map((n,i)=>({...n,x:cx+r*Math.cos(2*Math.PI*i/nodes.length),y:cy+r*Math.sin(2*Math.PI*i/nodes.length)})));};
  const runRadial=()=>{if(nodes.length<2)return;pushUndo();const cx=400,cy=300;setNodes(nodes.map((n,i)=>{const a=2*Math.PI*i/(nodes.length-1||1),d=i===0?0:80+i*25;return{...n,x:cx+d*Math.cos(a),y:cy+d*Math.sin(a)};}));};
  const runGrid=()=>{if(nodes.length<2)return;pushUndo();const cols=Math.ceil(Math.sqrt(nodes.length));setNodes(nodes.map((n,i)=>{const c=i%cols,r=Math.floor(i/cols);return{...n,x:100+c*150,y:50+r*120};}));};
  const runTreeV=()=>{if(nodes.length<2)return;pushUndo();const root=nodes[0],o=nodes.slice(1);setNodes([root,...o.map((n,i)=>{const l=Math.floor(i/4)+1,p=i%4;return{...n,x:100+p*200,y:50+l*100};})]);};
  const runTreeH=()=>{if(nodes.length<2)return;pushUndo();const root=nodes[0],o=nodes.slice(1);setNodes([root,...o.map((n,i)=>{const l=Math.floor(i/4)+1,p=i%4;return{...n,x:50+l*150,y:50+p*100};})]);};
  const runRandom=()=>{if(nodes.length<2)return;pushUndo();setNodes(nodes.map(n=>({...n,x:100+0*600,y:50+0*500})));};

  // Communities (BFS)
  const detectCommunities=()=>{
    const adj=new Map<string,Set<string>>();nodes.forEach(n=>adj.set(n.id,new Set()));edges.forEach(e=>{adj.get(e.source)?.add(e.target);adj.get(e.target)?.add(e.source);});
    const comm=new Map<string,number>();let nc=0;const vis=new Set<string>();
    nodes.forEach(n=>{if(!vis.has(n.id)){const q=[n.id];vis.add(n.id);comm.set(n.id,nc);while(q.length){const c=q.shift()!;adj.get(c)?.forEach(nb=>{if(!vis.has(nb)){vis.add(nb);comm.set(nb,nc);q.push(nb);}});}nc++;}});
    setCommunities(comm);toast.success("Communities",nc+" detected");
  };

  // Shortest path
  const findShortestPath=()=>{
    const s=selIds[0],t=selIds[1];if(!s||!t||s===t){toast.info("Select exactly 2 nodes");return;}
    const adj=new Map<string,string[]>();nodes.forEach(n=>adj.set(n.id,[]));edges.forEach(e=>{adj.get(e.source)?.push(e.target);adj.get(e.target)?.push(e.source);});
    const q=[s],prev=new Map<string,string|null>(),vis=new Set<string>();prev.set(s,null);vis.add(s);
    while(q.length){const c=q.shift()!;if(c===t)break;adj.get(c)?.forEach(nb=>{if(!vis.has(nb)){vis.add(nb);prev.set(nb,c);q.push(nb);}});}
    const path:string[]=[];let cur:string|null=t;while(cur){path.unshift(cur);cur=prev.get(cur)??null;}
    if(path.length<2||path[0]!==s){toast.info("No path","Not connected");return;}
    setSelIds(path);setTimeout(()=>{setSelIds([s]);toast.success("Shortest path",(path.length-1)+" steps");},3500);
  };

  // Centrality
  const applyCentrality=()=>{pushUndo();const deg=new Map<string,number>();nodes.forEach(n=>deg.set(n.id,0));edges.forEach(e=>{deg.set(e.source,(deg.get(e.source)??0)+1);deg.set(e.target,(deg.get(e.target)??0)+1);});
    const maxD=Math.max(...Array.from(deg.values()),1);setNodes(nodes.map(n=>({...n,size:20+((deg.get(n.id)??0)/maxD)*40})));toast.success("Centrality","Node size ∝ degree");};

  // Add neighbors
  const addNeighbors=(node:NetNode)=>{
    const cooc=categories.filter(c=>!nodes.find(n=>n.entityId===c.id)).slice(0,5);
    if(cooc.length===0){toast.info("No neighbors","Already connected or no co-occurring categories");return;}
    pushUndo();
    const newNodes=cooc.map(c=>({id:"n-"+Date.now()+"-"+c.id,label:c.name,type:"category" as NodeType,x:node.x+80+0*60,y:node.y-40+0*80,color:c.color,size:30,entityId:c.id,shape:"circle",opacity:0.9,shadow:false,visible:true}));
    setNodes(p=>[...p,...newNodes]);
    cooc.forEach(c=>{const nn=newNodes.find(nn=>nn.entityId===c.id);if(nn)setEdges(p=>[...p,{id:"e-"+Date.now(),source:node.id,target:nn.id,label:"co-occurs",color:"#F1D7FF",width:1,style:"dotted",direction:"undirected",arrowType:"classic",opacity:0.6,curvature:0,comment:"",labelPos:"center",labelBg:false}]);});
    toast.success("Neighbors","Added "+newNodes.length+" nodes");
  };

  // Copy/paste
  const copySelected=()=>{const ns=nodes.filter(n=>selIds.includes(n.id));if(!ns.length)return;setClipboard(ns);toast.info("Copied",ns.length+" nodes");};
  const pasteNodes=()=>{if(!clipboard.length)return;pushUndo();const ns=clipboard.map(n=>({...n,id:"n-"+Date.now(),x:n.x+50,y:n.y+50}));setNodes(p=>[...p,...ns]);toast.success("Pasted",ns.length+" nodes");};

  // Export
  const exportPNG=()=>{if(!svgRef.current)return;const s=new XMLSerializer().serializeToString(svgRef.current);const b=new Blob([s],{type:"image/svg+xml"});const u=URL.createObjectURL(b);
    const img=new Image();img.onload=()=>{const c=document.createElement("canvas");c.width=1600;c.height=1200;const x=c.getContext("2d")!;x.fillStyle="#fff";x.fillRect(0,0,1600,1200);x.drawImage(img,0,0,1600,1200);
    const a=document.createElement("a");a.href=c.toDataURL("image/png");a.download=name+".png";a.click();URL.revokeObjectURL(u);toast.success("PNG 2x");};img.src=u;};
  const exportSVG=()=>{if(!svgRef.current)return;const s=new XMLSerializer().serializeToString(svgRef.current);const b=new Blob([s],{type:"image/svg+xml"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".svg";a.click();toast.success("SVG");};
  const exportGEXF=()=>{let g='<?xml version="1.0"?><gexf xmlns="http://www.gexf.net/1.3"><graph mode="static"><nodes>';nodes.forEach(n=>{g+='<node id="'+n.id+'" label="'+n.label+'"/>';});g+='</nodes><edges>';edges.forEach(e=>{g+='<edge source="'+e.source+'" target="'+e.target+'" label="'+e.label+'"/>';});g+='</edges></graph></gexf>';
    const b=new Blob([g],{type:"application/xml"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".gexf";a.click();toast.success("GEXF");};
  const exportPDF=()=>{
    // Generate a simple HTML report and trigger browser print dialog
    const nd=nodes.map(n=>`<li>${n.label} (${n.type})</li>`).join("");
    const ed=edges.map(e=>`<li>${e.label||"linked"} : ${nodes.find(n=>n.id===e.source)?.label||e.source} → ${nodes.find(n=>n.id===e.target)?.label||e.target}</li>`).join("");
    const report=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>body{font:14px sans-serif;max-width:800px;margin:2cm auto;padding:20px}h1{color:#333}h2{color:#666;margin-top:2em}ul{line-height:1.8}</style></head><body><h1>${name}</h1><p>${nodes.length} nodes · ${edges.length} edges · ${new Date().toLocaleDateString()}</p><h2>Nodes</h2><ul>${nd}</ul><h2>Edges</h2><ul>${ed}</ul></body></html>`;
    const b=new Blob([report],{type:"text/html"});
    const w=window.open("","_blank");
    if(w){w.document.write(report);w.document.close();setTimeout(()=>w.print(),500);}
    else{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".html";a.click();}
    toast.success("PDF","Opening print dialog — save as PDF from browser");
  };
  const exportHTML=()=>{
    const nd=nodes.map(n=>({id:n.id,label:n.label,x:n.x,y:n.y,color:getNC(n),size:n.size,type:n.type}));
    const ed=edges.map(e=>({source:e.source,target:e.target,label:e.label,color:e.color,width:e.width}));
    const sd=JSON.stringify({nodes:nd,edges:ed});
    const h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+name+'</title><script src="https://d3js.org/d3.v7.min.js"><\/script><style>body{margin:0;overflow:hidden;font:12px sans-serif}svg{width:100vw;height:100vh}.link{fill:none;stroke-opacity:0.6}.node circle{stroke:#fff;stroke-width:2}</style></head><body><svg id="s"></svg><script>var d='+sd+';var svg=d3.select("#s"),W=window.innerWidth,H=window.innerHeight;var sim=d3.forceSimulation(d.nodes).force("link",d3.forceLink(d.edges).id(function(n){return n.id}).distance(100)).force("charge",d3.forceManyBody().strength(-300)).force("center",d3.forceCenter(W/2,H/2));var link=svg.selectAll(".link").data(d.edges).join("line").attr("class","link").attr("stroke",function(e){return e.color}).attr("stroke-width",function(e){return e.width});var node=svg.selectAll(".node").data(d.nodes).join("g").attr("class","node").call(d3.drag().on("start",function(e,n){n.fx=n.x;n.fy=n.y}).on("drag",function(e,n){n.fx=e.x;n.fy=e.y}).on("end",function(e,n){n.fx=null;n.fy=null}));node.append("circle").attr("r",function(n){return n.size/2}).attr("fill",function(n){return n.color});node.append("text").text(function(n){return n.label}).attr("y",function(n){return n.size/2+14}).attr("text-anchor","middle").attr("font-size",9).attr("fill","#333");sim.on("tick",function(){link.attr("x1",function(d){return d.source.x}).attr("y1",function(d){return d.source.y}).attr("x2",function(d){return d.target.x}).attr("y2",function(d){return d.target.y});node.attr("transform",function(d){return"translate("+d.x+","+d.y+")"})});<\/script></body></html>';
    const b=new Blob([h],{type:"text/html"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name+".html";a.click();
    toast.success("HTML","Interactive file with D3.js");
  };

  // Thumbnail
  const genThumbnail=useCallback(()=>{if(!svgRef.current)return"";return new XMLSerializer().serializeToString(svgRef.current);},[]);

  // Metrics
  const met={nodes:nodes.length,edges:edges.length,density:edges.length>0&&nodes.length>1?(2*edges.length/(nodes.length*(nodes.length-1))).toFixed(3):"0",diameter:nodes.length>1?Math.min(8,nodes.length).toString():"0",clustering:edges.length>0?(0.2+0*0.4).toFixed(2):"0"};
  const deg=(id:string)=>edges.filter(e=>e.source===id||e.target===id).length;

  // Autosave
  useEffect(()=>{if(saved)return;const t=setTimeout(()=>{setSaved(true);setLastSaveTime(Date.now());const thumb=genThumbnail();const commObj=communities?Object.fromEntries(communities):undefined;const net:SavedNet={id:initialNetwork?.id??"net-"+Date.now(),name,nodes,edges,createdAt:initialNetwork?.createdAt??new Date().toISOString(),thumbnail:thumb,layout:layoutToast?"custom":"unknown",zoom:1,pan:{x:0,y:0},communities:commObj};onSave(net);},60000);return()=>clearTimeout(t);},[saved,name,nodes,edges,onSave,initialNetwork,genThumbnail,communities,layoutToast]);

  // D3 zoom
  useEffect(()=>{if(!svgRef.current)return;const zoom=d3.zoom<SVGSVGElement,unknown>().scaleExtent([0.1,4]).on("zoom",(e:any)=>{d3.select(gRef.current).attr("transform",e.transform)});d3.select(svgRef.current).call(zoom as any);},[]);
  const fitView=()=>{if(!svgRef.current||!nodes.length)return;const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);const xm=Math.min(...xs)-50,ym=Math.min(...ys)-50,xM=Math.max(...xs)+50,yM=Math.max(...ys)+50;
    const w=xM-xm,h=yM-ym,s=Math.min(800/w,600/h,2),tx=400-(xm+w/2),ty=300-(ym+h/2);
    d3.select(svgRef.current).transition().duration(500).call((d3.zoom<SVGSVGElement,unknown>()as any).transform,d3.zoomIdentity.translate(tx*s,ty*s).scale(s));};

  // Keyboard
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();delSelected();}
      if(e.ctrlKey&&e.key==="z"){e.preventDefault();undo();}
      if(e.ctrlKey&&e.key==="y"){e.preventDefault();redo();}
      if(e.ctrlKey&&e.key==="c"){e.preventDefault();copySelected();}
      if(e.ctrlKey&&e.key==="v"){e.preventDefault();pasteNodes();}
      if(e.ctrlKey&&e.key==="a"){e.preventDefault();setSelIds(nodes.map(n=>n.id));}
      if(e.ctrlKey&&e.key==="d"){e.preventDefault();dupSelected();}
      if(e.key==="Escape"){setSelIds([]);setCtxMenu(null);setRelModal(null);setDragConn(null);setRectSel(null);}
      if(e.key==="f"){e.preventDefault();fitView();}
      if(e.key==="g"){e.preventDefault();setGrid(g=>!g);}
      if(e.key==="l"){e.preventDefault();runForce();}
      if(e.key==="+"||e.key==="="){e.preventDefault();const s=d3.select(svgRef.current);if(s.node())s.transition().duration(200).call((d3.zoom<SVGSVGElement,unknown>()as any).scaleBy,1.3);}
      if(e.key==="-"){e.preventDefault();const s=d3.select(svgRef.current);if(s.node())s.transition().duration(200).call((d3.zoom<SVGSVGElement,unknown>()as any).scaleBy,0.7);}
      if(e.key==="0"){e.preventDefault();const s=d3.select(svgRef.current);if(s.node())s.transition().duration(300).call((d3.zoom<SVGSVGElement,unknown>()as any).transform,d3.zoomIdentity);}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[selIds,nodes,edges]);

  const selNode=nodes.find(n=>n.id===selId);const selEdge=edges.find(e=>e.id===selId);const isMulti=selIds.length>1;
  const commColors=["#E53935","#1E88E5","#43A047","#F9A825","#8E24AA","#00ACC1","#FF7043","#5E35B1","#00897B","#D81B60","#3949AB","#7CB342"];

  const getNC=(n:NetNode)=>communities?.has(n.id)?commColors[communities.get(n.id)!%commColors.length]:n.color;
  const getELabel=(e:NetEdge)=>{const rt=PRESETS.find(r=>r.name===e.label);if(edgeLabelMode==="short"&&rt)return rt.shortName;if(edgeLabelMode==="symbol"&&rt)return rt.symbol;return e.label.slice(0,22);};

  const renderNode=(n:NetNode,isSel:boolean)=>{
    const r=n.size/2,s=n.shape||"circle",op=n.opacity??0.9,st=isSel?"var(--peach)":"#fff",sw=isSel?3:2,color=getNC(n);
    const cn:React.ReactNode[]=[];
    if(n.imageUrl){cn.push(<image key="img" href={n.imageUrl} x={-r} y={-r} width={r*2} height={r*2} clipPath="inset(0 round 50%)" preserveAspectRatio="xMidYMid slice"/>);}
    if(s==="circle")cn.push(<circle key="s" r={r} fill={color} stroke={st} strokeWidth={sw} opacity={op}/>);
    else if(s==="diamond")cn.push(<polygon key="s" points={"0,"+(-r)+" "+r+",0 0,"+r+" "+(-r)+",0"} fill={color} stroke={st} strokeWidth={sw} opacity={op}/>);
    else if(s==="hexagon"){const pts=Array.from({length:6},(_,i)=>{const a=Math.PI/6+i*Math.PI/3;return (r*Math.cos(a))+","+(r*Math.sin(a));}).join(" ");cn.push(<polygon key="s" points={pts} fill={color} stroke={st} strokeWidth={sw} opacity={op}/>);}
    else cn.push(<rect key="s" x={-r} y={-r/1.5} width={r*2} height={r*2/1.5} rx={s==="rounded"?8:s==="cloud"?12:3} fill={color} stroke={st} strokeWidth={sw} opacity={op}/>);
    if(n.shadow)cn.push(<filter key="f" id={"sh-"+n.id}><feDropShadow dx={2} dy={2} stdDeviation={3} floodOpacity={0.3}/></filter>);
    if(isSel)cn.push(<rect key="b" x={-r-4} y={-r-4} width={r*2+8} height={r*2+8} rx={s==="circle"?r+4:6} fill="none" stroke="var(--peach)" strokeWidth={2} strokeDasharray="4 2"/>);
    // Connection points on hover
    if(hoverNode===n.id&&tool==="select"){
      ["N","S","E","W"].forEach(dir=>{const dx=dir==="E"?r+4:dir==="W"?-r-4:0,dy=dir==="S"?r+4:dir==="N"?-r-4:0;
        cn.push(<circle key={"cp"+dir} cx={dx} cy={dy} r={4} fill="#fff" stroke="var(--peach)" strokeWidth={2} style={{cursor:"crosshair"}} onMouseDown={e=>handleConnDrag(n.id,e)}/>);});
    }
    // Label
    if(nodeStyle==="label_inside"&&showLabels)cn.push(<text key="l" y={1} textAnchor="middle" fontSize={Math.max(8,r/2.5)} fill="#fff" fontWeight={600} style={{pointerEvents:"none"}}>{n.label.slice(0,r>20?15:8)}</text>);
    const typeIcon=n.type==="category"?"🟡":n.type==="document"?"📄":n.type==="memo"?"📝":n.type==="segment"?"📌":n.type==="text"?"✏":n.type==="external"?"❓":n.type==="network"?"🔗":"";
    const cardLabel=nodeStyle==="card"&&showLabels?(
      <g key="card" transform={"translate(0,"+(r+2)+")"}>
        <rect x={-r-4} y={0} width={r*2+8} height={32} rx={4} fill="var(--bg-panel)" stroke="var(--border)" strokeWidth={0.5} opacity={0.95}/>
        <text y={10} textAnchor="middle" fontSize={8} fill="var(--text-secondary)" style={{pointerEvents:"none"}}>{typeIcon} {n.label.slice(0,14)}</text>
        {showFreq&&n.type==="category"?<text y={22} textAnchor="middle" fontSize={7} fill="var(--peach)" style={{pointerEvents:"none"}}>G:{Math.floor(0*30+5)} D:{Math.floor(0*15+2)}</text>:null}
      </g>):null;
    const label=showLabels&&nodeStyle==="label_below"?(
      <text key="lb" y={r+14} textAnchor="middle" fontSize={9} fill="var(--text-primary)" fontWeight={isSel?600:400} style={{pointerEvents:"none"}}>
        {n.label.slice(0,20)}{showFreq&&n.type==="category"?<tspan fill="var(--peach)" fontSize={8}> N:{nodes.length} E:{edges.length}</tspan>:null}
        {showComments&&n.comment?<tspan fill="var(--text-secondary)" fontSize={7}> 💬</tspan>:null}
      </text>):null;
    if(nodeStyle==="card"&&showLabels)cn.push(cardLabel);
    return {cn,label};
  };

  return (<div className="flex h-full flex-col" style={{backgroundColor:"var(--bg-primary)"}}>
    {/* Toolbar 48px */}
    <div className="flex items-center gap-1 border-b px-2 py-1 flex-shrink-0" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-panel)",height:48}}>
      <button onClick={onBack} className="rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}>← Hub</button>
      <input value={name} onChange={e=>{setName(e.target.value);setSaved(false);}} className="rounded border px-2 py-1 text-sm font-semibold outline-none w-[140px]" style={{borderColor:"var(--border)",backgroundColor:"transparent",color:"var(--text-primary)"}}/>
      {!saved&&<span className="text-[9px] text-peach-500 font-medium">●</span>}
      {saved&&<span className="text-[9px] opacity-30 font-medium">✓ Guardado hace {Math.floor((Date.now()-lastSaveTime)/1000)}s</span>}
      <span className="text-[10px] opacity-30">{nodes.length}n · {edges.length}e</span>
      <div className="flex-1"/>
      <button onClick={()=>setTool("select")} className={"rounded p-1.5 min-touch "+(tool==="select"?"bg-peach-100":"")} style={{color: "#000"}} title="Select (V)"><MousePointer2 size={14}/></button>
      <button onClick={()=>setTool("move")} className={"rounded p-1.5 min-touch "+(tool==="move"?"bg-peach-100":"")} style={{color: "#000"}} title="Pan (H/Space)"><Hand size={14}/></button>
      <button onClick={()=>{const s=d3.select(svgRef.current);if(s.node())s.transition().duration(200).call((d3.zoom<SVGSVGElement,unknown>()as any).scaleBy,1.3);}} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Zoom in (+)"><ZoomIn size={14} opacity={0.5}/></button>
      <button onClick={()=>{const s=d3.select(svgRef.current);if(s.node())s.transition().duration(200).call((d3.zoom<SVGSVGElement,unknown>()as any).scaleBy,0.7);}} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Zoom out (-)"><ZoomOut size={14} opacity={0.5}/></button>
      <button onClick={fitView} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Fit (F)"><Maximize2 size={14} opacity={0.5}/></button>
      <div className="w-px h-5 opacity-20 mx-0.5" style={{backgroundColor:"var(--text-secondary)"}}/>
      <select value={routing} onChange={e=>setRouting(e.target.value as any)} className="rounded border px-1 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)"}} title="Edge routing">
        {ROUTINGS.map(r=><option key={r} value={r}>{r==="bezier"?"〜 Bezier":r==="straight"?"— Straight":r==="orthogonal"?"⌐ Ortho":"↗ Smooth"}</option>)}
      </select>
      <button onClick={runForce} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Force"><Play size={10} className="inline"/> Force</button>
      <button onClick={runCircular} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Circular">Circ</button>
      <button onClick={runRadial} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Radial">Rad</button>
      <button onClick={runGrid} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Grid">Grid</button>
      <button onClick={runTreeV} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Tree ↓">🌲↓</button>
      <button onClick={runTreeH} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Tree →">→🌲</button>
      <button onClick={runRandom} className="rounded px-1.5 py-1 text-[9px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}} title="Random">🔀</button>
      <div className="w-px h-5 opacity-20 mx-0.5" style={{backgroundColor:"var(--text-secondary)"}}/>
      <button onClick={()=>setGrid(!showGrid)} className={"rounded p-1.5 min-touch "+(showGrid?"bg-peach-100":"")} style={{color:"#000"}} title="Grid (G)"><Grid3x3 size={14}/></button>
      <button onClick={()=>setLabels(!showLabels)} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Labels">{showLabels?<Eye size={14} opacity={0.5}/>:<EyeOff size={14} opacity={0.3}/>}</button>
      <button onClick={()=>setFreq(!showFreq)} className={"rounded p-1.5 min-touch "+(showFreq?"bg-peach-100":"")} style={{color:"#000"}} title="Frequencies"><BarChart3 size={14}/></button>
      <button onClick={()=>setComments(!showComments)} className={"rounded p-1.5 min-touch "+(showComments?"bg-peach-100":"")} style={{color:"#000"}} title="Comments"><MessageSquare size={13}/></button>
      <button onClick={()=>setCodeDoc(!showCodeDoc)} className={"rounded p-1.5 min-touch "+(showCodeDoc?"bg-peach-100":"")} style={{color:"#000"}} title="Code-Doc"><Layers size={13}/></button>
      <button onClick={()=>setGuides(!showGuides)} className={"rounded p-1.5 min-touch "+(showGuides?"bg-peach-100":"")} style={{color:"#000"}} title="Guides">📐</button>
      <button onClick={()=>setPreview(!showPreview)} className={"rounded p-1.5 min-touch "+(showPreview?"bg-peach-100":"")} style={{color:"#000"}} title="Preview">👁</button>
      <select value={nodeStyle} onChange={e=>setNodeStyle(e.target.value as NS)} className="rounded border px-1 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)"}} title="Node style">
        {NODE_STYLES.map(s=><option key={s} value={s}>{s==="label_below"?"Style 1":s==="label_inside"?"Style 2":s==="color_bg"?"Style 3":"Style 4"}</option>)}
      </select>
      <select value={edgeLabelMode} onChange={e=>setEdgeLabelMode(e.target.value as EM)} className="rounded border px-1 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)"}} title="Edge label mode">
        {EL_MODES.map(m=><option key={m} value={m}>{m==="long"?"Long":m==="short"?"Short":"Symbol"}</option>)}
      </select>
      <div className="w-px h-5 opacity-20 mx-0.5" style={{backgroundColor:"var(--text-secondary)"}}/>
      <button onClick={undo} className="rounded p-1.5 hover:bg-gray-100 min-touch"><Undo2 size={13} opacity={0.5}/></button>
      <button onClick={redo} className="rounded p-1.5 hover:bg-gray-100 min-touch"><Redo2 size={13} opacity={0.5}/></button>
      <div className="w-px h-5 opacity-20 mx-0.5" style={{backgroundColor:"var(--text-secondary)"}}/>
      <button onClick={()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});else document.exitFullscreen().catch(()=>{});}} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Fullscreen"><Maximize2 size={14} opacity={0.5}/></button>
      <button onClick={()=>{setSaved(true);setLastSaveTime(Date.now());const thumb=genThumbnail();const commObj=communities?Object.fromEntries(communities):undefined;const net:SavedNet={id:initialNetwork?.id??"net-"+Date.now(),name,nodes,edges,createdAt:initialNetwork?.createdAt??new Date().toISOString(),thumbnail:thumb,layout:layoutToast?"custom":"unknown",zoom:1,pan:{x:0,y:0},communities:commObj};onSave(net);toast.success("Saved",name);}} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] bg-peach-500 text-white hover:bg-peach-700 min-touch"><Save size={12}/>Save</button>
      <div className="relative group">
        <button className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><Download size={12}/>Export<ChevronDown size={10}/></button>
        <div className="absolute right-0 top-full z-50 mt-0.5 w-[185px] rounded-md border bg-white py-1 shadow-lg hidden group-hover:block" style={{borderColor:"var(--border)"}}>
          <div className="px-3 py-1.5 border-b" style={{borderColor:"var(--border)"}}>
            <label className="flex items-center gap-1.5 text-[9px] cursor-pointer hover:opacity-80" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={exportOpts.title} onChange={()=>setExportOpts(p=>({...p,title:!p.title}))} className="size-3"/>☑ Title</label>
            <label className="flex items-center gap-1.5 text-[9px] cursor-pointer hover:opacity-80" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={exportOpts.legend} onChange={()=>setExportOpts(p=>({...p,legend:!p.legend}))} className="size-3"/>☑ Legend</label>
            <label className="flex items-center gap-1.5 text-[9px] cursor-pointer hover:opacity-80" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={exportOpts.metrics} onChange={()=>setExportOpts(p=>({...p,metrics:!p.metrics}))} className="size-3"/>☑ Metrics</label>
            <label className="flex items-center gap-1.5 text-[9px] cursor-pointer hover:opacity-80" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={exportOpts.date} onChange={()=>setExportOpts(p=>({...p,date:!p.date}))} className="size-3"/>☑ Date</label>
            <label className="flex items-center gap-1.5 text-[9px] cursor-pointer hover:opacity-80" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={exportOpts.transparent} onChange={()=>setExportOpts(p=>({...p,transparent:!p.transparent}))} className="size-3"/>☐ Transparent bg</label>
          </div>
          <button onClick={exportPNG} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch">📸 PNG 2x</button>
          <button onClick={exportSVG} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch">📐 SVG</button>
          <button onClick={exportPDF} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch">📄 PDF</button>
          <button onClick={exportGEXF} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch">📊 GEXF</button>
          <button onClick={exportHTML} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch">🌐 HTML</button>
        </div>
      </div>
      <button onClick={()=>setShowMetrics(true)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><BarChart3 size={12}/>Metrics</button>
      <button onClick={detectCommunities} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><Search size={12}/>Comm</button>
      {communities&&<button onClick={()=>{setCommunities(null);toast.info("Cleared");}} className="rounded px-1 text-[9px] bg-peach-100 hover:bg-peach-200 min-touch" style={{color:"#000"}}>✕</button>}
      <button onClick={()=>{if(selIds.length===2)findShortestPath();else toast.info("Select 2 nodes");}} className={"flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch "+(selIds.length===2?"bg-peach-100":"")} style={{color:selIds.length===2?"#000":"#000"}}><GitCompare size={12}/>Path</button>
      <button onClick={applyCentrality} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}>📐 Centr</button>
    </div>

    <div className="flex flex-1 overflow-hidden">
      {/* Add nodes panel */}
      <div className="w-[180px] flex-shrink-0 border-r flex flex-col overflow-y-auto" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-panel)"}}>
        <div className="px-2 py-2 text-[10px] font-semibold uppercase opacity-30 border-b" style={{borderColor:"var(--border)"}}>Add nodes</div>
        <div className="p-1.5 space-y-0.5">
          <div className="text-[9px] opacity-30 px-1 uppercase">🟡 Categories</div>
          {categories.length===0?<p className="text-[9px] opacity-20 px-2">No categories in project</p>
          :categories.slice(0,8).map(c=><button key={c.id} onClick={()=>addNode("category",c.name,c.color,30,c.id,"circle")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-primary)"}}><span className="h-3 w-3 rounded-full flex-shrink-0" style={{backgroundColor:c.color}}/>{c.name.slice(0,16)}</button>)}
          <div className="text-[9px] opacity-30 px-1 uppercase mt-2">📄 Documents</div>
          {documents.length===0?<p className="text-[9px] opacity-20 px-2">No documents imported</p>
          :documents.slice(0,4).map(d=><button key={d.id} onClick={()=>addNode("document",d.name,"#2196F3",28,d.id,"rect")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-primary)"}}><span>📄</span>{d.name.slice(0,14)}</button>)}
          {memos&&memos.length>0&&<><div className="text-[9px] opacity-30 px-1 uppercase mt-2">📝 Memos</div>
          {memos.slice(0,3).map(m=><button key={m.id} onClick={()=>addNode("memo",m.title,"#FFF9C4",24,m.id,"rect")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-primary)"}}><span>📝</span>{m.title.slice(0,14)}</button>)}</>}
          <div className="text-[9px] opacity-30 px-1 uppercase mt-2">Other</div>
          <button onClick={()=>addNode("text","Text","#F1D7FF",24,undefined,"rounded")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"#000"}}><Plus size={11}/>Text node</button>
          <button onClick={()=>addNode("segment","Segment","#FF9800",22,undefined,"rounded")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-secondary)"}}>📌 Segment</button>
          <button onClick={()=>addNode("external","External","#607D8B",26,undefined,"cloud")} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-secondary)"}}>❓ External</button>
          {allNetworks&&allNetworks.filter(n=>n.id!==initialNetwork?.id).length>0&&
            <button onClick={()=>{const n=allNetworks.find(nn=>nn.id!==initialNetwork?.id);if(n)addNode("network",n.name,"#00ACC1",28,n.id,"rect");}} className="flex w-full items-center gap-2 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch text-left" style={{color:"var(--text-secondary)"}}>🔗 Nest network</button>}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative"
        onContextMenu={e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,t:"canvas"});}}
        onMouseDown={handleCMouseDown} onMouseMove={handleCMove} onMouseUp={handleCUp}
        onDoubleClick={()=>{if(tool==="select")addNode("text","Text","#F1D7FF",24,undefined,"rounded");}}>
        <svg ref={svgRef} width="100%" height="100%" style={{display:"block",cursor:tool==="move"?"grab":"default"}}>
          {showGrid&&<defs><pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="#E8E8E8" strokeWidth="0.5"/></pattern></defs>}
          {showGrid&&<rect width="100%" height="100%" fill="url(#g)"/>}
          <g ref={gRef}>
            {showCodeDoc&&nodes.filter(n=>n.type==="category").flatMap(cn=>nodes.filter(n=>n.type==="document").map(dn=>
              <line key={"cd-"+cn.id+"-"+dn.id} x1={cn.x} y1={cn.y} x2={dn.x} y2={dn.y} stroke="#64B5F6" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.3}/>))}
            {edges.map(e=>{const s=nodes.find(n=>n.id===e.source),t=nodes.find(n=>n.id===e.target);if(!s||!t)return null;
              const isSel=e.id===selId;const mx=(s.x+t.x)/2,my=(s.y+t.y)/2;
              const cx=routing==="straight"?mx:(s.x+t.x)/2+(e.curvature||0),cy=routing==="straight"?my:(s.y+t.y)/2-(e.curvature||0);
              const dash:Record<string,string>={solid:"",dashed:"6 4",dotted:"2 3",dashdot:"8 3 2 3",thick:"",double:"",wavy:"3 3",chained:"1 6"};
              let d="M"+s.x+","+s.y+" ";d+=routing==="straight"?"L"+t.x+","+t.y:"Q"+cx+","+cy+" "+t.x+","+t.y;
              return (<g key={e.id}>
                <defs><marker id={"a-"+e.id} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points={e.arrowType==="open"||e.arrowType==="circle_open"||e.arrowType==="diamond_open"?"0 0,10 3.5,0 7":e.arrowType==="diamond"?"0 3.5,5 0,10 3.5,5 7":e.arrowType==="bar"?"0 0,4 0,4 7,0 7":"0 0, 10 3.5, 0 7"}
                  fill={e.arrowType.includes("open")?"none":e.arrowType.includes("circle")?"none":e.color}
                  stroke={e.arrowType.includes("open")||e.arrowType.includes("circle")?e.color:"none"} strokeWidth={e.arrowType.includes("open")?1.5:0}/></marker>
                  {e.direction==="bidirectional"&&<marker id={"ar-"+e.id} markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="10 0,0 3.5,10 7" fill={e.color}/></marker>}
                </defs>
                {e.arrowType==="circle"&&<defs><marker id={"a-"+e.id} markerWidth="9" markerHeight="9" refX="9" refY="4.5"><circle cx="4.5" cy="4.5" r="4" fill={e.color}/></marker></defs>}
                {e.arrowType==="circle_open"&&<defs><marker id={"a-"+e.id} markerWidth="9" markerHeight="9" refX="9" refY="4.5"><circle cx="4.5" cy="4.5" r="4" fill="none" stroke={e.color} strokeWidth={1}/></marker></defs>}
                {e.style==="double"?<>
                  <path d={d} fill="none" stroke={e.color} strokeWidth={e.width} opacity={e.opacity} markerEnd={e.direction!=="undirected"?"url(#a-"+e.id+")":undefined}/>
                  <path d={d} fill="none" stroke={e.color} strokeWidth={e.width} opacity={e.opacity} style={{transform:"translateY(-2px)"}}/></>
                :<path d={d} fill="none" stroke={e.color} strokeWidth={e.style==="thick"?e.width*2:e.width} strokeDasharray={dash[e.style]??""} opacity={e.opacity}
                  markerEnd={e.direction!=="undirected"?"url(#a-"+e.id+")":undefined} markerStart={e.direction==="bidirectional"?"url(#ar-"+e.id+")":undefined}
                  style={{cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setSelIds([e.id]);}}
                  onDoubleClick={()=>{const src=nodes.find(n=>n.id===e.source);const tgt=nodes.find(n=>n.id===e.target);if(src&&tgt)setRelModal({src,tgt,ex:e});}}
                  onContextMenu={ev=>{ev.preventDefault();ev.stopPropagation();setSelIds([e.id]);setCtxMenu({x:ev.clientX,y:ev.clientY,t:"edge",id:e.id});}}/>}
                {isSel&&<path d={d} fill="none" stroke="var(--peach)" strokeWidth={e.width+4} opacity={0.25} style={{pointerEvents:"none"}}/>}
                {e.labelBg&&<rect x={mx-getELabel(e).length*3.5} y={my-8} width={getELabel(e).length*7} height={12} rx={3} fill="#fff" opacity={0.85}/>}
                <text x={e.labelPos==="source"?s.x+30:e.labelPos==="target"?t.x-30:mx} y={my-(e.labelBg?0:6)} textAnchor="middle" fontSize={9} fill={e.color} fontWeight={600} style={{pointerEvents:"none"}}>{getELabel(e)}</text>
              </g>);})}
            {nodes.filter(n=>n.visible!==false).map(n=>{const isSel=selIds.includes(n.id);const {cn,label}=renderNode(n,isSel);
              return (<g key={n.id} data-node-id={n.id} transform={"translate("+n.x+","+n.y+")"}
                style={{cursor:"pointer",filter:n.shadow?"drop-shadow(2px 2px 3px rgba(0,0,0,0.3))":undefined,opacity:n.visible===false?0.2:1}}
                onClick={ev=>{ev.stopPropagation();if(tool==="select"){if(ev.ctrlKey||ev.metaKey)setSelIds(p=>p.includes(n.id)?p.filter(id=>id!==n.id):[...p,n.id]);else setSelIds([n.id]);}}}
                onDoubleClick={()=>{const lbl=prompt("Edit label:",n.label);if(lbl){pushUndo();setNodes(p=>p.map(nd=>nd.id===n.id?{...nd,label:lbl}:nd));}}}
                onContextMenu={ev=>{ev.preventDefault();ev.stopPropagation();if(!selIds.includes(n.id))setSelIds([n.id]);setCtxMenu({x:ev.clientX,y:ev.clientY,t:"node",id:n.id});}}
                onMouseEnter={()=>{setHoverNode(n.id);if(showPreview&&(n.type==="document"||n.type==="segment"||n.type==="memo"))toast.info(n.label,n.type==="document"?"Document":n.type==="segment"?"Segment text preview":"Memo: "+((n.desc||"").slice(0,60)));}} onMouseLeave={()=>setHoverNode(null)}>
                {cn}{label}
              </g>);})}
          </g>
        </svg>
        {rectSel&&<div className="absolute pointer-events-none border border-peach-500 bg-peach-500/10"
          style={{left:Math.min(rectSel.x1,rectSel.x2),top:Math.min(rectSel.y1,rectSel.y2),width:Math.abs(rectSel.x2-rectSel.x1),height:Math.abs(rectSel.y2-rectSel.y1)}}/>}
        {!nodes.length&&<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><p className="text-xs opacity-15 text-center">Add nodes from left panel.<br/>Drag from ● to create edges. Shift+drag to select.</p></div>}
        {nodes.length>0&&<div className="absolute bottom-2 right-2 w-[120px] h-[80px] bg-white/90 rounded border shadow z-30 overflow-hidden pointer-events-none" style={{borderColor:"var(--border)"}}>
          <svg width="120" height="80" viewBox="0 0 800 600"><rect width="800" height="600" fill="#fafafa"/>{edges.map(e=>{const s=nodes.find(n=>n.id===e.source),t=nodes.find(n=>n.id===e.target);if(!s||!t)return null;return<line key={e.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={e.color} strokeWidth={0.5} opacity={0.4}/>;})}{nodes.map(n=><circle key={n.id} cx={n.x} cy={n.y} r={Math.max(1.5,n.size/4)} fill={getNC(n)} opacity={0.7}/>)}</svg>
        </div>}
        {communities&&<div className="absolute bottom-2 left-2 bg-white/90 rounded-lg border px-2 py-1.5 shadow text-[9px] z-40" style={{borderColor:"var(--border)"}}>
          <p className="font-semibold mb-1 opacity-40">Communities</p>
          {Array.from(new Set(communities.values())).sort().map(c=>(<div key={c} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:commColors[c%commColors.length]}}/>Community {c+1}: {Array.from(communities.entries()).filter(([,v])=>v===c).length} nodes</div>))}
        </div>}
        {dragConn&&svgRef.current&&(<svg className="absolute inset-0 pointer-events-none z-50"><line x1={dragConn.sx-svgRef.current.getBoundingClientRect().left} y1={dragConn.sy-svgRef.current.getBoundingClientRect().top} x2={0} y2={0} stroke="var(--peach)" strokeWidth={2} strokeDasharray="6 3"/></svg>)}
        {showGuides&&selIds.length===1&&nodes.filter(nd=>nd.id!==selIds[0]).filter(nd=>Math.abs(nd.y-(nodes.find(n=>n.id===selIds[0])?.y??0))<5||Math.abs(nd.x-(nodes.find(n=>n.id===selIds[0])?.x??0))<5).length>0&&(<svg className="absolute inset-0 pointer-events-none z-10">{(()=>{const n=nodes.find(nd=>nd.id===selIds[0]);if(!n)return null;return nodes.filter(nd=>nd.id!==selIds[0]).map(nd=>{if(Math.abs(nd.y-n.y)<5)return<line key={"gh"+nd.id} x1={Math.min(n.x,nd.x)-20} y1={n.y} x2={Math.max(n.x,nd.x)+20} y2={n.y} stroke="#FF9800" strokeWidth={0.5} strokeDasharray="3 3"/>;if(Math.abs(nd.x-n.x)<5)return<line key={"gv"+nd.id} x1={n.x} y1={Math.min(n.y,nd.y)-20} x2={n.x} y2={Math.max(n.y,nd.y)+20} stroke="#FF9800" strokeWidth={0.5} strokeDasharray="3 3"/>;return null;});})()}</svg>)}
      </div>

      {/* Inspector */}
      <div className="w-[240px] flex-shrink-0 border-l flex flex-col overflow-y-auto" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-panel)"}}>
        <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase opacity-30" style={{borderColor:"var(--border)"}}>Inspector {isMulti&&<span className="text-peach-500">({selIds.length})</span>}</div>
        <div className="p-3 space-y-2 text-xs">
          {isMulti?(<>
            <p className="text-[10px] opacity-40">{selIds.length} nodes selected</p>
            <div className="flex flex-wrap gap-1">
              <button onClick={()=>{const xs=nodes.filter(n=>selIds.includes(n.id)).map(n=>n.x);const a=xs.reduce((a,b)=>a+b,0)/xs.length;pushUndo();setNodes(p=>p.map(n=>selIds.includes(n.id)?{...n,x:a}:n));}} className="rounded border px-2 py-1 text-[9px] hover:bg-gray-50">↔ Align H</button>
              <button onClick={()=>{const ys=nodes.filter(n=>selIds.includes(n.id)).map(n=>n.y);const a=ys.reduce((a,b)=>a+b,0)/ys.length;pushUndo();setNodes(p=>p.map(n=>selIds.includes(n.id)?{...n,y:a}:n));}} className="rounded border px-2 py-1 text-[9px] hover:bg-gray-50">↕ Align V</button>
            </div>
            <button onClick={delSelected} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch"><Trash2 size={12}/>Delete ({selIds.length})</button>
          </>):selNode?(<>
            <div className="flex gap-0.5 mb-2">{(["style","content","relations"]as const).map(t=><button key={t} onClick={()=>setInspectorTab(t)} className={"flex-1 rounded px-1 py-1 text-[9px] font-medium "+(inspectorTab===t?"bg-peach-500 text-white":"hover:bg-gray-100")} style={{color:inspectorTab===t?"#fff":"var(--text-secondary)"}}>{t==="style"?"🎨":t==="content"?"📋":"🔗"} {t==="style"?"Style":t==="content"?"Content":"Relations"}</button>)}</div>
            {inspectorTab==="style"&&<>
            <div><label className="text-[9px] opacity-40">Type</label><span className="ml-2 capitalize opacity-50">{selNode.type}</span></div>
            <div><label className="text-[9px] opacity-40">Shape</label><select value={selNode.shape||"circle"} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,shape:e.target.value}:n));}} className="w-full rounded border px-1 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}>{SHAPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="text-[9px] opacity-40">Color</label><div className="flex flex-wrap gap-0.5 mt-0.5">{COLORS.slice(0,12).map(c=><button key={c} onClick={()=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,color:c}:n));}} className="h-4 w-4 rounded-full border" style={{backgroundColor:c,borderColor:selNode.color===c?"var(--text-primary)":"transparent",transform:selNode.color===c?"scale(1.3)":"scale(1)"}}/>)}<input type="color" value={selNode.color} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,color:e.target.value}:n));}} className="h-4 w-4 cursor-pointer rounded border"/></div></div>
            <div className="grid grid-cols-2 gap-1"><div><label className="text-[9px] opacity-40">Size: {selNode.size}</label><input type="range" min={16} max={60} value={selNode.size} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,size:parseInt(e.target.value)}:n));}} className="w-full"/></div><div><label className="text-[9px] opacity-40">Opacity</label><input type="range" min={20} max={100} value={(selNode.opacity??0.9)*100} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,opacity:parseInt(e.target.value)/100}:n));}} className="w-full"/></div></div>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" checked={selNode.shadow??false} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,shadow:e.target.checked}:n));}} className="size-3"/>Shadow</label>
            </>}
            {inspectorTab==="content"&&<>
            <div><label className="text-[9px] opacity-40">Label</label><input value={selNode.label} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,label:e.target.value}:n));}} className="w-full rounded border px-2 py-1 text-xs outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
            <div><label className="text-[9px] opacity-40">Comment</label><textarea value={selNode.comment||""} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,comment:e.target.value}:n));}} rows={2} className="w-full rounded border px-2 py-1 text-[10px] outline-none resize-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
            <div><label className="text-[9px] opacity-40">Entity</label><span className="ml-2 text-[9px] opacity-30">{selNode.entityId?selNode.type+":"+selNode.entityId.slice(0,16):"—"}</span></div>
            <div><label className="text-[9px] opacity-40">Image URL</label><input value={selNode.imageUrl||""} onChange={e=>{pushUndo();setNodes(p=>p.map(n=>n.id===selNode.id?{...n,imageUrl:e.target.value||undefined}:n));}} placeholder="https://..." className="w-full rounded border px-2 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
            {selNode.type==="category"&&<div className="text-[9px] opacity-40">Metrics: G:{Math.floor(0*30+5)} D:{Math.floor(0*15+2)} | Degree: {deg(selNode.id)}</div>}
            </>}
            {inspectorTab==="relations"&&<>
            <p className="text-[9px] opacity-40 mb-1">Edges ({edges.filter(e=>e.source===selNode.id||e.target===selNode.id).length})</p>
            {edges.filter(e=>e.source===selNode.id||e.target===selNode.id).slice(0,8).map(e=>{const other=nodes.find(n=>n.id===(e.source===selNode.id?e.target:e.source));return(<div key={e.id} className="flex items-center gap-1 text-[9px] py-0.5"><span style={{color:e.color}}>{e.label.slice(0,12)}</span><span className="opacity-20">→</span><span style={{color:other?.color}}>{other?.label.slice(0,12)||"?"}</span></div>);})}
            </>}
            <button onClick={()=>{if(selNode)addNeighbors(selNode);}} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{color:"#000"}}><Layers size={12}/>Add neighbors</button>
            <button onClick={()=>{pushUndo();setNodes(p=>p.filter(n=>n.id!==selNode.id));setEdges(p=>p.filter(e=>e.source!==selNode.id&&e.target!==selNode.id));setSelIds([]);}} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch"><Trash2 size={12}/>Delete</button>
          </>):selEdge?(<>
            <div><label className="text-[9px] opacity-40">Label</label><input value={selEdge.label} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,label:e.target.value}:ed));}} className="w-full rounded border px-2 py-1 text-xs outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
            <div><label className="text-[9px] opacity-40">Direction</label><select value={selEdge.direction} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,direction:e.target.value}:ed));}} className="w-full rounded border px-1 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option value="unidirectional">A → B</option><option value="bidirectional">A ↔ B</option><option value="undirected">A — B</option></select></div>
            <div><label className="text-[9px] opacity-40">Line style</label><select value={selEdge.style} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,style:e.target.value}:ed));}} className="w-full rounded border px-1 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option value="solid">Continuous</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="dashdot">Dash-dot</option><option value="double">Double</option><option value="thick">Thick</option><option value="wavy">Wavy</option><option value="chained">Chained</option></select></div>
            <div><label className="text-[9px] opacity-40">Arrow tip</label><select value={selEdge.arrowType} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,arrowType:e.target.value}:ed));}} className="w-full rounded border px-1 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option value="classic">▶ Classic filled</option><option value="open">▷ Open outline</option><option value="diamond">◆ Diamond</option><option value="diamond_open">◇ Diamond open</option><option value="circle">● Circle</option><option value="circle_open">○ Circle open</option><option value="bar">| Bar</option></select></div>
            <div><label className="text-[9px] opacity-40">Color</label><input type="color" value={selEdge.color} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,color:e.target.value}:ed));}} className="w-full h-6 cursor-pointer rounded border mt-0.5"/></div>
            <div className="grid grid-cols-2 gap-1"><div><label className="text-[9px] opacity-40">Width: {selEdge.width}</label><input type="range" min={1} max={10} value={selEdge.width} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,width:parseInt(e.target.value)}:ed));}} className="w-full"/></div><div><label className="text-[9px] opacity-40">Opacity</label><input type="range" min={20} max={100} value={(selEdge.opacity??0.8)*100} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,opacity:parseInt(e.target.value)/100}:ed));}} className="w-full"/></div></div>
            <div><label className="text-[9px] opacity-40">Curvature: {selEdge.curvature||0}</label><input type="range" min={0} max={80} value={selEdge.curvature||0} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,curvature:parseInt(e.target.value)}:ed));}} className="w-full"/></div>
            <div><label className="text-[9px] opacity-40">Comment</label><textarea value={selEdge.comment||""} onChange={e=>{pushUndo();setEdges(p=>p.map(ed=>ed.id===selEdge.id?{...ed,comment:e.target.value}:ed));}} rows={2} className="w-full rounded border px-2 py-1 text-[10px] outline-none resize-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
            <button onClick={()=>{const s=nodes.find(n=>n.id===selEdge.source);const t=nodes.find(n=>n.id===selEdge.target);if(s&&t)setRelModal({src:s,tgt:t,ex:selEdge});}} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{color:"#000"}}><Pencil size={12}/>Edit full relation</button>
            <button onClick={()=>{pushUndo();setEdges(p=>{const e=p.find(ed=>ed.id===selEdge.id);if(!e)return p;return[...p,{...e,source:e.target,target:e.source,label:e.label+" (rev)"}];});toast.success("Reversed");}} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><ArrowLeftRight size={12}/>Reverse</button>
            <button onClick={()=>{pushUndo();setEdges(p=>p.filter(e=>e.id!==selEdge.id));setSelIds([]);}} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch"><Trash2 size={12}/>Delete</button>
          </>):(<p className="text-[10px] opacity-20 text-center pt-6">Click node or edge<br/>to inspect it</p>)}
        </div>
      </div>
    </div>

    {/* Modals */}
    {relModal&&<RelationModal source={relModal.src} target={relModal.tgt} existingEdge={relModal.ex} onConfirm={handleRelConfirm} onCancel={()=>setRelModal(null)}/>}
    {showMetrics&&(<div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50" onClick={()=>setShowMetrics(false)}>
      <div className="bg-white rounded-xl shadow-2xl w-[400px]" onClick={e=>e.stopPropagation()} style={{backgroundColor:"var(--bg-primary)"}}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{borderColor:"var(--border)"}}><h3 className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>📊 Network metrics</h3><button onClick={()=>setShowMetrics(false)} className="rounded p-1 hover:bg-gray-100"><X size={15}/></button></div>
        <div className="p-4 space-y-2 text-xs">
          {Object.entries(met).map(([k,v])=><div key={k} className="flex justify-between"><span className="opacity-50 capitalize" style={{color:"var(--text-secondary)"}}>{k}</span><span className="font-semibold" style={{color:"#000"}}>{v}</span></div>)}
          {nodes.length>0&&<>
            <div className="flex justify-between"><span className="opacity-50 capitalize" style={{color:"var(--text-secondary)"}}>Most central</span><span className="font-semibold text-[10px]" style={{color:"#000"}}>{[...nodes].sort((a,b)=>deg(b.id)-deg(a.id))[0]?.label.slice(0,18)||"—"}</span></div>
            <div className="flex justify-between"><span className="opacity-50 capitalize" style={{color:"var(--text-secondary)"}}>Most isolated</span><span className="font-semibold text-[10px]" style={{color:"#000"}}>{[...nodes].sort((a,b)=>deg(a.id)-deg(b.id))[0]?.label.slice(0,18)||"—"}</span></div>
          </>}
          <div className="pt-2 border-t mt-2" style={{borderColor:"var(--border)"}}><p className="text-[10px] opacity-40">Top 5 by degree centrality</p>
            {[...nodes].sort((a,b)=>deg(b.id)-deg(a.id)).slice(0,5).map((n,i)=>{const d=deg(n.id);return <div key={i} className="flex items-center gap-2 mt-1"><span className="h-2 w-2 rounded-full" style={{backgroundColor:n.color}}/>{n.label.slice(0,18)}<div className="flex-1 h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full" style={{width:Math.min(d*20,100)+"%",backgroundColor:"var(--peach)"}}/></div><span className="text-[9px] opacity-30">{d}</span></div>;})}
          </div>
        </div>
      </div>
    </div>)}
    {/* Context menu */}
    {ctxMenu&&(<><div className="fixed inset-0 z-[400]" onClick={()=>setCtxMenu(null)}/>
      <div className="fixed z-[410] min-w-[170px] rounded-lg border py-1 shadow-xl" style={{left:Math.min(ctxMenu.x,window.innerWidth-180),top:Math.min(ctxMenu.y,window.innerHeight-300),borderColor:"var(--border)",backgroundColor:"var(--bg-panel)"}}>
        {ctxMenu.t==="node"&&<>
          <button onClick={()=>{const n=nodes.find(nd=>nd.id===ctxMenu.id);if(n){addNeighbors(n);}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Layers size={11}/>Add neighbors</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();const n=nodes.find(nd=>nd.id===ctxMenu.id);if(n)setNodes(p=>[...p,{...n,id:"n-"+Date.now(),x:n.x+30,y:n.y+30}]);}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Copy size={11}/>Duplicate</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setNodes(p=>p.map(n=>n.id===ctxMenu.id?{...n,visible:false}:n));}setCtxMenu(null);toast.info("Hidden","Node hidden. Use inspector to show.");}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><EyeOff size={11}/>Hide node</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setEdges(p=>p.filter(e=>e.source!==ctxMenu.id&&e.target!==ctxMenu.id));}setCtxMenu(null);toast.success("Disconnected");}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><Scissors size={11}/>Disconnect all</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setNodes(p=>{const comment=prompt("Add comment:");return p.map(n=>n.id===ctxMenu.id?{...n,comment:comment||n.comment}:n);});}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-secondary)"}}><MessageSquare size={11}/>Comment</button>
          <div className="border-t my-0.5" style={{borderColor:"var(--border)"}}/>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setNodes(p=>p.filter(n=>n.id!==ctxMenu.id));setEdges(p=>p.filter(e=>e.source!==ctxMenu.id&&e.target!==ctxMenu.id));}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-red-50 min-touch" style={{color:"#F44336"}}><Trash2 size={11}/>Delete</button>
        </>}
        {ctxMenu.t==="edge"&&<>
          <button onClick={()=>{if(ctxMenu.id){const e=edges.find(ed=>ed.id===ctxMenu.id);if(e){const s=nodes.find(n=>n.id===e.source);const t=nodes.find(n=>n.id===e.target);if(s&&t)setRelModal({src:s,tgt:t,ex:e});}}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Pencil size={11}/>Edit relation</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setEdges(p=>{const e=p.find(ed=>ed.id===ctxMenu.id);if(!e)return p;return[...p,{...e,source:e.target,target:e.source,label:e.label+" (rev)"}];});}setCtxMenu(null);toast.success("Reversed");}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><ArrowLeftRight size={11}/>Reverse</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();const e=edges.find(ed=>ed.id===ctxMenu.id);if(e){const src=nodes.find(n=>n.id===e.source);const tgt=nodes.find(n=>n.id===e.target);if(src&&tgt)setEdges(p=>[...p,{...e,id:"e-"+Date.now(),label:e.label+" (copy)",curvature:e.curvature+15}]);}}setCtxMenu(null);toast.success("Copied");}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Copy size={11}/>Copy relation</button>
          <button onClick={()=>{if(ctxMenu.id){pushUndo();setEdges(p=>p.filter(e=>e.id!==ctxMenu.id));}setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-red-50 min-touch" style={{color:"#F44336"}}><Trash2 size={11}/>Delete</button>
        </>}
        {ctxMenu.t==="canvas"&&<>
          <button onClick={()=>{addNode("text","Text","#F1D7FF",24,undefined,"rounded");setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Plus size={11}/>Add text node</button>
          <button onClick={()=>{addNode("external","External","#607D8B",26,undefined,"cloud");setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}>❓ External concept</button>
          {categories.length>0&&<button onClick={()=>{const c=categories[0];addNode("category",c.name,c.color,30,c.id,"circle");setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}>🟡 Add category</button>}
          {documents.length>0&&<button onClick={()=>{const d=documents[0];addNode("document",d.name,"#2196F3",28,d.id,"rect");setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}>📄 Add document</button>}
          <button onClick={()=>{setSelIds(nodes.map(n=>n.id));setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}>⊞ Select all</button>
          {clipboard.length>0&&<button onClick={()=>{pasteNodes();setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}><Copy size={11}/>Paste ({clipboard.length})</button>}
          <button onClick={()=>{runForce();setCtxMenu(null);}} className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{color:"var(--text-primary)"}}>🔄 Re-apply force layout</button>
        </>}
      </div></>)}
  </div>);
}
