"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/session";
import type { GeoFeature } from "@/lib/modules/domain";
export type Tiles={template:string;attribution:string;policy:string};
export function MapServices({onTiles,onPoint,onInspections}:{onTiles:(v:Tiles|null)=>void;onPoint:(lat:number,lon:number)=>void;onInspections:(f:GeoFeature[])=>void}) {
 const [config,setConfig]=useState<{tiles:Tiles|null;geocoder:boolean}>();const [query,setQuery]=useState("");const [message,setMessage]=useState("");const [results,setResults]=useState<{label:string;latitude:number;longitude:number}[]>([]);
 useEffect(()=>{fetch("/api/modules/geospatial/services").then(r=>r.json()).then(d=>{setConfig(d);if(d.error)setMessage(d.error);}).catch(e=>setMessage(e.message));},[]);
 return <fieldset><legend>Base cartográfica, endereço e fiscalização</legend>{config?.tiles&&<><label><input type="checkbox" onChange={e=>onTiles(e.target.checked?config.tiles:null)}/> Exibir base configurada</label><p>{config.tiles.attribution} · <a href={config.tiles.policy} target="_blank" rel="noreferrer">Política de uso da base</a></p></>}{config?.geocoder&&<><label>Endereço<input value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="btn" onClick={async()=>{try{const r=await fetch(`/api/modules/geospatial/services?q=${encodeURIComponent(query)}`);const d=await r.json();if(!r.ok)throw new Error(d.error);setResults(d.results);}catch(e){setMessage((e as Error).message);}}}>Localizar</button>{results.map((r,i)=><button className="btn" key={i} onClick={()=>onPoint(r.latitude,r.longitude)}>{r.label}</button>)}</>}<button className="btn" onClick={()=>api("/api/modules/geospatial/services?mode=inspections").then(d=>{onInspections(d.features);setMessage(`${d.features.length} fiscalizações autorizadas carregadas.`);}).catch(e=>setMessage(e.message))}>Carregar minhas fiscalizações autorizadas</button><p role="status">{message}</p></fieldset>;
}
export function MapTiles({tiles,bounds,project}:{tiles:Tiles;bounds:number[];project:(p:[number,number])=>[number,number]}) {
 if(!bounds.every(Number.isFinite))return null;
 const span=Math.max(bounds[2]-bounds[0],0.001);const z=Math.max(1,Math.min(18,Math.floor(Math.log2(360/span))+1));const n=2**z;
 const tileY=(lat:number)=>(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n;
 const x0=Math.floor((bounds[0]+180)/360*n),x1=Math.floor((bounds[2]+180)/360*n),y0=Math.floor(tileY(bounds[3])),y1=Math.floor(tileY(bounds[1]));
 if((x1-x0+1)*(y1-y0+1)>64)return null;
 const elements=[];for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
 const lon=(v:number)=>v/n*360-180,lat=(v:number)=>Math.atan(Math.sinh(Math.PI*(1-2*v/n)))*180/Math.PI;
 const a=project([lon(x),lat(y)]),b=project([lon(x+1),lat(y+1)]);
 elements.push(<image key={`${x}-${y}`} href={tiles.template.replace("{z}",String(z)).replace("{x}",String(x)).replace("{y}",String(y))} x={a[0]} y={a[1]} width={b[0]-a[0]} height={b[1]-a[1]} preserveAspectRatio="none"/>);
 }
 return <g pointerEvents="none">{elements}</g>;
}
