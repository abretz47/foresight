import React, {Component} from 'react';
import * as firebase from 'firebase';
import 'firebase/firestore';


// Initialize Firebase

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    appID: "",
};

firebase.initializeApp(firebaseConfig);

var db = firebase.firestore();
/*db.collection("test").doc("person").get().then((doc) => {
    console.log(doc.data());
})*/

export function test(){
        db.collection("records").doc("abretz").collection("7i").doc("GoA0uGrP5egGrIHNOFs5").get().then((doc) => {
            console.log(doc.data());
        })
}

