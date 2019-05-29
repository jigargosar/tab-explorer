import _pipe from 'ramda/es/pipe'
import is from 'ramda/es/is'
import over from 'ramda/es/over'
import lensProp from 'ramda/es/lensProp'
import isNil from 'ramda/es/isNil'
import complement from 'ramda/es/complement'
import addIndex from 'ramda/es/addIndex'
import map from 'ramda/es/map'

export function invariant(bool, msg = 'Invariant Failed') {
  if (!bool) {
    throw new Error(msg)
  }
}
export const isString = is(String)
export const isFunction = is(Function)

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

export const notNil = complement(isNil)

export const mapIndexed = addIndex(map)

export const mapProp = pname => fn => {
  invariant(isString(pname))
  invariant(isFunction(fn))
  return over(lensProp(pname))(fn)
}
