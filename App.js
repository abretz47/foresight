import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import createStore from 'redux'

import Login from './src/pages/Login';
import HomeScreen from './src/pages/HomeScreen';
import ShotProfile from './src/pages/ShotProfile';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen';
import Default from './src/pages/Default';
import * as DB from './src/data/db';




const MainNavigator = createStackNavigator({
  Login: {screen: Login},
  Home: {screen: HomeScreen},
  ShotProfile: {screen: ShotProfile},
  RecordDetails: {screen:RecordDetailsScreen},
  Analyze: {screen:Record},
  Record: {screen: Record},
  Default:{screen:Default}
});
const AppContainer = createAppContainer(MainNavigator);

export default class App extends Component {

  render() {
    return <AppContainer />;
  }
}
