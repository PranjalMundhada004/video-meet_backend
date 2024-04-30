import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const Video = (props) => {
    const ref = useRef();
    console.log(1);

    // useEffect(() => {
    //     props.peer.on("stream", stream => { //event listener
    //         console.log(stream);
    //         ref.current.srcObject = stream;
    //     })
    // }, []);

    
    useEffect(() => {
        if (ref.current) {
            props?.peer?.streams?.forEach(stream => {
                ref.current.srcObject = stream;
            });
        }
    }, [props.peer]);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);

    useEffect(() => {
        socketRef.current = io.connect("http://localhost:3000/");
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
            userVideo.current.srcObject = stream;
            socketRef.current.emit("join room");
            socketRef.current.on("all users", users => { //this is happening for user who is joining
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push(peer);
                })
                setPeers(peers);
            })

            socketRef.current.on("user joined", payload => { //this is for user who has already joined
                const peer = addPeer(payload.signal, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                })

                setPeers(users => [...users, peer]);
            })

            socketRef.current.on("receiving returned signal", payload => {
                //now we are getting signals from all the users inside the room so we have to find from whom we are getting the signal
                const item = peersRef.current.find(p => p.peerID === payload.id); //here we are finding the user from which we are getting the signal
                item.peer.signal(payload.signal); //after getting the particular peer(item) (item.peer is the peer instance)
                //here user joined is sending signal to all the other users in room
            })
        })
    }, []);

    //this is for user who joined
    function createPeer(userToSignal, callerID, stream) {  //this will create peers for joining user mapped to all users already in room
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        //here user joined is sending signal to user who is already in room
        peer.on("signal", signal => { //this signal event is triggered when a new peer is created because initiator is true
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        return peer;
    }

    //this is for users in room
    function addPeer(incomingSignal, callerID, stream) { //this is for adding peer for all users who are already in room
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream
        })

        //here user in room is sending signal to user who joined
        //this event will trigger after 'signal' event is called which is peer.signal(...)
        peer.on("signal", signal => { //this signal event is not triggered when a new peer is created as initiator is false, rather it will trigger when someone whats to make connection with this peer
            socketRef.current.emit("returning signal", { signal, callerID })
        })

        peer.signal(incomingSignal); //accepting the incoming signal, signal is simple peer method, after this it trigger event 'signal'

        return peer;
    }

    return (
        <Container>
            <StyledVideo muted ref={userVideo} autoPlay playsInline />
            {console.log(peers)}
            {peers.map((peer, index) => {
                return (
                    <Video key={index} peer={peer} />
                );
            })}
            
        </Container>
    );
};

export default Room;
