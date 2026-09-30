-- Replays exported lesson rounds in real Neovim and reports mismatches.
local rounds = vim.json.decode(table.concat(vim.fn.readfile(vim.env.ROUNDS), '\n'))
local bad, ok = {}, 0
for _, r in ipairs(rounds) do
  vim.cmd('silent! %bwipeout!')
  vim.cmd('enew!')
  local buf = vim.api.nvim_get_current_buf()
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, vim.split(r.text, '\n', { plain = true }))
  vim.api.nvim_buf_set_name(buf, r.name)
  local ft = vim.filetype.match({ filename = r.name }) or ''
  vim.bo.filetype = ft
  vim.o.shiftwidth, vim.o.expandtab, vim.o.tabstop, vim.o.autoindent = 2, true, 8, true
  vim.o.ignorecase, vim.o.smartcase, vim.o.textwidth, vim.o.wrapscan = false, false, 0, true
  for k, v in pairs(r.options) do pcall(function() vim.o[k] = v end) end
  vim.fn.setreg('/', r.search or '')
  if r.search and r.search ~= '' then vim.o.hlsearch = true end
  for _, reg in ipairs({ '"', '0', '1', 'a', 'b', 'q', '-' }) do vim.fn.setreg(reg, '') end
  vim.api.nvim_win_set_cursor(0, { r.cursor.line + 1, r.cursor.col })
  local keys = vim.api.nvim_replace_termcodes(r.keys, true, true, true)
  pcall(vim.api.nvim_feedkeys, keys, 'tx', false)
  if vim.fn.mode() ~= 'n' then vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'tx', false) end
  local got = table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), '\n')
  if got == r.want then ok = ok + 1 else table.insert(bad, { id = r.id, keys = r.keys, got = got, want = r.want }) end
end
local out = { 'ok ' .. ok .. ' bad ' .. #bad }
for _, b in ipairs(bad) do
  table.insert(out, '== ' .. b.id .. '  ' .. b.keys)
  table.insert(out, '  want: ' .. vim.inspect(b.want))
  table.insert(out, '  got:  ' .. vim.inspect(b.got))
end
vim.fn.writefile(out, vim.env.OUT)
vim.cmd('qa!')
