import React, { Component } from 'react';
import { View, Button } from 'react-native';
import { styles } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

export default class HomeScreen extends Component<Props> {
  navigateToRecord = (calledFrom: 'Record' | 'Analyze') => {
    const user = this.props.route.params?.user ?? 'local_user';
    const { navigate } = this.props.navigation;
    let navigated = false;
    const promise = DB.getShotProfile(user, (shots) => {
      navigated = true;
      const firstShot = shots[0];
      navigate(calledFrom, {
        user,
        id: firstShot.id,
        shotName: firstShot.name,
        targetDistance: firstShot.distance,
        targetRadius: firstShot.targetRadius,
        missRadius: firstShot.missRadius,
        calledFrom,
      });
    });
    void promise.then(() => {
      if (!navigated) {
        navigate('RecordDetails', { calledFrom, user });
      }
    });
  };

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    return (
      <View style={styles.template}>
        <View style={styles.homeContainer}>
          <View style={styles.buttonRow}>
            <View style={styles.buttonContainer}>
              <Button title="Shot Profile" onPress={() => navigate('ShotProfile', { user })} color="black" />
            </View>
          </View>
          <View style={styles.buttonRow}>
            <View style={styles.buttonContainer}>
              <Button title="Record Data" onPress={() => this.navigateToRecord('Record')} color="black" />
            </View>
            <View style={styles.buttonContainer}>
              <Button title="Analyze Data" onPress={() => this.navigateToRecord('Analyze')} color="black" />
            </View>
          </View>
          <View style={styles.logoutButtonRow}>
            <View style={styles.logoutButtonContainer}>
              <Button title="Log Out" onPress={() => navigate('Login')} color="black" />
            </View>
          </View>
        </View>
      </View>
    );
  }
}
