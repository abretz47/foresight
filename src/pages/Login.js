import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';
import * as Facebook from 'expo-facebook';

import {styles} from '../styles/styles.js';

import app from '../../app.json'

async function initLogin() {
  try {
    await Facebook.initializeAsync(app.facebook.id, app.facebook.name);
    const {
      type,
      token,
      expires,
      permissions,
      declinedPermissions,
    } = await Facebook.logInWithReadPermissionsAsync(app.facebook.id, {
      permissions: ['public_profile'],
      behavior: 'browser'
    });
    if (type === 'success') {
      // Get the user's name using Facebook's Graph API
      const response = await fetch(`https://graph.facebook.com/me?access_token=${token}`)
        Alert.alert('Logged in!', `Hi ${(await response.json()).name}!`);
    } else {
      // type === 'cancel'
      alert('something else');
    }
  } catch ({ message }) {
    alert(`Facebook Login Error: ${message}`);
  }
}
initLogin();
export default class HomeScreen extends Component {
    static navigationOptions = {
    title: 'Login',
  };
  render() {
    const {navigate} = this.props.navigation;
    return (
      <View style={styles.template}>
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

