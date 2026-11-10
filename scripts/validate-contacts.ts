/** Opt-in HTTP/Firebase/PostgreSQL contact contracts. Never imported by application code. */
import {randomUUID,randomBytes,createHash,createCipheriv} from "node:crypto";
import {mkdirSync,writeFileSync,readFileSync,renameSync} from "node:fs";
import {resolve,join,relative} from "node:path";
import {neon} from "@neondatabase/serverless";
import {firebaseAdminAuth} from "../src/lib/firebase-admin";
type Row=Record<string,any>;
type Entry={table:string;key:string;value:string};
type Evidence={assertion:string;outcome:"PASS"|"FAIL";status?:number;diagnostic?:string};
const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
if(!args.includes("--allow-write")||!option("--base"))throw new Error("REQUIRED_ALLOW_WRITE_AND_BASE");
const base=new URL(option("--base")!);
if(!["http:","https:"].includes(base.protocol)||base.username||base.password||base.pathname!=="/"||base.search||base.hash)throw new Error("INVALID_BASE");
for(const name of ["DATABASE_URL","NEXT_PUBLIC_FIREBASE_API_KEY","FIREBASE_ADMIN_PROJECT_ID","FIREBASE_ADMIN_CLIENT_EMAIL","FIREBASE_ADMIN_PRIVATE_KEY"])if(!process.env[name])throw new Error(`MISSING_${name}`);
const sql=neon(process.env.DATABASE_URL!),auth=firebaseAdminAuth();
let adminUid=option("--admin-uid")??process.env.VALIDATION_ADMIN_UID??process.env.SERVICE_ADMIN_UID;
if(!adminUid&&!args.includes("--resolve-admin-from-db"))throw new Error("EXPLICIT_ADMIN_UID_OR_RESOLUTION_FLAG_REQUIRED");
const root=resolve(process.env.LOCALAPPDATA??"","Temp/opencode"),resume=option("--resume-cleanup");
if(resume&&(relative(root,resolve(resume)).startsWith("..")||!resolve(resume).startsWith(root)))throw new Error("INVALID_RESUME_PATH");
const runId=randomUUID(),dir=resume?resolve(resume,".."):join(root,`contacts-${runId}`);mkdirSync(dir,{recursive:true,mode:0o700});
const path=join(dir,"manifest.private.json"),fingerprint=createHash("sha256").update(process.env.DATABASE_URL!).digest("hex");
type Journal={version:number;runId:string;base:string;databaseFingerprint:string;project:string;entries:Entry[];firebase:{uid:string;kind:"external"|"internal";userId?:string}[];pending:string[];cleaned?:boolean};
const journal:Journal=resume?JSON.parse(readFileSync(resume,"utf8")):{version:1,runId,base:base.origin,databaseFingerprint:fingerprint,project:process.env.FIREBASE_ADMIN_PROJECT_ID!,entries:[],firebase:[],pending:[]};
if(journal.version!==1||journal.base!==base.origin||journal.databaseFingerprint!==fingerprint||journal.project!==process.env.FIREBASE_ADMIN_PROJECT_ID)throw new Error("MANIFEST_ENVIRONMENT_MISMATCH");
const evidence:Evidence[]=resume?JSON.parse(readFileSync(join(dir,"results.redacted.json"),"utf8")).evidence:[];
const previousEvidenceCount=evidence.length;
function persist(){writeFileSync(path+".new",JSON.stringify(journal,null,2),{mode:0o600});renameSync(path+".new",path);writeFileSync(join(dir,"results.redacted.json"),JSON.stringify({runId:journal.runId,at:new Date().toISOString(),evidence},null,2),{mode:0o600});}
function check(assertion:string,condition:unknown,status?:number){evidence.push({assertion,outcome:condition?"PASS":"FAIL",...(status===undefined?{}:{status})});persist();if(!condition)throw new Error("ASSERTION_FAILED");}
function diagnose(e:unknown){const x=e as {name?:string;code?:string;table?:string;constraint?:string;cause?:{code?:string;table?:string;constraint?:string};message?:string};const detail=x.code?x:x.cause;const code=detail?.code;if(code&&/^(23503|23505|42501|42P01|42703|55P03|40P01|40001|P0001)$/.test(code)){const names=[detail?.table,detail?.constraint].filter((v):v is string=>!!v&&/^[a-z_][a-z_0-9]{0,127}$/.test(v));return [`SQL_${code}`,...names].join(":");}if(code&&/^auth\/[a-z-]{1,60}$/.test(code))return code;if(["AbortError","TimeoutError"].includes(x.name??""))return "NETWORK_TIMEOUT";if(/fetch failed|network|ECONN|ENOTFOUND/i.test(x.message??""))return "NETWORK_REQUEST_FAILED";return /^[A-Z_0-9]+$/.test(x.message??"")?x.message!:"DETAILS_WITHHELD";}
function fail(label:string,e:unknown){evidence.push({assertion:label,outcome:"FAIL",diagnostic:diagnose(e)});persist();}
function own(table:string,value:string,key="id"){if(!/^[0-9a-f-]{36}$/i.test(value))throw new Error("INVALID_OWN_ID");if(!journal.entries.some(e=>e.table===table&&e.value===value&&e.key===key))journal.entries.push({table,key,value});persist();return value;}
async function token(uid:string){const custom=await auth.createCustomToken(uid);const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_API_KEY!)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true}),signal:AbortSignal.timeout(30000)});const d=await r.json() as Row;if(!r.ok||!d.idToken)throw new Error("FIREBASE_LOGIN_FAILED");return String(d.idToken);}
async function api(label:string,route:string,bearer?:string,method="GET",body?:unknown,statuses=[200]){
 const pending=method==="POST"?`${label}:${randomUUID()}`:null;if(pending){journal.pending.push(pending);persist();}
 const r=await fetch(new URL(route,base),{method,redirect:"error",signal:AbortSignal.timeout(60000),headers:{...(bearer?{authorization:`Bearer ${bearer}`}:{ }),...(body===undefined?{}:{"content-type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json().catch(()=>({})) as Row;
 if(d.id&&method==="POST"){
  if(route==="/api/admin/departments")own("department",d.id);
  if(route==="/api/admin/users"){own("app_user",d.id);if(d.firebaseUid){journal.firebase.push({uid:d.firebaseUid,userId:d.id,kind:"internal"});persist();}}
  if(route==="/api/modules/contatos/perfis")own("module_contact_profile",d.id);
  if(route==="/api/modules/contatos/segmentos")own("module_contact_segment",d.id);
  if(route==="/api/modules/contatos"||route==="/api/cidadao/conta/cadastro")own("module_record",d.id);
  if(route==="/api/documents")own("document",d.id);
 }
 if(pending){journal.pending=journal.pending.filter(x=>x!==pending);persist();}
 check(label,statuses.includes(r.status),r.status);return d;
}
function cpf(){const n=Array.from(randomBytes(9),b=>b%10);for(const length of [9,10])n.push((n.reduce((s,v,i)=>s+v*(length+1-i),0)*10%11)%10);return n.join("");}
const one=async(q:string,p:unknown[]=[])=> (await sql(q,p))[0] as Row;
async function isolated(label:string,fn:()=>Promise<void>){try{await fn();}catch(e){fail(label,e);}}
async function moduleFixture(owner:string,sector:string,family:string,data:Row){const id=own("module_record",randomUUID());await sql("INSERT INTO module_record(id,family,title,owner_id,actor_id,department_id,data) VALUES($1,$2,$3,$4,$4,$5,$6::jsonb)",[id,family,`Validation ${journal.runId}`,owner,sector,JSON.stringify(data)]);return id;}
async function main(){
 if(!adminUid){const excluded=resume?journal.firebase.map(f=>f.uid):[];const rows=await sql("SELECT u.firebase_uid FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.active AND r.name='ADMIN_GERAL' AND u.firebase_uid IS NOT NULL AND NOT(u.firebase_uid=ANY($1::text[])) ORDER BY u.id LIMIT 1",[excluded]);if(!rows.length)throw new Error("ADMIN_NOT_FOUND");adminUid=rows[0].firebase_uid;}
 const binding=await sql("SELECT u.id FROM app_user u JOIN user_role ur ON ur.user_id=u.id JOIN role r ON r.id=ur.role_id WHERE u.firebase_uid=$1 AND u.active AND r.name='ADMIN_GERAL'",[adminUid]);check("existing-admin-exact-database-binding",binding.length===1);
 if(resume)return;
 const admin=await token(adminUid!);await api("existing-admin-session-read-only","/api/admin/me",admin);
 const sectors:string[]=[],staff:Row[]=[];
 for(let i=0;i<2;i++){
  const d=await api("create-owned-sector","/api/admin/departments",admin,"POST",{name:`Contact validation ${journal.runId} ${i}`,acronym:randomBytes(4).toString("hex")},[201]);sectors.push(d.id);
  check("http-and-sql-same-database",!!await one("SELECT id FROM department WHERE id=$1",[d.id]));
  const u=await api("create-owned-internal-admin","/api/admin/users",admin,"POST",{name:`Contact validation ${i}`,email:`staff.${randomUUID()}@example.invalid`,departmentId:d.id,role:"ADMIN_GERAL",password:randomBytes(30).toString("base64url")},[201]);staff.push({...u,token:await token(u.firebaseUid)});
 }
 const [a,b]=staff;
 const fields=Array.from({length:10},(_,i)=>({key:`extra_${i}`,label:`Field ${i}`,help:"Validation field",type:i===1?"number":"text",options:[],required:i===1,channel:i===0?"INTERNO":i===1?"EXTERNO":"AMBOS"}));
 const definition={types:["Pessoa física","Pessoa jurídica","Setor de organização"],base:[{key:"cpfCnpj",enabled:true,required:false},{key:"email",enabled:true,required:true}],fields};
 const profileA=await api("create-profile-ten-fields","/api/modules/contatos/perfis",a.token,"POST",{name:`Profile A ${journal.runId}`,definition,active:true},[201]);
 const profileB=await api("create-second-profile","/api/modules/contatos/perfis",b.token,"POST",{name:`Profile B ${journal.runId}`,definition:{...definition,base:[{key:"cpfCnpj",enabled:false,required:false},{key:"email",enabled:true,required:true}]},active:true},[201]);
 await api("reject-eleventh-profile-field","/api/modules/contatos/perfis",a.token,"POST",{name:"Invalid profile",definition:{...definition,fields:[...fields,{...fields[0],key:"extra_11"}]},active:true},[400]);
 const publicProfiles=await api("public-profile-contract","/api/modules/contatos/perfis/publicos");const visible=(publicProfiles as unknown as Row[]).find(p=>p.id===profileA.id);check("public-profile-excludes-internal-field",visible&&visible.definition.fields.length===9&&!JSON.stringify(visible).includes("extra_0"));
 const created=await api("create-owned-contact","/api/modules/contatos",a.token,"POST",{title:"Contact Internal",profileId:profileA.id,profileRevision:1,values:{tipo:"Pessoa física",email:`contact.${randomUUID()}@example.invalid`,extra_0:"Private internal value"}},[201]);
 let contact=await api("contact-read","/api/modules/contatos/"+created.id,a.token);
 await api("foreign-sector-contact-denied","/api/modules/contatos/"+created.id,b.token,"GET",undefined,[404]);
 const segment=await api("create-owned-segment","/api/modules/contatos/segmentos",a.token,"POST",{name:`List ${journal.runId}`,departmentId:sectors[0],members:[created.id]},[201]);
 const lists=await api("foreign-sector-segments-filtered","/api/modules/contatos/segmentos",b.token);check("foreign-segment-not-disclosed",!(lists as unknown as Row[]).some(s=>s.id===segment.id));
 await api("segment-rejects-foreign-sector","/api/modules/contatos/segmentos",b.token,"POST",{name:"Invalid list",departmentId:sectors[0],members:[created.id]},[403]);
 await api("update-segment-revision","/api/modules/contatos/segmentos/"+segment.id,a.token,"PATCH",{name:"Updated owned list",departmentId:sectors[0],members:[created.id],revision:1});
 await api("reject-stale-segment-revision","/api/modules/contatos/segmentos/"+segment.id,a.token,"PATCH",{name:"Stale list",departmentId:sectors[0],members:[],revision:1},[409]);
 const filtered=await api("segment-contact-filter","/api/modules/contatos?segment="+segment.id,a.token);check("segment-filter-exact-member",(filtered as unknown as Row[]).length===1&&filtered[0].id===created.id);
 await api("contact-revision-edit","/api/modules/contatos/"+created.id,a.token,"PATCH",{title:contact.title,profileId:profileA.id,profileRevision:1,revision:contact.revision,values:{...contact.values,extra_2:"Updated"}});
 await api("contact-stale-write-rejected","/api/modules/contatos/"+created.id,a.token,"PATCH",{title:contact.title,profileId:profileA.id,profileRevision:1,revision:contact.revision,values:contact.values},[409]);
 contact=await api("contact-after-revision-conflict","/api/modules/contatos/"+created.id,a.token);check("stale-write-did-not-overwrite",contact.values.extra_2==="Updated");
 await isolated("external-account-contracts",async()=>{
  const external:Row[]=[];
  for(let i=0;i<2;i++){
   const uid=`contacts-${journal.runId}-${i}`,email=`external.${randomUUID()}@example.invalid`;
   journal.firebase.push({uid,kind:"external"});persist();
   await auth.createUser({uid,email,displayName:`External contact ${i}`,emailVerified:true,password:randomBytes(30).toString("base64url")});
   external.push({uid,email,token:await token(uid)});
  }
  const [x,y]=external;const fiscal=cpf();
  await api("external-registration-requires-session","/api/cidadao/conta/cadastro",undefined,"GET",undefined,[401]);
  await api("external-cannot-configure-profile","/api/modules/contatos/perfis",x.token,"POST",{name:"Forbidden",definition},[401,403]);
  const registration={name:"External contact 0",profileId:profileA.id,profileRevision:1,revision:0,values:{tipo:"Pessoa física",cpfCnpj:fiscal,email:x.email,extra_1:"42"},address:{}};
  await api("external-required-field-rejected","/api/cidadao/conta/cadastro",x.token,"POST",{...registration,values:{...registration.values,extra_1:""}},[400]);
  await api("external-field-format-rejected","/api/cidadao/conta/cadastro",x.token,"POST",{...registration,values:{...registration.values,extra_1:"not-a-number"}},[400]);
  const first=await api("external-transactional-registration","/api/cidadao/conta/cadastro",x.token,"POST",registration);
  const account=await one("SELECT * FROM module_contact_account WHERE uid=$1",[x.uid]);own("citizen",account.citizen_id);own("module_record",account.contact_id);
  check("external-fiscal-association-persisted",account.contact_id===first.id&&(await one("SELECT contact_id FROM module_contact_legacy WHERE citizen_id=$1",[account.citizen_id])).contact_id===first.id);
  check("external-actor-is-real-uid-no-fake-staff",(await one("SELECT actor_id,external_actor_uid,department_id FROM module_record WHERE id=$1",[first.id])).external_actor_uid===x.uid);
  const before=await one("SELECT revision,data FROM module_record WHERE id=$1",[first.id]);
  for(const [label,patch] of [["internal-field",{extra_0:"Injected"}],["unknown-field",{externalOwnerUid:y.uid}],["email-change",{email:y.email}],["fiscal-change",{cpfCnpj:cpf()}]] as [string,Row][]){await api(`external-reject-${label}`,"/api/cidadao/conta/cadastro",x.token,"POST",{...registration,revision:before.revision,values:{...registration.values,...patch}},[400,403,409]);}
  check("external-rejections-no-partial-revision",(await one("SELECT revision FROM module_record WHERE id=$1",[first.id])).revision===before.revision);
  const privateRow=await api("staff-read-external-contact","/api/modules/contatos/"+first.id,a.token);
  await api("staff-adds-internal-field","/api/modules/contatos/"+first.id,a.token,"PATCH",{title:privateRow.title,profileId:profileA.id,profileRevision:1,revision:privateRow.revision,values:{...privateRow.values,extra_0:"Private internal value"}});
  const detail=await api("external-safe-dto","/api/cidadao/conta/cadastro",x.token);check("external-does-not-leak-private-values",!JSON.stringify(detail).includes("Private internal value")&&!Object.hasOwn(detail.values,"extra_0"));
  await api("external-edit-preserves-internal","/api/cidadao/conta/cadastro",x.token,"POST",{...registration,revision:detail.revision,values:{...registration.values,extra_2:"External update"}});
  check("internal-value-preserved-after-external-edit",(await one("SELECT data FROM module_record WHERE id=$1",[first.id])).data.values.extra_0==="Private internal value");
  await api("external-rejects-stale-revision","/api/cidadao/conta/cadastro",x.token,"POST",{...registration,revision:detail.revision},[409]);
  await api("second-account-cannot-claim-fiscal-identity","/api/cidadao/conta/cadastro",y.token,"POST",{...registration,name:"External contact 1",values:{...registration.values,email:y.email}},[409]);
  const second=await api("second-account-email-only-profile","/api/cidadao/conta/cadastro",y.token,"POST",{name:"External contact 1",profileId:profileB.id,profileRevision:1,revision:0,values:{tipo:"Pessoa física",email:y.email,extra_1:"5"}});
  const account2=await one("SELECT * FROM module_contact_account WHERE uid=$1",[y.uid]);own("citizen",account2.citizen_id);own("module_record",second.id);
  check("email-only-has-no-fabricated-tax-id",(await one("SELECT cpf_cnpj FROM citizen WHERE id=$1",[account2.citizen_id])).cpf_cnpj==="");
  const other=await api("second-account-sees-only-own-registration","/api/cidadao/conta/cadastro",y.token);check("second-account-no-first-identity",other.values.email===y.email&&!JSON.stringify(other).includes(fiscal));
  await api("external-cannot-create-internal-segment","/api/modules/contatos/segmentos",x.token,"POST",{name:"Forbidden",departmentId:sectors[0],members:[first.id]},[401,403]);
  await api("external-profile-required-on-update","/api/cidadao/conta/cadastro",y.token,"POST",{name:"External contact 1",profileId:profileB.id,profileRevision:99,revision:other.revision,values:other.values},[409]);
  await api("external-disabled-cpf-rejected","/api/cidadao/conta/cadastro",y.token,"POST",{name:"External contact 1",profileId:profileB.id,profileRevision:1,revision:other.revision,values:{...other.values,cpfCnpj:cpf()}},[400]);
 });
 await isolated("legacy-merge-contracts",async()=>{
  const fiscal=cpf(),email=`legacy.${randomUUID()}@example.invalid`,values={tipo:"Pessoa física",cpfCnpj:fiscal,email,extra_0:"Preserved"};
  const source=await moduleFixture(a.id,sectors[0],"contatos",{values}),target=await moduleFixture(a.id,sectors[0],"contatos",{values});
  const citizenIds=[own("citizen",randomUUID()),own("citizen",randomUUID())];
  for(const id of citizenIds)await sql("INSERT INTO citizen(id,name,cpf_cnpj,email) VALUES($1,$2,$3,$4)",[id,"Owned legacy contact",fiscal,email]);
  await sql("INSERT INTO citizen_identity(cpf_cnpj,citizen_id) VALUES($1,$2)",[fiscal,citizenIds[0]]);
  for(let i=0;i<2;i++)await api("associate-owned-legacy-fiscal","/api/modules/contatos/"+[source,target][i]+"/legado",a.token,"POST",{citizenId:citizenIds[i],revision:1});
  const link=await moduleFixture(a.id,sectors[0],"oficio",{linkedIds:[source],refs:[{id:source}],values:{destinatario:source},messages:[{text:source,visibility:"INTERNA",actorId:a.id,at:new Date().toISOString()}]});
  const snapshot=await one("SELECT snapshot FROM module_version WHERE record_id=$1 AND revision=1",[link]);
  const list=await api("legacy-merge-list","/api/modules/contatos/segmentos",a.token,"POST",{name:"Owned merge list",departmentId:sectors[0],members:[source,target]},[201]);
  const doc=await api("owned-document-for-legacy-fk","/api/documents",a.token,"POST",{type:"MEMORANDUM",subject:"Owned contact reference",body:"Validation fixture",originDepartmentId:sectors[0]},[201]);
  const request=own("external_request",randomUUID());await sql("INSERT INTO external_request(id,citizen_id,document_id,protocol_number,public_key) VALUES($1,$2,$3,$4,$5)",[request,citizenIds[0],doc.id,`test-${journal.runId}`,randomUUID()]);
  await api("merge-rejects-foreign-sector","/api/modules/contatos/unificar",b.token,"POST",{sourceId:source,targetId:target,sourceRevision:2,targetRevision:2},[403,404]);
  await api("merge-rejects-stale-version","/api/modules/contatos/unificar",a.token,"POST",{sourceId:source,targetId:target,sourceRevision:1,targetRevision:2},[409]);
  const merged=await api("merge-rewrites-current-links","/api/modules/contatos/unificar",a.token,"POST",{sourceId:source,targetId:target,sourceRevision:2,targetRevision:2});
  check("merge-counts-real-rewrites",merged.counts.records>=1&&merged.counts.segments===1&&merged.counts.externalRequests===1&&merged.counts.citizenIdentities===1);
  const current=await one("SELECT data FROM module_record WHERE id=$1",[link]);check("merge-json-refs-rewritten",current.data.linkedIds[0]===target&&current.data.refs[0].id===target&&current.data.values.destinatario===target);
  check("merge-text-and-history-preserved",current.data.messages[0].text===source&&JSON.stringify((await one("SELECT snapshot FROM module_version WHERE record_id=$1 AND revision=1",[link])).snapshot)===JSON.stringify(snapshot.snapshot));
  check("merge-originals-preserved",(await one("SELECT status FROM module_record WHERE id=$1",[source])).status==="UNIFICADO"&&(await sql("SELECT id FROM citizen WHERE id=ANY($1::uuid[])",[citizenIds])).length===2);
  check("merge-core-request-fk-rewritten",(await one("SELECT citizen_id FROM external_request WHERE id=$1",[request])).citizen_id===citizenIds[1]);
  check("merge-list-deduplicated",JSON.stringify((await one("SELECT members FROM module_contact_segment WHERE id=$1",[list.id])).members)===JSON.stringify([target]));
  check("merge-audited",!!await one("SELECT id FROM audit_log WHERE action='CONTACT_MERGED' AND entity_id=$1",[source]));
  const after=await moduleFixture(a.id,sectors[0],"oficio",{linkedIds:[source]});check("new-links-canonicalized",(await one("SELECT data FROM module_record WHERE id=$1",[after])).data.linkedIds[0]===target);
 });
 await isolated("profile-edit-and-import-contracts",async()=>{
  const batch={profileId:profileA.id,profileRevision:1,rows:[{title:"Owned import contact",idempotencyKey:randomUUID(),values:{tipo:"Pessoa física",email:`import.${randomUUID()}@example.invalid`}}]};
  const imported=await api("import-contact-profile-contract","/api/modules/contatos/import",a.token,"POST",batch);check("import-row-succeeded",imported.results?.length===1&&!imported.results[0].error);own("module_record",imported.results[0].id);
  const repeated=await api("import-repeat-idempotent","/api/modules/contatos/import",a.token,"POST",batch);check("import-repeat-same-record",repeated.results[0].id===imported.results[0].id);
  const changed=await api("import-idempotency-conflict","/api/modules/contatos/import",a.token,"POST",{...batch,rows:[{...batch.rows[0],title:"Changed payload"}]});check("import-divergent-payload-rejected",!!changed.results[0].error&&!changed.results[0].id);
  await api("profile-optimistic-edit","/api/modules/contatos/perfis/"+profileA.id,a.token,"PATCH",{name:`Profile edited ${journal.runId}`,revision:1,definition,active:true});
  await api("profile-stale-edit-rejected","/api/modules/contatos/perfis/"+profileA.id,a.token,"PATCH",{name:"Stale profile",revision:1,definition,active:true},[409]);
  check("profile-version-and-audit",(await one("SELECT revision FROM module_contact_profile WHERE id=$1",[profileA.id])).revision===2&&!!await one("SELECT id FROM audit_log WHERE entity_id=$1 AND action='CONTACT_CONFIG'",[profileA.id]));
 });
}
const relations:[string,string,string][]=[
 ["module_contact_account","contact_id","module_record"],["module_contact_legacy","contact_id","module_record"],["module_contact_merge","source_id","module_record"],
 ["module_version","record_id","module_record"],["module_file","record_id","module_record"],["module_edit_lease","record_id","module_record"],["module_sector_tag","record_id","module_record"],["module_passcode","record_id","module_record"],["module_anonymous_access","record_id","module_record"],["module_anonymous_operation","record_id","module_record"],
 ["module_citizen_alias","source_id","citizen"],["citizen_identity","citizen_id","citizen"],
 ["operation_participation_history","document_id","document"],
 ["document_deadline","document_id","document"],["document_recipient","document_id","document"],["document_read_receipt","document_id","document"],["document_movement","document_id","document"],["document_participation","document_id","document"],["external_request","document_id","document"],
 ["user_role","user_id","app_user"],["user_profile","user_id","app_user"],["user_department","user_id","app_user"]
];
async function cleanup(){
 const allowed=new Set(["department:id","app_user:id","module_record:id","module_contact_profile:id","module_contact_segment:id","citizen:id","document:id","external_request:id",...relations.map(([t,k])=>`${t}:${k}`)]);
 if(journal.entries.some(e=>!allowed.has(`${e.table}:${e.key}`)||!/^[0-9a-f-]{36}$/i.test(e.value)))throw new Error("INVALID_MANIFEST");
 for(const account of journal.firebase.filter(f=>f.kind==="external")){
  if(!account.uid.startsWith(`contacts-${journal.runId}-`))throw new Error("EXTERNAL_UID_NOT_OWNED");
  for(const row of await sql("SELECT contact_id,citizen_id FROM module_contact_account WHERE uid=$1",[account.uid])){own("module_record",row.contact_id);own("citizen",row.citizen_id);}
 }
 // Recover writes only through the exclusively provisioned owners/actors from this manifest.
 for(const owner of journal.entries.filter(e=>e.table==="app_user"&&e.key==="id")){
  for(const row of await sql("SELECT id FROM module_record WHERE owner_id=$1",[owner.value]))own("module_record",row.id);
  for(const table of ["module_contact_profile","module_contact_segment"])for(const row of await sql(`SELECT id FROM ${table} WHERE actor_id=$1`,[owner.value]))own(table,row.id);
  const row=await one("SELECT firebase_uid FROM app_user WHERE id=$1",[owner.value]);if(row?.firebase_uid&&!journal.firebase.some(f=>f.uid===row.firebase_uid)){journal.firebase.push({uid:row.firebase_uid,userId:owner.value,kind:"internal"});persist();}
 }
 for(const [table,key,parent] of relations)for(const entry of [...journal.entries].filter(e=>e.table===parent&&e.key==="id"))if((await sql(`SELECT 1 FROM ${table} WHERE ${key}=$1 LIMIT 1`,[entry.value])).length)own(table,entry.value,key);
 const archive:Row[]=[];for(const e of journal.entries){const rows=await sql(`SELECT * FROM ${e.table} WHERE ${e.key}=$1`,[e.value]);if(rows.length)archive.push({scope:e,rows});}
 if(archive.length){const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),bytes=Buffer.concat([cipher.update(JSON.stringify(archive)),cipher.final()]),stamp=randomUUID();writeFileSync(join(dir,`history-${stamp}.key`),key,{mode:0o600});writeFileSync(join(dir,`history-${stamp}.aes`),Buffer.concat([iv,cipher.getAuthTag(),bytes]),{mode:0o600});}
 const order=[...new Set(relations.map(([t])=>t)),"external_request","module_contact_segment","module_contact_profile","module_record","document","citizen","app_user","department"];
 const entries=[...journal.entries].sort((a,b)=>order.indexOf(a.table)-order.indexOf(b.table));
 const guards:[[string,string],...Array<[string,string]>]=[["module_record","modules_guard"],["module_version","modules_version_immutable"],["module_file","modules_file_immutable"],["module_contact_merge","contact_merge_immutable"],["module_anonymous_operation","anonymous_operation_immutable"],["operation_participation_history","operation_participation_history_immutable"]];
 const active=guards.filter(([t])=>entries.some(e=>e.table===t));
 if(entries.length)await sql.transaction([
  sql("SET LOCAL lock_timeout='10s'"),
  ...[...new Set(entries.map(e=>e.table))].sort().map(t=>sql(`LOCK TABLE ${t} IN ACCESS EXCLUSIVE MODE`)),
  ...active.map(([t,g])=>sql(`ALTER TABLE ${t} DISABLE TRIGGER ${g}`)),
  ...entries.map(e=>sql(`DELETE FROM ${e.table} WHERE ${e.key}=$1`,[e.value])),
  ...active.map(([t,g])=>sql(`ALTER TABLE ${t} ENABLE TRIGGER ${g}`)),
 ]);
 check("owned-sql-teardown-committed",true);
 for(const [t,g] of active)check("guard-restored-"+g,(await one("SELECT tgenabled FROM pg_trigger WHERE tgrelid=$1::regclass AND tgname=$2",[t,g]))?.tgenabled==="O");
 for(const f of journal.firebase){if(f.uid===adminUid||f.kind==="internal"&&!journal.entries.some(e=>e.table==="app_user"&&e.value===f.userId))throw new Error("FIREBASE_OWNERSHIP_UNPROVEN");try{await auth.deleteUser(f.uid);}catch(e){if((e as {code?:string}).code!=="auth/user-not-found")throw e;}}
 check("owned-firebase-teardown-complete",true);check("no-ambiguous-http-writes",journal.pending.length===0);journal.cleaned=true;persist();
}
async function run(){persist();try{await main();}catch(e){fail("setup-or-execution",e);}finally{try{await cleanup();if(resume)check("resume-cleanup-recovered-preserving-prior-evidence",true);}catch(e){fail("teardown-pending-resume-manifest",e);}persist();}console.log(`Private evidence: ${dir}`);console.log(JSON.stringify({passed:evidence.filter(e=>e.outcome==="PASS").length,failed:evidence.filter(e=>e.outcome==="FAIL").length,cleaned:!!journal.cleaned,recovered:!!resume&&!!journal.cleaned}));process.exitCode=(resume?evidence.slice(previousEvidenceCount):evidence).some(e=>e.outcome==="FAIL")?1:0;}
void run().catch(e=>{console.error(diagnose(e));process.exitCode=1;});
