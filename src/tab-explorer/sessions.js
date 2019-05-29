/* eslint-disable no-console */
import nanoid from 'nanoid'
import { mergeModel } from './basics'
import { mapProp, toggleProp } from './safe-basics'
import T from 'ramda/es/T'
import equals from 'ramda/es/equals'
import { reject } from 'q'

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
  addNewFromTabs: tabs => {
    const session = sessionFromTabs(tabs)
    return mergeModel(session)
  },
  deleteById: id => {
    const markDeleted = mapProp('deleted')(T)
    return modifyWithId(id)(markDeleted)
  },
  deleteTabInSessionWithId: id => tab => {
    const rejectTab = mapProp('tabs')(reject(equals(tab)))
    return modifyWithId(id)(rejectTab)
  },
  toggleCollapsed: id => {
    return modifyWithId(id)(toggleProp('collapsed'))
  },
}
