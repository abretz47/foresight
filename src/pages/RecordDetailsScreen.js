import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button, Picker } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import {styles} from '../styles/styles.js';
import ClubPicker from '../components/ClubPicker.js';
import ShotsPicker from '../components/ShotsPicker.js';
import TargetPicker from '../components/TargetPicker.js';
import TargetRadiusPicker from '../components/TargetRadiusPicker.js';
import MissRadiusPicker from '../components/MissRadiusPicker.js';
import {test} from '../data/db';

export default class RecordDetailsScreen extends Component{
    static navigationOptions = {
        title: 'Record Details',
      };
    constructor(props){
        super(props);
        this.state = {
                        club:"7i",
                        target: "150",
                        targetRadius:"5",
                        missRadius:"20"
                    };
    }
    _setState = (item, value) =>{
      if(item == "club"){
        this.setState({club:value});
      }
      else if(item == "target"){
        this.setState({target:value});
      }
    }
      render() {
        const {navigate} = this.props.navigation;
        return (
          <View style={styles.template}>
            <View style={styles.container}>
              <View style={styles.row}>
                  <View style={{padding:40}}>
                    <ClubPicker defaultSelection={this.state.club} callBack={this._setState}></ClubPicker>
                  </View>
                  <View style={{padding:40}}>
                    <TargetPicker defaultSelection={this.state.target} callBack={this._setState}></TargetPicker>
                  </View>
              </View>
            </View>
            <View style={styles.container}>
              <View style={styles.row}>
                <View style={{padding:40}}>
                  <TargetRadiusPicker defaultSelection={this.state.targetRadius} callBack={this._setState}></TargetRadiusPicker>
                </View>
                <View style={{padding:40}}>
                  <MissRadiusPicker defaultSelection={this.state.missRadius} callBack={this._setState}></MissRadiusPicker>
                </View>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <View style={styles.buttonContainer}>
                <Button title="Go!" color="black" onPress={() => this.props.navigation.navigate('Record',{
                    club: this.state.club,
                    target: this.state.target,
                    targetRadius: this.state.targetRadius,
                    missRadius: this.state.missRadius
                  })}></Button>
              </View>
            </View>
          </View>
        );
      }
}

