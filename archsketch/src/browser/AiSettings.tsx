import { useState } from 'react';
import { readAiSettings, writeAiSettings } from './install.ts';
/** 浏览器版 AI 设置：密钥只存本浏览器 localStorage，请求由浏览器直连模型服务，不经过本站服务器。 */
export function AiSettingsButton({onChange}:{onChange:()=>void}){
 const [open,setOpen]=useState(false);const [form,setForm]=useState(readAiSettings);
 const set=(k:keyof typeof form)=>(e:{target:{value:string}})=>setForm({...form,[k]:e.target.value});
 const save=()=>{writeAiSettings({...form,baseUrl:form.baseUrl.trim(),model:form.model.trim(),apiKey:form.apiKey.trim()});setOpen(false);onChange();};
 const clear=()=>{writeAiSettings(null);setForm(readAiSettings());setOpen(false);onChange();};
 return <>
  <button className="gx-quiet" onClick={()=>{setForm(readAiSettings());setOpen(true);}} title="填写你自己的模型 API key">AI 设置</button>
  {open&&<div className="ai-settings-backdrop" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
   <form className="ai-settings" role="dialog" aria-label="AI 设置" onSubmit={e=>{e.preventDefault();save();}}>
    <h3>AI 设置</h3>
    <label>服务商<select value={form.provider} onChange={set('provider')}><option value="deepseek">DeepSeek</option><option value="openai-compatible">OpenAI 兼容服务</option></select></label>
    <label>服务地址<input value={form.baseUrl} onChange={set('baseUrl')} placeholder="https://api.deepseek.com"/></label>
    <label>模型<input value={form.model} onChange={set('model')} placeholder="deepseek-flash"/></label>
    <label>API key<input type="password" autoComplete="off" value={form.apiKey} onChange={set('apiKey')} placeholder="sk-…"/></label>
    <p>密钥只保存在这个浏览器里，AI 请求由浏览器直接发给上面的服务地址，不经过本站服务器。设计数据也只存在这个浏览器，请定期导出备份。公用电脑上用完请点“清除”。</p>
    <div><button type="button" className="gx-quiet" onClick={clear}>清除</button><button type="button" className="gx-quiet" onClick={()=>setOpen(false)}>取消</button><button type="submit">保存</button></div>
   </form>
  </div>}
 </>;
}
