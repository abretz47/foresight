import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';

export const styles = StyleSheet.create({
  template:{
    flex: 1,
    backgroundColor: "#2BBB32"
  },
  homeContainer:{
    flex:1,
    justifyContent: 'center'
  },
  touchableContainer:{
    flex:1,
    justifyContent: 'center'
  },
  container:{
    flex:1,
    //justifyContent: 'center'
  },
  buttonContainer: {
    margin: 30,
    flex:1,
    backgroundColor: "white",
  },  
  buttonRow: {
    flexDirection: "row"
  },
  row:{
    flexDirection:"row",
    justifyContent:'center'
  },
  column:{
    flexDirection:"column",
    justifyContent:"center"
  },
  startBtn: {
    color:"black"
  },
  label:{
    fontSize: 24,
    fontFamily:"Helvetica Neue",
    fontWeight:"bold"
  }
});