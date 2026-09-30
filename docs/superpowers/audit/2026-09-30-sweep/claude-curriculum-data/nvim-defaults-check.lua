local out = {}
local function p(...) table.insert(out, table.concat({...}, ' ')) end
local function run(lines, cur, keys)
  vim.cmd('enew!'); vim.api.nvim_buf_set_lines(0,0,-1,false,lines)
  vim.api.nvim_win_set_cursor(0,cur)
  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(keys,true,false,true),'xt',false)
  return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\\n')
end
p('ci( same line before:', run({'foo bar(a, b) x'},{1,0},'ci(Z<Esc>'))
p('ci( next line:', run({'foo bar', 'baz(a, b) x'},{1,0},'ci(Z<Esc>'))
p('ci{ next line:', run({'local x = 1', 'setup({ a = 1 })'},{1,0},'ci{Z<Esc>'))
p('ci" same line:', run({'x = "a" + "b"'},{1,0},'ci"Z<Esc>'))
p('scrolloff', vim.o.scrolloff, 'fo', vim.o.formatoptions, 'nf', vim.o.nrformats, 'path', vim.o.path, 'grepprg', vim.o.grepprg, 'cpo', vim.o.cpoptions, 'hidden', tostring(vim.o.hidden))
p('matchit loaded', tostring(vim.g.loaded_matchit))
for _,m in ipairs({'&','<C-L>','Y','[<Space>',']b','[q',']d','grn','grr','gri','gra','gO','grt','K','gcc','<C-W>d','gx'}) do
  local r = vim.fn.maparg(m,'n',false,true); p('map',m, r.rhs or (r.callback and 'lua-callback') or 'NONE', r.desc or '')
end
for _,m in ipairs({'<C-U>','<C-W>','<C-S>'}) do local r=vim.fn.maparg(m,'i',false,true); p('imap',m,r.rhs or (r.callback and 'cb') or 'NONE', r.desc or '') end
p('gq tw0:', run({string.rep('word ',30)},{1,0},'gqq'):gsub('\\n','|'))
p('columns', vim.o.columns)
p('cw on word:', run({'foo bar'},{1,0},'cwX<Esc>'))
p('dT( :', run({'f(abcd)'},{1,5},'dT('))
vim.fn.writefile(out, 'out.txt')
vim.cmd('qa!')
