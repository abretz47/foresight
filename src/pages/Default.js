import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

export default class Default extends Component{
  render(){
      return(
        <View><Text>This is the default screen</Text></View>
      );
  }
}