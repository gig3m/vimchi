vim.fn.mkdir('/tmp/vimchi-codex-audit', 'p'); vim.cmd('cd /tmp/vimchi-codex-audit')
local rows=vim.json.decode(table.concat(vim.fn.readfile('/tmp/vimchi-codex-cases.json'),'\n'))
local out={}
for _,r in ipairs(rows) do
 vim.cmd('silent! %bwipeout!'); vim.cmd('enew!')
 vim.bo.filetype=''
 vim.bo.smartindent=false; vim.bo.cindent=false
 vim.o.ignorecase=false; vim.o.smartcase=false; vim.o.wrapscan=true
 if r.name then vim.api.nvim_buf_set_name(0,r.name); vim.bo.filetype=vim.filetype.match({filename=r.name}) or '' end
 vim.bo.shiftwidth=2; vim.bo.expandtab=true; vim.bo.tabstop=8; vim.bo.autoindent=true
 vim.bo.softtabstop=0; vim.bo.textwidth=0
 for k,v in pairs(r.options or {}) do pcall(function() vim.o[k]=v end) end
 vim.api.nvim_buf_set_lines(0,0,-1,false,vim.split(r.text,'\n',{plain=true}))
 vim.bo.undolevels=-1; vim.cmd('normal! i'); vim.bo.undolevels=1000
 for _,reg in ipairs({'"','0','1','2','a','b','q','-','/'}) do vim.fn.setreg(reg,'') end
 vim.api.nvim_win_set_cursor(0,{r.cursor.line+1,r.cursor.col})
 vim.fn.winrestview({curswant=r.cursor.col})
 vim.fn.histdel('search'); vim.fn.histdel('cmd')
 vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(r.keys,true,true,true),'tx',false)
 local p=vim.api.nvim_win_get_cursor(0)
 table.insert(out,{text=table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\n'),cursor={line=p[1]-1,col=p[2]},reg=vim.fn.getreg('"'),mode=vim.fn.mode()})
 vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>',true,true,true),'tx',false)
end
vim.fn.writefile({vim.json.encode(out)},'/tmp/vimchi-codex-nvim.json'); vim.cmd('qa!')
