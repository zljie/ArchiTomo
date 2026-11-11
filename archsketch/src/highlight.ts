/** 图代码语法高亮分词（STORY-010）：只做展示，分词拼接必须等于原文；容忍不完整的代码。 */
export type Token={kind:'name'|'key'|'value'|'op'|'comment'|'punct'|'keyword'|'text';text:string};
const OPS=['-->','<>','--','>','<','-'];
function line(src:string):Token[]{
 const out:Token[]=[];const push=(kind:Token['kind'],text:string)=>{if(!text)return;const last=out.at(-1);if(last&&last.kind===kind&&kind!=='punct'&&kind!=='op')last.text+=text;else out.push({kind,text});};
 const trimmed=src.trimStart();const lead=src.slice(0,src.length-trimmed.length);
 if(trimmed.startsWith('//')){push('text',lead);push('comment',trimmed);return out;}
 const dir=/^(direction)(\s+)(.*)$/.exec(trimmed);if(dir){push('text',lead);push('keyword',dir[1]);push('text',dir[2]);push('value',dir[3]);return out;}
 let i=0,quote=false,bracket=false,expectKey=true;
 while(i<src.length){const ch=src[i];
  if(ch==='"'){quote=!quote;push(bracket?(expectKey?'key':'value'):'name',ch);i++;continue;}
  if(quote){push(bracket?(expectKey?'key':'value'):'name',ch);i++;continue;}
  if(bracket){
   if(ch===']'){bracket=false;push('punct',ch);i++;continue;}
   if(ch===':'&&expectKey){expectKey=false;push('punct',ch);i++;continue;}
   if(ch===','){expectKey=true;push('punct',ch);i++;continue;}
   push(expectKey?'key':'value',ch);i++;continue;
  }
  if(ch==='['){bracket=true;expectKey=true;push('punct',ch);i++;continue;}
  if(ch==='{'||ch==='}'||ch===','){push('punct',ch);i++;continue;}
  if(ch===':'){push('punct',ch);push('text',src.slice(i+1));break;}
  if(ch===' '){const op=OPS.find(o=>src.startsWith(o+' ',i+1)||(src.startsWith(o,i+1)&&i+1+o.length===src.length));if(op){push('text',' ');push('op',op);i+=1+op.length;continue;}}
  push(ch===' '||ch==='\t'?(out.at(-1)?.kind==='name'?'name':'text'):'name',ch);i++;
 }
 return out;
}
export function highlight(code:string):Token[][]{return code.split('\n').map(line);}
