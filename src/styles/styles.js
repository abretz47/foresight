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
    justifyContent:'center',
    paddingLeft : 40,
    paddingRight: 40
  },
  column:{
    flexDirection:"column",
    justifyContent:"center",
    padding: 20
  },
  startBtn: {
    color:"black"
  },
  label:{
    fontSize: 24,
    fontFamily:"Helvetica Neue",
    fontWeight:"bold"
  },
  smallLabel:{
    fontWeight:"bold"
  },
  componentRow:{
    flexDirection:"row",
    justifyContent:'center'
  },
  textInput:{
    backgroundColor: "#FFFFFF",
    borderColor: "#000000",
    borderWidth: 1,
    height: 50,
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDanger:{
    backgroundColor: "#FF8166",
    margin: 30,
    flex:1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBottom: {
    justifyContent: 'flex-end',
    margin: 0
 },
 modalButton: {
  backgroundColor: 'lightblue',
  padding: 12,
  margin: 16,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 4,
  borderColor: 'rgba(0, 0, 0, 0.1)',
},
 modalContent: {
  backgroundColor: 'white',
  padding: 22,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 4,
  borderColor: 'rgba(0, 0, 0, 0.1)',
}
});