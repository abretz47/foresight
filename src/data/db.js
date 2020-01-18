import React, {Component} from 'react';
import * as firebase from 'firebase';
import 'firebase/firestore';


// Initialize Firebase

const firebaseConfig = {
    apiKey: "AIzaSyBOL93KgNphI_eSi6Vc0ZA9yCQamcRDdCs",
    authDomain: "foresight-58134.firebaseapp.com",
    databaseURL: "https://foresight-58134.firebaseio.com",
    projectId: "foresight-58134",
    storageBucket: "foresight-58134.appspot.com",
    appID: "1:661750039560:web:4d972908b10f5319",
};

firebase.initializeApp(firebaseConfig);

var db = firebase.firestore();
export function getShotProfile(_callback){
    var data = [];
    db.collection("users").doc("abretz").collection("Shot Profile").orderBy("distance", "desc").get()
    .then(
        function(querySnapshot) {
            querySnapshot.forEach(function (doc){
                // doc.data() is never undefined for query doc snapshots
                data.push(doc.data());
                data[data.length - 1].id = doc.id;
            });
            _callback(data);
        });
}
export function saveShot(shot){
    var collectionRef = db.collection("users").doc("abretz").collection("Shot Profile");
    if(shot.id && shot.id != ""){
        collectionRef.doc(shot.id).set({
            name: shot.name,
            distance: shot.targetDistance,
            targetRadius: shot.targetRadius,
            missRadius: shot.missRadius,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(function(){
            console.log("successfully updated shot type for: ", shot.id);
        })
        .catch(function(e){
            console.log("Error updating shot type for: ", shot.id, e)
        })
    }
    else{
        collectionRef.add({
            name: shot.name,
            distance: shot.targetDistance,
            targetRadius: shot.targetRadius,
            missRadius: shot.missRadius,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(function(docRef){
            console.log("successfully added shot type for: ", docRef.id);
        })
        .catch(function(e){
            console.log("Error adding shot type: ", e)
        })
    }

}
export function deleteShot(id){
    var collectionRef = db.collection("users").doc("abretz").collection("Shot Profile");
    if(id && id != ""){
       collectionRef.doc(id).delete()
       .then(function(){
           console.log("Successfully deleted doc id: ", id);
       })
       .catch(function(e){
           console.log("Error deleting doc: ", id, e);
       })
    }
}

