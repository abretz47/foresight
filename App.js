import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';
import * as Facebook from 'expo-facebook';

import HomeScreen from './src/pages/HomeScreen';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen';
import Default from './src/pages/Default';
import DB from './src/data/db';

async function logIn() {
  try {
    const {
      type,
      token,
      expires,
      permissions,
      declinedPermissions,
    } = await Facebook.logInWithReadPermissionsAsync('', {
      permissions: ['public_profile'],
      behavior: 'browser'
    });
    if (type === 'success') {
      // Get the user's name using Facebook's Graph API
      const response = await fetch(`https://graph.facebook.com/me?access_token=${token}`);
      Alert.alert('Logged in!', `Hi ${(await response.json()).name}!`);
    } else {
      // type === 'cancel'
      alert('something else');
    }
  } catch ({ message }) {
    alert(`Facebook Login Error: ${message}`);
  }
}

//logIn();

const MainNavigator = createStackNavigator({
  Home: {screen: HomeScreen},
  RecordDetails: {screen:RecordDetailsScreen},
  Record: {screen: Record},
  Default:{screen:Default}
});
const AppContainer = createAppContainer(MainNavigator);

export default class App extends Component {
  render() {
    return <AppContainer />;
  }
}
