"use client";
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { api,useSession } from '@/components/session';
export function ReportNotice(){const {user,permissions}=useSession();const [count,setCount]=useState(0);const allowed=permissions.includes('*')||permissions.includes('operations:reports');
 useEffect(()=>{if(!user||!allowed)return;const controller=new AbortController();let pending=false;async function refresh(){if(document.hidden||pending)return;pending=true;try{const data=await api('/api/operations/report-jobs',{signal:controller.signal});if(!controller.signal.aborted)setCount(data.rows.filter((r:{status:string;notified_at:string|null})=>r.status==='READY'&&!r.notified_at).length);}catch{/* Availability is shown in the report queue; no token/error details in the navigation. */}finally{pending=false;}}void refresh();const timer=setInterval(refresh,20000);return()=>{controller.abort();clearInterval(timer);};},[user,allowed]);
 return <Link href="/operacao/prontos"><span aria-live="polite">Relatórios prontos{count?` (${count} novos)`:''}</span></Link>;
}
