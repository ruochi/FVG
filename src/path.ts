type PathCommand = { op: string; args: number[] }

const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
}

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/g

function num(n: number): string {
  const rounded = Math.round(n * 1000) / 1000
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** 把 SVG 路径拆成显式命令。M/m 之后隐式重复的点按 L/l 处理。 */
export function parseSvgPath(d: string): PathCommand[] {
  const tokens: Array<string | number> = []
  for (const match of d.matchAll(TOKEN)) {
    tokens.push(match[1] ?? Number(match[2]))
  }
  const out: PathCommand[] = []
  let i = 0
  let cmd = 'M'
  while (i < tokens.length) {
    const token = tokens[i]
    if (typeof token === 'string') {
      cmd = token
      i++
      if (cmd === 'Z' || cmd === 'z') {
        out.push({ op: cmd, args: [] })
        continue
      }
    }
    const count = ARITY[cmd.toUpperCase()]
    if (count == null) break
    if (i + count > tokens.length) break
    const args: number[] = []
    for (let k = 0; k < count; k++) args.push(Number(tokens[i + k]))
    i += count
    out.push({ op: cmd, args })
    if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'
  }
  return out
}

function translateArgs(op: string, args: number[], dx: number, dy: number): number[] {
  const next = args.slice()
  const upper = op.toUpperCase()
  if (op !== upper) return next
  if (upper === 'H') next[0] = (next[0] ?? 0) + dx
  else if (upper === 'V') next[0] = (next[0] ?? 0) + dy
  else if (upper === 'A') {
    next[5] = (next[5] ?? 0) + dx
    next[6] = (next[6] ?? 0) + dy
  } else {
    for (let i = 0; i + 1 < next.length; i += 2) {
      next[i] = (next[i] ?? 0) + dx
      next[i + 1] = (next[i + 1] ?? 0) + dy
    }
  }
  return next
}

export function serializeSvgPath(commands: PathCommand[]): string {
  return commands
    .map((command) => {
      if (command.args.length === 0) return command.op
      return `${command.op} ${command.args.map(num).join(' ')}`
    })
    .join(' ')
}

/**
 * 把路径整体平移。绝对坐标加上偏移，相对命令保持原样。
 * 绘制时路径要落在盒子局部坐标里，所以这里传入的是盒子原点的相反数。
 */
export function translateSvgPath(d: string, dx: number, dy: number): string {
  if (!d.trim() || (dx === 0 && dy === 0)) return d
  const commands = parseSvgPath(d).map((command) => ({
    op: command.op,
    args: translateArgs(command.op, command.args, dx, dy),
  }))
  return serializeSvgPath(commands)
}
