const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10
}
const desired_media = { video: true, audio: true }

let peer_connection = null
let local_stream = null
let remote_stream = null
let room_id = null
const $ = document

async function create_room () {
  const db = firebase.firestore()
  const room_ref = await db.collection('rooms').doc()
  peer_connection = new RTCPeerConnection(configuration)

  register_peer_connection_listeners() // Assumes open_user_media has been called
  local_stream.getTracks().forEach(track => peer_connection.addTrack(track, local_stream))

  // Code for collecting ICE candidates below
  const caller_candidates_collection = room_ref.collection('callerCandidates')
  peer_connection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!')
      return
    }
    console.log('Got candidate: ', event.candidate)
    caller_candidates_collection.add(event.candidate.toJSON())
  })
  // Code for collecting ICE candidates above

  // Code for creating a room below
  const offer = await peer_connection.createOffer()
  await peer_connection.setLocalDescription(offer)
  console.log('Created offer:', offer)

  await room_ref.set({
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  })

  room_id = room_ref.id
  console.log(`New room created with SDP offer. Room ID: ${room_id}`)
  // Code for creating a room above

  peer_connection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0])
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remote_stream:', track)
      remote_stream.addTrack(track)
    })
  })

  // Listening for remote session description below
  room_ref.onSnapshot(async snapshot => {
    const data = snapshot.data()
    if (!peer_connection.currentRemoteDescription && data && data.answer) {
      console.log('Got remote description: ', data.answer)
      const rtcSessionDescription = new RTCSessionDescription(data.answer)
      await peer_connection.setRemoteDescription(rtcSessionDescription)
    }
  })
  // Listening for remote session description above

  // Listen for remote ICE candidates below
  room_ref.collection('calleeCandidates').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
      if (change.type === 'added') {
        const data = change.doc.data()
        console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`)
        await peer_connection.addIceCandidate(new RTCIceCandidate(data))
      }
    })
  })
  // Listen for remote ICE candidates above
}

function join_room () {
  $.querySelector('#create-room').disabled = true
  $.querySelector('#join-room').disabled = true
  room_id = $.querySelector('#room-id').value
  console.log('Join room: ', room_id)

  await join_room_by_id(room_id)
}

async function join_room_by_id (room_id) {
  const db = firebase.firestore()
  const room_ref = db.collection('rooms').doc(`${room_id}`)
  const roomSnapshot = await room_ref.get()
  console.log('Got room:', roomSnapshot.exists)

  if (roomSnapshot.exists) {
    console.log('Create PeerConnection with configuration: ', configuration)
    peer_connection = new RTCPeerConnection(configuration)
    registerPeerConnectionListeners()
    local_stream.getTracks().forEach(track => {
      peer_connection.addTrack(track, local_stream)
    })

    // Code for collecting ICE candidates below
    const calleeCandidatesCollection = room_ref.collection('calleeCandidates')
    peer_connection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!')
        return
      }
      console.log('Got candidate: ', event.candidate)
      calleeCandidatesCollection.add(event.candidate.toJSON())
    })
    // Code for collecting ICE candidates above

    peer_connection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0])
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remote_stream:', track)
        remote_stream.addTrack(track)
      })
    })

    // Code for creating SDP answer below
    const offer = roomSnapshot.data().offer
    console.log('Got offer:', offer)
    await peer_connection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peer_connection.createAnswer()
    console.log('Created answer:', answer)
    await peer_connection.setLocalDescription(answer)

    const roomWithAnswer = {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      }
    }
    await room_ref.update(roomWithAnswer)
    // Code for creating SDP answer above

    // Listening for remote ICE candidates below
    room_ref.collection('callerCandidates').onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          const data = change.doc.data()
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`)
          await peer_connection.addIceCandidate(new RTCIceCandidate(data))
        }
      })
    })
    // Listening for remote ICE candidates above
  }
}

async function open_user_media (e) {
  const stream = await navigator.mediaDevices.getUserMedia(desired_media)
  document.querySelector('#localVideo').srcObject = stream
  local_stream = stream
  remote_stream = new MediaStream()
  document.querySelector('#remoteVideo').srcObject = remote_stream

  console.log('Stream:', document.querySelector('#localVideo').srcObject)
  document.querySelector('#cameraBtn').disabled = true
  document.querySelector('#joinBtn').disabled = false
  document.querySelector('#createBtn').disabled = false
  document.querySelector('#hangupBtn').disabled = false
}

async function hang_up (e) {
  const tracks = $.querySelector('#localVideo').srcObject.getTracks()
  tracks.forEach(track => {
    track.stop()
  })

  if (remote_stream) {
    remote_stream.getTracks().forEach(track => track.stop())
  }

  if (peer_connection) {
    peer_connection.close()
  }

  $.querySelector('#localVideo').srcObject = null
  $.querySelector('#remoteVideo').srcObject = null
  $.querySelector('#cameraBtn').disabled = false
  $.querySelector('#joinBtn').disabled = true
  $.querySelector('#createBtn').disabled = true
  $.querySelector('#hangupBtn').disabled = true
  $.querySelector('#currentRoom').innerText = ''

  // Delete room on hangup
  if (room_id) {
    const db = firebase.firestore()
    const room_ref = db.collection('rooms').doc(room_id)
    const calleeCandidates = await room_ref.collection('calleeCandidates').get()
    calleeCandidates.forEach(async candidate => {
      await candidate.ref.delete()
    })
    const callerCandidates = await room_ref.collection('callerCandidates').get()
    callerCandidates.forEach(async candidate => {
      await candidate.ref.delete()
    })
    await room_ref.delete()
  }
  $.location.reload(true)
}

function register_peer_connection_listeners () {
  peer_connection.addEventListener('icegatheringstatechange', () => {
    console.log(`ICE gathering: ${peer_connection.iceGatheringState}`)
  })
  peer_connection.addEventListener('connectionstatechange', () => {
    console.log(`Connection: ${peer_connection.connectionState}`)
  })
  peer_connection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling: ${peer_connection.signalingState}`)
  })
  peer_connection.addEventListener('iceconnectionstatechange ', () => {
    console.log(`ICE connection: ${peer_connection.iceConnectionState}`)
  })
}

init()
