"use client";
import {useEffect,useRef} from "react";
import type Quill from "quill";
import "quill/dist/quill.snow.css";
export default function WorkReportEditor({value,disabled,onChange}:{value:string;disabled:boolean;onChange:(text:string,html:string)=>void}) {
  const host=useRef<HTMLDivElement>(null), editor=useRef<Quill|null>(null);
  const changed=useRef(onChange); const currentValue=useRef(value); const currentDisabled=useRef(disabled);
  useEffect(()=>{changed.current=onChange;currentValue.current=value;currentDisabled.current=disabled;},[onChange,value,disabled]);
  useEffect(()=>{
    let disposed=false; const root=host.current;
    void import("quill").then(({default:QuillEditor})=>{
      if(disposed || !root) return;
      const container=document.createElement("div");root.appendChild(container);
      const instance=new QuillEditor(container,{formats:["header","font","bold","italic","underline","strike","color","background","list","align","link","blockquote","code-block"],theme:"snow",placeholder:"Kết quả đã thực hiện, vướng mắc, bước tiếp theo…",modules:{toolbar:[[{header:[false,1,2,3]},{font:[]}],["bold","italic","underline","strike"],[{color:[]},{background:[]}],[{list:"ordered"},{list:"bullet"},{align:[]}],["link","blockquote","code-block","clean"]]}});
      editor.current=instance;instance.setText(currentValue.current);instance.enable(!currentDisabled.current);
      instance.root.setAttribute("role","textbox"); instance.root.setAttribute("aria-label","Nội dung báo cáo tiến độ");instance.root.setAttribute("aria-multiline","true");
      root.querySelectorAll<HTMLButtonElement>(".ql-toolbar button").forEach(button=>{button.type="button";const labels:Record<string,string>={"ql-bold":"In đậm","ql-italic":"In nghiêng","ql-underline":"Gạch chân","ql-strike":"Gạch ngang","ql-link":"Chèn liên kết","ql-blockquote":"Trích dẫn","ql-code-block":"Khối mã","ql-clean":"Xóa định dạng","ql-list":"Danh sách","ql-align":"Căn lề"};const key=Object.keys(labels).find(name=>button.classList.contains(name));button.setAttribute("aria-label",key?labels[key]:"Định dạng");});
      instance.on("text-change",()=>{changed.current(instance.getText().replace(/\n$/,""),instance.getSemanticHTML());});
    });
    return ()=>{disposed=true;editor.current=null;root?.replaceChildren();};
  },[]);
  useEffect(()=>{editor.current?.enable(!disabled);},[disabled]);
  useEffect(()=>{if(!value && editor.current?.getText().trim()) editor.current.setText("");},[value]);
  return <div className="wp-rich-editor" ref={host}/>;
}

