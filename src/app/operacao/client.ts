"use client";
import { firebaseClient } from "@/lib/firebase-client";
export async function saveFile(url:string,name:string,method="GET"){
 const token=await firebaseClient().currentUser?.getIdToken();const res=await fetch(url,{method,headers:{Authorization:`Bearer ${token??""}`}});
 if(!res.ok){const data=await res.json();throw new Error(data.error||"Falha no download.");}
 const blob=await res.blob(),href=URL.createObjectURL(blob);const a=document.createElement("a");a.href=href;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
