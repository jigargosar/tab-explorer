/* eslint-disable no-console */
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useEffect } from 'react'
import { SessionStore } from './session-store'
import { pipe } from './safe-basics'
import map from 'ramda/es/map'
import isEmpty from 'ramda/es/isEmpty'
import equals from 'ramda/es/equals'
import { usePrevious } from './use-prev-hook'
import { mergeModel } from './basics'
import keys from 'ramda/es/keys'

export const signIn = () => {
  const auth = firebase.auth()
  const ap = new firebase.auth.GoogleAuthProvider()
  ap.setCustomParameters({ prompt: 'select_account' })
  auth.signInWithPopup(ap)
}

export const signOut = () => {
  firebase.auth().signOut()
}

const firebaseConfig = {
  apiKey: 'AIzaSyBVS1Tx23pScQz9w4ZDTGh307mqkCRy2Bw',
  authDomain: 'not-now-142808.firebaseapp.com',
  databaseURL: 'https://not-now-142808.firebaseio.com',
  projectId: 'not-now-142808',
  storageBucket: 'not-now-142808.appspot.com',
  messagingSenderId: '476064436883',
  appId: '1:476064436883:web:ebbcbed81661398e',
}

firebase.initializeApp(firebaseConfig)

export function onAuthStateChanged(cb) {
  return firebase.auth().onAuthStateChanged(cb)
}

export function useAuth() {
  return useAuthState(firebase.auth())
}

export function useFireSyncSessions(actions, sessionStore) {
  const [user] = useAuth()

  useUpdateSessionStoreOnFirebaseChangesEffect(user, actions)

  useSendSessionChangesToFirebaseEffect(user, sessionStore)
}

function useUpdateSessionStoreOnFirebaseChangesEffect(user, actions) {
  useEffect(() => {
    if (!user) return
    const sessionsCRef = getSessionsCRef(user)
    const disposer = sessionsCRef.onSnapshot(qs => {
      const sessionChanges = qs.docChanges({})
      console.log(
        'fire query: Session Changes',
        sessionChanges.length,
        sessionChanges,
      )
      // const fireAllSessions = qs.docs.map(ds => ds.data())
      const fireChangedSessions = sessionChanges.map(snap =>
        snap.doc.data(),
      )
      actions.updateSessionsIfNewer(fireChangedSessions)
    }, console.error)
    return disposer
  }, [user])
}

function useSendSessionChangesToFirebaseEffect(user, sessionStore) {
  const prevSessionStore = usePrevious(sessionStore)

  useEffect(() => {
    if (!user) return
    if (!prevSessionStore) return

    const changedSessionList = SessionStore.getUpdatedSessionList(
      prevSessionStore,
    )(sessionStore)

    if (isEmpty(changedSessionList)) return

    updateSessionsCollection(user, changedSessionList)
  }, [user, sessionStore, prevSessionStore])
}

function updateSessionsCollection(user, changedSessions) {
  const sessionsById = changedSessions.reduce(
    (byId, session) => mergeModel(session)(byId),
    {},
  )
  const sessionIds = keys(sessionsById)
  const sessionsCRef = getSessionsCRef(user)
  firebase
    .firestore()
    .runTransaction(async t => {
      const fetchDocWithSessionId = sid => t.get(sessionsCRef.doc(sid))
      const fetchSessionsFromIds = pipe(
        map(fetchDocWithSessionId),
        // tap(console.log),
        Promise.all.bind(Promise),
      )
      const docSnaps = await fetchSessionsFromIds(sessionIds)
      docSnaps.forEach(snap => {
        const session = sessionsById[snap.id]
        if (snap.exists) {
          if (equals(snap.data())(session)) {
            console.log(
              'fire transaction: ignoring update since firesession is uptodate',
              snap.id,
            )
            // t.update(snap.ref, session)
            t.update(snap.ref, {})
          } else {
            t.update(snap.ref, session)
          }
        } else {
          t.set(snap.ref, session)
        }
      })
    })
    .then(() =>
      console.log(
        'fire transaction: sessions updated',
        sessionIds.length,
        sessionIds,
      ),
    )
    .catch(console.error)
}

function getSessionsCRef(user) {
  const db = firebase.firestore()
  return db.collection(`users/${user.uid}/tab-ex-sessions`)
}
