/* eslint-disable no-console */
import nanoid from 'nanoid'
import { mergeModel } from './basics'
import { mapProp } from './safe-basics'
import T from 'ramda/es/T'
import equals from 'ramda/es/equals'

function sessionFromTabs(tabs) {
  const now = Date.now()
  const session = {
    id: 'S_' + nanoid(),
    createdAt: now,
    modifiedAt: now,
    tabs: tabs,
  }
  console.log('session :', session)
  return session
}

const modify = fn => session => {
  const newSession = fn(session)
  return equals(newSession)(session)
    ? session
    : { ...newSession, modifiedAt: Date.now() }
}

const modifyWithId = id => fn => lookup => {
  return mapProp(id)(modify(fn))(lookup)
}

export const SessionStore = {
  addNewFromTabs: tabs => store => {
    const session = sessionFromTabs(tabs)
    return mergeModel(session)(store)
  },
  deleteById: id => store => {
    const markDeleted = mapProp('deleted')(T)
    return modifyWithId(id)(markDeleted)(store)
  },
}
