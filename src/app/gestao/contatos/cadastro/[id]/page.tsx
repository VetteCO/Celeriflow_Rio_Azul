"use client";
import {useParams} from "next/navigation";
import ContactEditor from "../../ContactEditor";
export default function Contact(){const {id}=useParams<{id:string}>();return <ContactEditor id={id}/>;}
