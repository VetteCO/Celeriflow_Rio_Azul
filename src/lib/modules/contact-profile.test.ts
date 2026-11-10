import {test} from "node:test";
import assert from "node:assert/strict";
import {externalContactValues,profileSchema,validateContactProfile,type ContactProfile} from "./contact-profile";
const profile:ContactProfile={id:"11111111-1111-4111-8111-111111111111",name:"Pessoa física",revision:1,active:true,definition:{types:["Pessoa física"],base:[{key:"cpfCnpj",enabled:false,required:false}],fields:[
 {key:"extra_internal",label:"Nota interna",help:"",type:"text",options:[],required:true,channel:"INTERNO"},
 {key:"extra_license",label:"Licença",help:"Número",type:"number",options:[],required:true,channel:"EXTERNO"},
 {key:"extra_choice",label:"Categoria",help:"",type:"select",options:["A","B"],required:false,channel:"AMBOS"},
]}};
test("external submission preserves internal and unknown historic values without requiring internal-only fields",()=>{
 const previous={email:"person@example.org",extra_internal:"Confidencial",legacyReference:"preservada",cpfCnpj:"52998224725"};
 const saved=validateContactProfile(profile,"Pessoa física",{extra_license:"42"},"EXTERNO",previous);
 assert.equal(saved.extra_internal,"Confidencial");assert.equal(saved.legacyReference,"preservada");assert.equal(saved.cpfCnpj,"52998224725");assert.deepEqual(previous,{email:"person@example.org",extra_internal:"Confidencial",legacyReference:"preservada",cpfCnpj:"52998224725"});
 assert.deepEqual(externalContactValues(profile,saved),{email:"person@example.org",extra_license:"42",tipo:"Pessoa física"});
});
test("external channel cannot overwrite or erase internal/disabled fields",()=>{
 const attacks:Record<string,string>[]=[{extra_internal:"alterada"},{extra_internal:""},{cpfCnpj:""},{extra_unconfigured:"injetado"}];
 for(const attack of attacks)assert.throws(()=>validateContactProfile(profile,"Pessoa física",{email:"person@example.org",extra_license:"1",...attack},"EXTERNO",{cpfCnpj:"52998224725",extra_internal:"Confidencial"}));
});
test("external mandatory fields and formats are enforced even with valid identity",()=>{
 const invalidValues:Record<string,string>[]=[{email:"person@example.org"},{email:"person@example.org",extra_license:"not-number"},{email:"person@example.org",extra_license:"2",extra_choice:"C"}];
 for(const values of invalidValues)assert.throws(()=>validateContactProfile(profile,"Pessoa física",values,"EXTERNO"));
 assert.throws(()=>validateContactProfile({...profile,active:false},"Pessoa física",{email:"person@example.org",extra_license:"2"},"EXTERNO"));
 assert.throws(()=>validateContactProfile(profile,"Pessoa jurídica",{email:"person@example.org",extra_license:"2"},"EXTERNO"));
});
test("profile configuration limits ten fields and rejects duplicate keys/impossible rules",()=>{
 const fields=Array.from({length:10},(_,i)=>({...profile.definition.fields[0],key:`extra_${i}`}));
 assert.equal(profileSchema.safeParse({...profile,definition:{...profile.definition,fields}}).success,true);
 for(const definition of [{...profile.definition,fields:[...fields,{...fields[0],key:"extra_11"}]},{...profile.definition,fields:[fields[0],fields[0]]},{...profile.definition,base:[{key:"email",enabled:false,required:true}]}])assert.equal(profileSchema.safeParse({...profile,definition}).success,false);
});
test("at least one valid identifier remains mandatory and CPF is validated",()=>{
 const p={...profile,definition:{...profile.definition,base:[],fields:[]}};
 assert.throws(()=>validateContactProfile(p,"Pessoa física",{},"EXTERNO"));
 assert.throws(()=>validateContactProfile(p,"Pessoa física",{cpfCnpj:"11111111111"},"EXTERNO"));
 assert.throws(()=>validateContactProfile(p,"Pessoa física",{email:"not-mail"},"EXTERNO"));
 assert.equal(validateContactProfile(p,"Pessoa física",{email:"person@example.org"},"EXTERNO").email,"person@example.org");
});
