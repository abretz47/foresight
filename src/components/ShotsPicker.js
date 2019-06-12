import React, {Component} from 'react';
import {Picker, Text, View } from 'react-native';

import {styles} from '../styles/styles.js'; 

 export default class ShotsPicker extends Component{
    constructor(props){
        super(props);//research what this does
        this.state={shots:this.props.defaultSelection};
    }
     render(){
         return(
            <View>
                <Text style={styles.label}>Shots</Text>
                <Picker
                    selectedValue={this.state.shots}
                    style={{flex: 1}}
                    onValueChange={(itemValue, itemIndex) =>{
                        this.setState({shots: itemValue});
                        this.props.callBack("shots",itemValue);
                        }
                    }>
                    <Picker.Item label="1" value="1" />
                    <Picker.Item label="2" value="2" />
                    <Picker.Item label="3" value="3" />
                    <Picker.Item label="4" value="4" />
                    <Picker.Item label="5" value="5" />
                    <Picker.Item label="6" value="6" />
                    <Picker.Item label="7" value="7" />
                    <Picker.Item label="8" value="8" />
                    <Picker.Item label="9" value="9" />
                    <Picker.Item label="10" value="10"/>
                    <Picker.Item label="11" value="11"/>
                    <Picker.Item label="12" value="12"/>
                    <Picker.Item label="13" value="13"/>
                    <Picker.Item label="14" value="14"/>
                    <Picker.Item label="15" value="15"/>
                    <Picker.Item label="16" value="16"/>
                    <Picker.Item label="17" value="17"/>
                    <Picker.Item label="18" value="18"/>
                    <Picker.Item label="19" value="19"/>
                    <Picker.Item label="20" value="20"/>
                </Picker>
            </View>
         )
     }
 }