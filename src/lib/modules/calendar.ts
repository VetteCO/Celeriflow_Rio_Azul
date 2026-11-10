import { db } from "@/db";
import { calendarHoliday } from "@/db/schema";
export async function deadline(hours: number, businessDays = false) {
 const date=new Date(); if(!businessDays) return new Date(date.getTime()+hours*3600000).toISOString();
 const holidays=new Set((await db.select().from(calendarHoliday)).map(h=>h.date));
 let remaining=hours;
 while(remaining>0) {
  date.setTime(date.getTime()+3600000);
  const day=date.toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"});
  const weekday=date.toLocaleDateString("en-US",{timeZone:"America/Sao_Paulo",weekday:"short"});
  if(weekday!=="Sat" && weekday!=="Sun" && !holidays.has(day)) remaining--;
 }
 return date.toISOString();
}
