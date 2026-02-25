import React, {Component} from 'react';
import {TouchableOpacity, Text, View, Button, Dimensions } from 'react-native';
import Modal from 'react-native-modal';
import { styles } from '../styles/styles';
import * as DB from '../data/db';

export default class Record extends Component{
  constructor(props){
    super(props);
    const { route } = this.props;
    this.state = {
      screenWidth: Math.round(Dimensions.get('window').width),
      screenHeight: Math.round(Dimensions.get('window').height),
      shotName : route.params?.shotName ?? "--",
      targetDistance: route.params?.targetDistance ?? "--",
      targetRadius: route.params?.targetRadius ?? "--",
      missRadius: route.params?.missRadius ?? "--",
      targetRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * ((route.params?.targetRadius ?? 1)/(route.params?.missRadius ?? 1)) * .7)/2,
      missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * .7)/2,
      modalVisible: false,
      clickedFrom : "",
      shotDistance : "",
      shotAccuracy: "",
      shotX: "",
      shotY: "",
      data : [],
      shotId : route.params?.id ?? "--",
      calledFrom : route.params?.calledFrom ?? "Default"
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      this.loadData(this.state.shotId);
    });
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
  }

  targetStyle = () => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      backgroundColor:'red',
      width: this.state.targetRadiusPx * 2,
      height: this.state.targetRadiusPx * 2,
      borderRadius: this.state.targetRadiusPx
    };
  }

  dataStyle = (left,top) => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      backgroundColor:'black',
      width: 10,
      height: 10,
      position: "absolute",
      left: left,
      top: top,
      borderRadius: 5,
      zIndex: "1000"
    };
  }

  missStyle = () => {
    return {
      borderWidth:1,
      borderColor:'rgba(0,0,0,0.2)',
      padding: this.state.missRadiusPx,
      width: 0,
      height: 0,
      backgroundColor:'#FFFFFF',
      borderRadius: this.state.missRadiusPx,
      alignItems:'center',
      justifyContent:'center',
    };
  }

  missButtonContainer = () =>{
    return {
      borderRadius: this.state.missRadiusPx
    };
  }

  convertShotAccuracy = (number) => {
    var absVal = Math.abs(number);
    if(number <= 0){
      return String(absVal) + " L";
    }
    else{
      return String(absVal) + " R";
    }
  }

  loadData = (id) => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotData(user, id, (data) => {
      this.setState({data:data});
    });
  }

  render(){
      return(
        <View style={styles.template}>
          <View style={styles.row}>
            <View style={styles.column}>
                <Text style={styles.smallLabel}>Shot</Text>
                <Text>{this.state.shotName}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Distance</Text>
                <Text>{this.state.targetDistance}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Target Radius</Text>
                <Text>{this.state.targetRadius}</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.smallLabel}>Miss Radius</Text>
                <Text>{this.state.missRadius}</Text>
              </View>
            </View>
            <View style={styles.touchableContainer}>
              
              <View style={styles.row}>
                <View style={this.missButtonContainer}>
                <TouchableOpacity
                  style={ this.missStyle()}
                  onPress={(evt) => {
                        if(this.state.calledFrom == "Record"){
                          this.setState({shotDistance: (this.state.targetDistance - ((evt.nativeEvent.locationY - this.state.missRadiusPx)*this.state.missRadius)/this.state.missRadiusPx).toFixed(0),
                                          shotAccuracy: (((evt.nativeEvent.locationX - this.state.missRadiusPx)*this.state.missRadius)/this.state.missRadiusPx).toFixed(0),
                                          shotX : evt.nativeEvent.locationX,
                                          shotY : evt.nativeEvent.locationY,
                                          clickedFrom : "miss",
                                          modalVisible:true});
                  }}}  
                >
                <View>
                      {Object.keys(this.state.data).map((key) => {
                            if(this.state.calledFrom == "Analyze" && this.state.data[key].clickedFrom == "miss"){
                              return (<TouchableOpacity style={this.dataStyle(this.state.data[key].shotX - this.state.missRadiusPx, this.state.data[key].shotY - this.state.targetRadiusPx)} key={key}></TouchableOpacity>)
                            }
                      })}
                    </View>
                    <TouchableOpacity
                      style={this.targetStyle()}
                      onPress={(evt) => {
                          if(this.state.calledFrom == "Record"){
                            this.setState({shotDistance: (this.state.targetDistance - ((evt.nativeEvent.locationY - this.state.targetRadiusPx)*this.state.targetRadius)/this.state.targetRadiusPx).toFixed(0),
                                        shotAccuracy: (((evt.nativeEvent.locationX - this.state.targetRadiusPx)*this.state.targetRadius)/this.state.targetRadiusPx).toFixed(0),
                                        shotX : evt.nativeEvent.locationX,
                                        shotY : evt.nativeEvent.locationY,
                                        clickedFrom : "target",
                                        modalVisible:true})
                      }}}
                    >
                      <View>
                        {Object.keys(this.state.data).map((key) => {
                              if(this.state.calledFrom == "Analyze" &&this.state.data[key].clickedFrom == "target"){
                                return (<TouchableOpacity style={this.dataStyle(this.state.data[key].shotX, this.state.data[key].shotY)} key={key}></TouchableOpacity>)
                              }
                        })}
                      </View>
                    </TouchableOpacity>
                </TouchableOpacity>
                </View>
              </View>
            </View>
            <Modal isVisible={this.state.modalVisible}>
                <View style={styles.modalContent}>
                  <View style={styles.row}>
                    <View style={styles.column}>
                      <Text style={styles.smallLabel}>Distance</Text>
                      <Text>{this.state.shotDistance}</Text>
                    </View>
                    <View style={styles.column}>
                      <Text style={styles.smallLabel}>Accuracy</Text>
                      <Text>{this.convertShotAccuracy(this.state.shotAccuracy)}</Text>
                    </View>
                  </View>
                  <View style={styles.buttonRow}>
                    <View style={styles.buttonDanger}>
                      <Button style={styles.buttonDanger} color="black" title="Cancel" onPress={() => {this.setState({modalVisible:false})}}></Button>
                    </View>
                    <View style={styles.buttonSuccess}>
                      <Button title="Ok!" color="black" onPress={() => {
                        const user = this.props.route.params?.user ?? '';
                        DB.saveDataPoint(user, {
                          id : this.state.shotId,
                          shotX : this.state.shotX,
                          shotY : this.state.shotY,
                          clickedFrom : this.state.clickedFrom,
                          screenHeight : this.state.screenHeight,
                          screenWidth : this.state.screenWidth,
                        });
                        this.setState({modalVisible:false});}}
                      ></Button>
                    </View>
                  </View>
                </View>
              </Modal>
        </View>
      );
  }
}
