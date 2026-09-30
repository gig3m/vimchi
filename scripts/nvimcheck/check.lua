-- Replays exported lesson rounds (and the ad-hoc cases from cases.json) in real Neovim.
--
-- Section 1, the gate: each round's solution must leave the round's goal text. Prints "ok N bad M".
-- Section 2, extended: for every round, the engine's own result (exported by export.test.ts) is compared
--   with Neovim's: cursor, unnamed register text + type, any register the goal names, and the text and
--   cursor after follow-up probes (x, and p when the register is non-empty) fed after the solution.
-- Section 3, cases: the same engine-vs-Neovim comparison, text included, for cases.json.
local data = vim.json.decode(table.concat(vim.fn.readfile(vim.env.ROUNDS), '\n'))
local sandbox = vim.env.SANDBOX or vim.fn.tempname()
vim.fn.mkdir(sandbox, 'p')
vim.cmd('cd ' .. vim.fn.fnameescape(sandbox)) -- any :w lands here, never in the repo
local esc = vim.api.nvim_replace_termcodes('<Esc>', true, false, true)
local REGTYPE = { v = 'v', V = 'V', ['\22'] = 'b' }

local function u16(line, byte) -- Neovim byte column -> engine (UTF-16) column
  local ok, n = pcall(vim.str_utfindex, line, 'utf-16', byte, false)
  return ok and n or byte
end
local function b8(line, col) -- engine (UTF-16) column -> Neovim byte column
  local ok, n = pcall(vim.str_byteindex, line, 'utf-16', col, false)
  return ok and n or col
end

--- Fresh buffer in the state the engine starts from, then the keys, then <Esc> unless back in Normal.
local function play(r, keys, regNames)
  vim.cmd('silent! %bwipeout!')
  vim.cmd('enew!')
  vim.o.laststatus, vim.o.cmdheight, vim.o.columns = 0, 1, 200
  vim.o.lines = math.max(3, (r.height or 20) + 1) -- window height == the tutor's editor rows
  local buf = vim.api.nvim_get_current_buf()
  local lines = vim.split(r.text, '\n', { plain = true })
  vim.cmd('set undolevels=-1') -- the starting text is not an undoable change (the engine has no undo yet)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.cmd('set undolevels=1000')
  vim.api.nvim_buf_set_name(buf, r.name)
  vim.bo.filetype = vim.filetype.match({ filename = r.name }) or ''
  vim.o.shiftwidth, vim.o.expandtab, vim.o.tabstop, vim.o.autoindent = 2, true, 8, true
  vim.o.ignorecase, vim.o.smartcase, vim.o.textwidth, vim.o.wrapscan = false, false, 0, true
  vim.o.startofline = false -- Neovim's default; the engine's too
  for k, v in pairs(r.options or {}) do pcall(function() vim.o[k] = v end) end
  vim.fn.histdel('search'); vim.fn.histdel('cmd')
  vim.fn.setreg('/', r.search or '')
  if r.search and r.search ~= '' then vim.o.hlsearch = true end
  for _, reg in ipairs({ '"', '0', '1', '2', 'a', 'b', 'q', '-' }) do vim.fn.setreg(reg, '') end
  local l = r.cursor.line + 1
  vim.api.nvim_win_set_cursor(0, { l, b8(lines[l] or '', r.cursor.col) })
  vim.fn.winrestview({ curswant = vim.api.nvim_win_get_cursor(0)[2] })
  pcall(vim.api.nvim_feedkeys, vim.api.nvim_replace_termcodes(keys, true, true, true), 'tx', false)
  if vim.fn.mode() ~= 'n' then pcall(vim.api.nvim_feedkeys, esc, 'tx', false) end
  local p = vim.api.nvim_win_get_cursor(0)
  local cur = vim.api.nvim_buf_get_lines(buf, p[1] - 1, p[1], false)[1] or ''
  local regs = {}
  for _, n in ipairs(regNames or {}) do regs[n] = vim.fn.getreg(n) end
  return {
    text = table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), '\n'),
    cursor = { line = p[1] - 1, col = u16(cur, p[2]) },
    reg = { text = vim.fn.getreg('"'), type = REGTYPE[vim.fn.getregtype('"'):sub(1, 1)] or 'v' },
    regs = regs,
  }
