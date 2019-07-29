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
/*db.collection("test").doc("person").get().then((doc) => {
    console.log(doc.data());
})*/

export function test(){
        db.collection("records").doc("abretz").collection("7i").doc("GoA0uGrP5egGrIHNOFs5").get().then((doc) => {
            console.log(doc.data());
        })
}

