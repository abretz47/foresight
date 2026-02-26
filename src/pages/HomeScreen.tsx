import React, { Component } from 'react';
import { Text, View, Button } from 'react-native';
import { styles } from '../styles/styles';

interface Props {
  navigation: any;
  route: any;
}

export default class HomeScreen extends Component<Props> {
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
              <Button title="Record Data" onPress={() => navigate('RecordDetails', { calledFrom: 'Record', user })} color="black" />
            </View>
            <View style={styles.buttonContainer}>
              <Button title="Analyze Data" onPress={() => navigate('RecordDetails', { calledFrom: 'Analyze', user })} color="black" />
            </View>
          </View>
        </View>
      </View>
    );
  }
}
