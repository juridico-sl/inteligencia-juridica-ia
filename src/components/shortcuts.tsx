"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function Shortcuts(){const router=useRouter();useEffect(()=>{const keydown=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null,typing=target?.matches("input,textarea,select,[contenteditable=true]");if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();router.push("/busca")}else if(!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==="n")router.push("/processos?novo=1#novo")};window.addEventListener("keydown",keydown);return()=>window.removeEventListener("keydown",keydown)},[router]);return null}
