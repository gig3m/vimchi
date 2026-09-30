import { it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SECTIONS } from '../../../../src/lessons';
import { mergeSetup } from '../../../../src/lessons/runtime';
import { createVim } from '../../../../src/lessons/runtime';
import { parseKeys } from '../../../../src/vim/keys';
it('differential probes', () => {
 const cases: any[] = [];
 const add = (text:string, keys:string, col=0) => cases.push({text,keys,cursor:{line:0,col}});
 for (const keys of ['dw','2dw','d2w','cwX<Esc>','2cwX<Esc>','daw','2daw','3diw','2diw','d$','dl','dh','de','dG','dgg','vld','v$y','yyp','ddp','xul.','lxu','lxu<C-r>','xu i<Esc><C-r>'.replaceAll(' ',''),'xurZ<C-r>','xui<Esc><C-r>','xufz<C-r>','vld2.','vldj.','yyV2p','yiwvep','iX<Esc>u','aX<Esc>u']) {
   for (const text of ['one two\nthree four','one\ntwo\nthree','abc','  one two','abc\n\ndef']) add(text,keys);
 }
 for (const keys of ['di"','da"','ci"X<Esc>']) for(const col of [0,3,4,5,6,7,8]) add('"aa"  "bb"',keys,col);
 for (const keys of ['J','3J','gJ']) for(const text of ['one  \n two','one\n\nthree','one\n  two\nthree']) add(text,keys);
 for (const keys of ['di(','di{','yi{p','ci{X<Esc>']) for(const text of ['{\n  hi\n}','(\n  hi\n)','aa\n(bb)','{}','()']) add(text,keys);
 for (const keys of ['3oX<Esc>','3OX<Esc>','o<Esc>','oX<Esc>','r<Tab>','r<CR>','RXY<BS><Esc>','iX<C-g>uY<Esc>u']) add('  abc',keys);
 for(const keys of ['yy:let @a = "X"<CR>p','"ayy"Ayy"ap','dd"_ddp','yyjV2p','<C-v>jlyj$p']) add('one\ntwo\nthree',keys);
 for(const keys of ['vld2.','vld3.','v$dp','v$dx','lxux','xui<Esc><C-r>','yy:let @a = "X"<CR>p',':s/one/ONE/<CR>u<C-r>',':s/one/ONE/<CR>:s/two/TWO/<CR>:s/o<Up><CR>']) add('one two three four\nfive six',keys);
 for(const keys of ['iX<Esc>rxu','iX<Esc>ug-','yyj<C-v>jlp','iX<C-g>uY<Esc>u','/one<CR>/two<CR>/o<Up><CR>']) add('one two\none two',keys);
 for(const keys of ['xurZg-','xurZg-g-','xurZg-g-g+','v$d','vldj.','yyV2p','lxux','r<Tab>']) add('abc\ndef',keys);
 for(const keys of ['G',':2<CR>','gg']) add('abcdef\n  ghijkl',keys,3);
 for (const section of SECTIONS) for(const lesson of section.lessons) {
  const c=lesson.challenge; if(c.kind!=='rounds') continue;
  c.rounds.forEach((r,i)=>{const st=mergeSetup(c.base,r.setup);
   if(st.plugins?.length||st.init||st.files||st.folds||st.marks||st.search||Object.keys(st.registers??{}).length) return;
   cases.push({...st,text:Array.isArray(st.text)?st.text.join('\n'):st.text??'',cursor:st.cursor??{line:0,col:0},keys:r.solution,id:lesson.id+'#'+(i+1),goal:r.goal});
  });
 }
 const rows = cases.map(c=>{const v=createVim(c); for(const k of parseKeys(c.keys))v.feed(k); return {...c,engine:{text:v.buf.text(),cursor:{...v.cursor},reg:v.getRegister('"'),mode:v.mode}}});
 writeFileSync('/tmp/vimchi-codex-cases.json',JSON.stringify(rows));
 execFileSync('nvim',['--clean','--headless','-c','luafile docs/superpowers/audit/2026-09-30-sweep/codex-probes.lua'],{timeout:30000,stdio:'pipe'});
 const nvim=JSON.parse(readFileSync('/tmp/vimchi-codex-nvim.json','utf8'));
 const result=rows.map((r,i)=>({...r,nvim:nvim[i]}));
 writeFileSync('docs/superpowers/audit/2026-09-30-sweep/codex-probes.json',JSON.stringify(result,null,2));
 const diff=result.filter(r=>r.engine.text!==r.nvim.text||JSON.stringify(r.engine.cursor)!==JSON.stringify(r.nvim.cursor)||r.engine.reg.text!==r.nvim.reg);
 console.log('CASES',rows.length,'MISMATCHES',diff.length);
 console.log(JSON.stringify(diff));
});
