import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';

import {styles} from '../styles/styles.js';


export default class HomeScreen extends Component {
    static navigationOptions = {
    title: 'Welcome',
    headerLeft: null
  };
  render() {
    const {navigate} = this.props.navigation;
    const user = this.props.navigation.getParam("user", "abretz");
    return (
      <View style={styles.template}>
        <View style={styles.homeContainer}>
          <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
                <Button title="Shot Profile" onPress={() => this.props.navigation.navigate('ShotProfile',{user:user})} color="black"/>
            </View>
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonContainer}>
                <Button title="Record Data" onPress={() => this.props.navigation.navigate('RecordDetails', {calledFrom:"Record",user:user})} color="black"/>
            </View>
            <View style={styles.buttonContainer}>
                <Button title="Analyze Data" onPress={() => this.props.navigation.navigate('RecordDetails', {calledFrom: "Analyze", user:user})} color="black"/>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

class Header extends Component{
  render(){
    return(
      <View style={styles.header}>
      </View>
    )
  }
}

