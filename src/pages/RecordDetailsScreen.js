import React, {Component} from 'react';
import {Alert, StyleSheet, Text, View, Button, Picker } from 'react-native';
import {createStackNavigator, createAppContainer} from 'react-navigation';

import {styles} from '../styles/styles.js';
import ClubPicker from '../components/ClubPicker.js';
import ShotsPicker from '../components/ShotsPicker.js';

export default class RecordDetailsScreen extends Component{
    static navigationOptions = {
        title: 'Record Details',
      };
    constructor(props){
        super(props);
        this.state = {
                        shots:"10",
                        club:"7i",
                        target: "150"
                    };
    }
    _setState = (item, value) =>{
      if(item == "club"){
        this.setState({club:value});
      }
      else if(item == "shots"){
        this.setState({shots:value});
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
                        <ShotsPicker defaultSelection={this.state.shots} callBack={this._setState}></ShotsPicker>
                    </View>
                </View>
            </View>
            <View style={styles.container}>
              <View style={styles.row}>
                <Picker 
                    selectedValue={this.state.target}
                    style={{flex: 1}}
                    onValueChange={(itemValue, itemIndex) =>{
                        this.setState({target: itemValue});
                    }
                    }>
                    <Picker.Item label="100" value="100"/>
                    <Picker.Item label="110" value="110"/>
                    <Picker.Item label="120" value="120"/>
                    <Picker.Item label="130" value="130"/>
                    <Picker.Item label="140" value="140"/>
                    <Picker.Item label="150" value="150"/>
                    <Picker.Item label="160" value="160"/>
                    <Picker.Item label="170" value="170"/>
                    <Picker.Item label="180" value="180"/>
                    <Picker.Item label="190" value="190"/>
                    <Picker.Item label="200" value="200"/>
                </Picker>
              </View>
            </View>
          </View>
        );
      }
}

