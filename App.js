import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import HomeScreen from './src/pages/HomeScreen';
import Record from './src/pages/Record';
import RecordDetailsScreen from './src/pages/RecordDetailsScreen'

const MainNavigator = createStackNavigator({
  Home: {screen: HomeScreen},
  RecordDetails: {screen:RecordDetailsScreen},
  Record: {screen: Record}
});
const AppContainer = createAppContainer(MainNavigator);

export default class App extends Component {
  render() {
    return <AppContainer />;
  }
}


