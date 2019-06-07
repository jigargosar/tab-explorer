/* eslint-disable no-console */
import nanoid from 'nanoid'
import { mergeModel } from './basics'
import { mapProp, toggleProp, pipe } from './safe-basics'
import T from 'ramda/es/T'
import equals from 'ramda/es/equals'
import { reject } from 'q'
import map from 'ramda/es/map'
import F from 'ramda/es/F'
import defaultTo from 'ramda/es/defaultTo'
import mergeLeft from 'ramda/es/mergeLeft'
import identity from 'ramda/es/identity'
import values from 'ramda/es/values'
import difference from 'ramda/es/difference'

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

const collapse = mapProp('collapsed')(T)
const expand = mapProp('collapsed')(F)
function decodeSessionFromCache(session) {
  const fn = pipe(
    //
    mapProp('modifiedAt')(defaultTo(session.createdAt)),
  )
  return fn(session)
}

const decodeSessionStore = map(decodeSessionFromCache)

const replaceNewerSessions = sessionList => store => {
  const newStore = sessionList
    .filter(session => {
      const existingSession = store[session.id]
      return (
        !existingSession || existingSession.modifiedAt < session.modifiedAt
      )
    })
    .reduce((acc, session) => mergeModel(session)(acc), {})
  return mergeLeft(newStore)(store)
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
  togglePinned: id => {
    return modifyWithId(id)(toggleProp('pinned'))
  },
  toggleCollapsed: id => {
    return modifyWithId(id)(toggleProp('collapsed'))
  },
  collapseAll: map(collapse),
  expandAll: map(expand),
  decode: decodeSessionStore,
  updateChangesFromAnotherTab: otherTabStore =>
    replaceNewerSessions(values(otherTabStore)),
  replaceNewerSessions,
  toIdLookup: identity,
  getUpdatedSessionList: oldStore => store =>
    difference(values(store))(values(oldStore)),
}
