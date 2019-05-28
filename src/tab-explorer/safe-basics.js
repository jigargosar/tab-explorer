import _pipe from 'ramda/es/pipe'

export function invariant(bool, msg = 'Invariant Failed') {
  if (!bool) {
    throw new Error(msg)
  }
}

export function pipe(...args) {
  invariant(args.length >= 1)
  args.map((f, i) =>
    invariant(
      typeof f === 'function',
      `pipe: ${i}th arg is not a function`,
    ),
  )
  return _pipe(...args)
}
