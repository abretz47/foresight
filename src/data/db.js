import React, {Component} from 'react';
import * as firebase from 'firebase';
import 'firebase/firestore';

import app from '../../app.json'

// Initialize Firebase

const firebaseConfig = {
    apiKey: app.firebase.apiKey,
    authDomain: app.firebase.authDomain,
    databaseURL: app.firebase.databaseURL,
    projectId: app.firebase.projectId,
    storageBucket: app.firebase.storageBucket,
    appID: app.firebase.appID,
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
export function saveDataPoint(data){
    if(data.id && data.id != ""){
        var collectionRef = db.collection("users").doc("abretz").collection("Shot Profile").doc(data.id).collection("Data");
        collectionRef.add({
            shotX : data.shotX,
            shotY : data.shotY,
            clickedFrom: data.clickedFrom,
            screenHeight : data.screenHeight,
            screenWidth : data.screenWidth,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then((docRef) => {console.log("Successfully added data: ", docRef.id)})
        .catch((e) => {console.log("Error adding doc: ", e)})
    }
    else{
        console.error("error: no shot id!");
    }
}
export function getShotData(id, _callback){
    var data = [];
    if(id && id != ""){
        db.collection("users").doc("abretz").collection("Shot Profile").doc(id).collection("Data").get()
        .then(
            function(querySnapshot) {
                querySnapshot.forEach(function (doc){
                    // doc.data() is never undefined for query doc snapshots
                    data.push(doc.data());
                    data[data.length - 1].id = doc.id;
                });
                _callback(data);
            });;

    }
}

