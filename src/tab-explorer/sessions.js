/* eslint-disable no-console */
import nanoid from 'nanoid'

export function sessionFromTabs(tabs) {
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