end

local function pos(c) return '(' .. c.line .. ',' .. c.col .. ')' end

--- Engine vs Neovim for one exported item. Returns a list of { what, engine, nvim } differences.
local function compare(r, nv, withText)
  local e, d = r.engine, {}
  if e.error then return { { 'engine error', e.error, '' } } end
  if withText and e.text ~= nv.text then table.insert(d, { 'text', vim.inspect(e.text), vim.inspect(nv.text) }) end
  if e.cursor.line ~= nv.cursor.line or e.cursor.col ~= nv.cursor.col then
    table.insert(d, { 'cursor', pos(e.cursor), pos(nv.cursor) })
  end
  if e.reg.text ~= nv.reg.text then
    table.insert(d, { 'reg "', vim.inspect(e.reg.text), vim.inspect(nv.reg.text) })
  elseif e.reg.text ~= '' and e.reg.type ~= nv.reg.type then
    table.insert(d, { 'regtype "', e.reg.type, nv.reg.type })
  end
  for _, n in ipairs(r.regNames or {}) do
    if (e.regs[n] or '') ~= (nv.regs[n] or '') then
      table.insert(d, { 'reg ' .. n, vim.inspect(e.regs[n]), vim.inspect(nv.regs[n]) })
    end
  end
  for _, pr in ipairs(r.probes or {}) do
    local pe, pn = pr.engine, play(r, r.keys .. pr.keys, {})
    if pe.error then
      table.insert(d, { 'probe ' .. pr.keys, 'engine error ' .. pe.error, '' })
    elseif pe.text ~= pn.text then
      table.insert(d, { 'probe ' .. pr.keys .. ' text', vim.inspect(pe.text), vim.inspect(pn.text) })
    elseif pe.cursor.line ~= pn.cursor.line or pe.cursor.col ~= pn.cursor.col then
      table.insert(d, { 'probe ' .. pr.keys .. ' cursor', pos(pe.cursor), pos(pn.cursor) })
    end
  end
  return d
end

local function section(out, title, items, withText)
  local ok, bad, kinds = 0, {}, {}
  for _, r in ipairs(items) do
    local d = compare(r, play(r, r.keys, r.regNames), withText)
    if #d == 0 then ok = ok + 1 else
      table.insert(bad, { r = r, d = d })
      local seen = {}
      for _, x in ipairs(d) do
        local k = x[1]:match('^probe') and 'probe' or x[1]
        if not seen[k] then seen[k] = true; kinds[k] = (kinds[k] or 0) + 1 end
      end
    end
  end
  local parts = {}
  for k, n in pairs(kinds) do table.insert(parts, k .. ' ' .. n) end
  table.sort(parts)
  table.insert(out, '')
  table.insert(out, title .. ': ok ' .. ok .. ' bad ' .. #bad .. (#parts > 0 and ('  (' .. table.concat(parts, ', ') .. ')') or ''))
  for _, b in ipairs(bad) do
    table.insert(out, '== ' .. b.r.id .. '  ' .. vim.inspect(b.r.text) .. ' @' .. pos(b.r.cursor) .. '  ' .. b.r.keys)
    for _, x in ipairs(b.d) do
      table.insert(out, '  ' .. x[1] .. ':  engine ' .. x[2] .. '  nvim ' .. x[3])
    end
  end
end

-- Section 1: the gate.
local bad, ok = {}, 0
for _, r in ipairs(data.rounds) do
  local got = play(r, r.keys, {}).text
  if got == r.want then ok = ok + 1 else table.insert(bad, { id = r.id, keys = r.keys, got = got, want = r.want }) end
end
local out = { 'ok ' .. ok .. ' bad ' .. #bad }
for _, b in ipairs(bad) do
  table.insert(out, '== ' .. b.id .. '  ' .. b.keys)
  table.insert(out, '  want: ' .. vim.inspect(b.want))
  table.insert(out, '  got:  ' .. vim.inspect(b.got))
end

section(out, 'extended (engine vs nvim on lesson rounds)', data.rounds, true)
section(out, 'cases (engine vs nvim on cases.json)', data.cases, true)

vim.fn.writefile(out, vim.env.OUT)
vim.fn.delete(sandbox, 'rf')
vim.cmd('qa!')
