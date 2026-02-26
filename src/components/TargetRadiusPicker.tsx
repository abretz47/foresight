import React, { Component } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { styles } from '../styles/styles';

interface Props {
  defaultSelection?: string;
  callBack: (key: string, value: string) => void;
}

interface State {
  targetRadius: string;
}

export default class TargetRadiusPicker extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { targetRadius: this.props.defaultSelection ?? '' };
  }

  render() {
    return (
      <View>
        <Text style={styles.label}>Target</Text>
        <Text style={styles.label}>Radius</Text>
        <Picker
          selectedValue={this.state.targetRadius}
          style={{ flex: 1 }}
          onValueChange={(itemValue) => {
            this.setState({ targetRadius: String(itemValue) });
            this.props.callBack('targetRadius', String(itemValue));
          }}
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <Picker.Item key={n} label={String(n)} value={String(n)} />
          ))}
        </Picker>
      </View>
    );
  }
}
