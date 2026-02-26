import React, {Component} from 'react';
import {Text, View, Button, TextInput} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

import * as DB from '../data/db';

import {styles} from '../styles/styles.js';

export default class ShotProfile extends Component {
  constructor(props){
    super(props);
    this.state={selectedShot:this.props.defaultSelection, 
        shots:[],
        id:"",
        shotName:"",
        targetDistance:"",
        targetRadius:"",
        missRadius:""};
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      this.getShotProfile();
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  getShotProfile = () => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotProfile(user, (data) => {
      this.setState({shots:data, selectedShot:0});
    });
  }

  selectionChange = (value, index) => {
    if(value != "New Shot"){
      var selection = this.state.shots[index - 1];
      this.setState({id: selection.id,
        shotName: selection.name,
        targetDistance: selection.distance, 
        targetRadius: selection.targetRadius, 
        missRadius: selection.missRadius});
    }
    else{
      this.setState({id: "",
        shotName: "",
        targetDistance: "", 
        targetRadius: "", 
        missRadius: ""});
    }
  }

  saveShot = () => {
    const user = this.props.route.params?.user ?? '';
    var shot = {
      id : this.state.id,
      name : this.state.shotName,
      targetDistance : this.state.targetDistance,
      targetRadius : this.state.targetRadius,
      missRadius : this.state.missRadius
    };
    DB.saveShot(user, shot);
    this.getShotProfile();
    this.selectionChange("New Shot", 0);
  }

  deleteShot = () => {
    const user = this.props.route.params?.user ?? '';
    DB.deleteShot(user, this.state.id);
    this.getShotProfile();
    this.selectionChange("New Shot", 0);
  }

  render() {
    return (
      <KeyboardAwareScrollView
        style={styles.container}
        resetScrollToCoords={{ x: 0, y: 0 }}
        contentContainerStyle={styles.container}
        scrollEnabled={true}
      >
        <View style={styles.template}>
           <View style={styles.container}>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.label}>Select Shot</Text>
                <Picker 
                    selectedValue={this.state.selectedShot}
                    mode="dialog"
                    onValueChange={(itemValue, itemIndex) => {
                        this.setState({selectedShot: itemValue});
                        this.selectionChange(itemValue,itemIndex);
                    }}>
                    <Picker.Item label="New Shot" value="New Shot"/>
                    {Object.keys(this.state.shots).map((key) => {
                      return (<Picker.Item label={this.state.shots[key].name} value={key} key={key}/>)
                    })}
                </Picker>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Shot Name</Text>
                  <TextInput value={this.state.shotName} style={styles.textInput} onChangeText={(text)=> {
                    this.setState({shotName: text});}}></TextInput>
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Target Distance</Text>
                  <TextInput value={this.state.targetDistance} style={styles.textInput} onChangeText={(text)=> {
                    this.setState({targetDistance: text});}}></TextInput>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Target Radius</Text>
                  <TextInput value={this.state.targetRadius} style={styles.textInput} onChangeText={(text)=> {
                    this.setState({targetRadius: text});}}></TextInput>
                </View>
                <View style={styles.column}>
                  <Text style={styles.label}>Miss Radius</Text>
                  <TextInput value={this.state.missRadius} style={styles.textInput} onChangeText={(text)=> {
                    this.setState({missRadius: text});}}></TextInput>
                </View>
              </View>
              <View style={styles.buttonRow}>
                <View style={styles.buttonDanger}>
                    <Button title="Delete" color="black" onPress={() => this.deleteShot()}></Button>
                </View>
                <View style={styles.buttonContainer}>
                  <Button title="Save" color="black" onPress={() => this.saveShot()}></Button>
                </View>
              </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    );
  }
}
