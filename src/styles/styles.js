import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  template:{
    flex: 1,
    backgroundColor: "green"
  },
  container:{
    flex:1,
    justifyContent: 'center'
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
  startBtn: {
    color:"black"
  },
  label:{
    fontSize: 24,
    fontFamily:"Helvetica Neue",
    fontWeight:"bold"
  }
});