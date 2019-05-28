import _pipe from 'ramda/es/pipe'
import is from 'ramda/es/is'
import over from 'ramda/es/over'
import lensProp from 'ramda/es/lensProp'

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

export const mapProp = pname => fn => {
  invariant(is(String)(pname))
  invariant(is(Function)(fn))
  return over(lensProp(pname))(fn)
}
