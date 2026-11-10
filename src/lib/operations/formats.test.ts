import { test } from "node:test";
import assert from "node:assert/strict";
import { csv,pdf,xlsx,zip } from "./formats";
test("CSV preserves quotes/newlines and neutralizes spreadsheet formulas",()=>{
 const text=csv([["=HYPERLINK(\"bad\")","a;b","linha\nseguinte",42]]);
 assert.equal(text,'\uFEFF"\'=HYPERLINK(""bad"")";"a;b";"linha\nseguinte";"42"');
});
test("PDF xref offsets point to objects across multiple pages",()=>{
 const data=pdf(Array.from({length:110},(_,i)=>`Capacitação ${i} (ação)`));const text=data.toString("latin1");
 assert.match(text,/\/Count 3/);const start=Number(text.match(/startxref\n(\d+)/)![1]);assert.equal(text.slice(start,start+4),"xref");
 const entries=text.slice(start).split("\n").slice(3).filter(l=>/^\d{10} 00000 n/.test(l));
 entries.forEach((line,i)=>assert.equal(text.slice(Number(line.slice(0,10)),Number(line.slice(0,10))+`${i+1} 0 obj`.length),`${i+1} 0 obj`));
});
test("XLSX is an OOXML ZIP and text never becomes a formula",()=>{
 const data=xlsx([["ação & <nome>","=1+1",42]]);assert.equal(data.readUInt32LE(0),0x04034b50);const text=data.toString("utf8");assert.ok(text.includes("[Content_Types].xml"));assert.ok(text.includes("ação &amp; &lt;nome&gt;"));assert.ok(text.includes('<t xml:space="preserve">=1+1</t>'));assert.ok(!text.includes("<f>"));assert.equal(data.readUInt32LE(data.length-22),0x06054b50);
});
test("ZIP preserves original binary bytes and directory offsets",()=>{
 const original=Buffer.from([0,255,1,254]);const data=zip([{name:"original.bin",data:original}]);const nameLength=data.readUInt16LE(26);assert.deepEqual(data.subarray(30+nameLength,30+nameLength+4),original);const central=data.readUInt32LE(data.length-6);assert.equal(data.readUInt32LE(central),0x02014b50);
});
