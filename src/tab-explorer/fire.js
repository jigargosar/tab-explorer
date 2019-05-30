/* eslint-disable no-console */
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/firestore'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useEffect } from 'react'
import { SessionStore } from './session-store'

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

export function useAuth() {
  return useAuthState(firebase.auth())
}

export function syncSessions(actions, sessionStore) {
  const [user] = useAuth()

  useEffect(() => {
    if (!user) return
    const scRef = getSessionsCRef(user)
    const disposer = scRef.onSnapshot(qs => {
      console.log('fire: Sessions Changed', qs.docs.length, qs)
      actions.updateSessionsIfNewer(qs.docs.map(ds => ds.data()))
    }, console.error)
    return disposer
  }, [user])

  useEffect(() => {
    if (!user) return
    const sref = getSessionsCRef(user)
    firebase
      .firestore()
      .runTransaction(async t => {
        const sessionLookup = SessionStore.toIdLookup(sessionStore)
        const docSnapPromises = Object.values(sessionLookup).map(s => {
          return t.get(sref.doc(s.id))
        })
        const docSnaps = await Promise.all(docSnapPromises)
        docSnaps.forEach(ds => {
          const session = sessionLookup[ds.id]
          return ds.exists
            ? t.update(ds.ref, session)
            : t.set(ds.ref, session)
        })
      })
      .then(() =>
        console.log('fire: write all docs transaction success. '),
      )
      .catch(console.error)
  }, [user, sessionStore])
}

function getSessionsCRef(user) {
  const db = firebase.firestore()
  const sref = db.collection(`users/${user.uid}/tab-ex-sessions`)
  return sref
}
