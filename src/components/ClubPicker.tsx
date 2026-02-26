import React, { Component } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';

interface Props {
  defaultSelection?: string;
  callBack: (key: string, value: string) => void;
}

interface State {
  club: string;
}

export default class ClubPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { club: this.props.defaultSelection ?? '' };
  }

  render() {
    return (
      <View>
        <Text style={styles.label}>Club</Text>
        <Picker
          selectedValue={this.state.club}
          style={{ flex: 1 }}
          onValueChange={(itemValue) => {
            this.setState({ club: String(itemValue) });
            this.props.callBack('club', String(itemValue));
          }}
        >
          <Picker.Item label="1i" value="1i" />
          <Picker.Item label="2i" value="2i" />
          <Picker.Item label="3i" value="3i" />
          <Picker.Item label="4i" value="4i" />
          <Picker.Item label="5i" value="5i" />
          <Picker.Item label="6i" value="6i" />
          <Picker.Item label="7i" value="7i" />
          <Picker.Item label="8i" value="8i" />
          <Picker.Item label="9i" value="9i" />
          <Picker.Item label="PW" value="PW" />
          <Picker.Item label="GW" value="GW" />
          <Picker.Item label="SW" value="SW" />
          <Picker.Item label="LW" value="LW" />
        </Picker>
      </View>
    );
  }
}
